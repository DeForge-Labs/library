import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import { fileTypeFromFile } from "file-type";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config();

const config = {
  title: "Imagen AI Images",
  category: "GenAI",
  type: "imagen_node",
  icon: {},
  desc: "Generate AI images using Google Imagen",
  credit: 14,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Image generation prompt",
      name: "Prompt",
      type: "Text",
    },
    {
      desc: "Seed value for generation (optional)",
      name: "Seed",
      type: "Number",
    },
    {
      desc: "Quality of the image (applicable only if the output type is jpeg",
      name: "Image Quality",
      type: "Number",
    },
  ],
  outputs: [
    {
      desc: "Temporary link to the image",
      name: "Image Link",
      type: "Text",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Image generation prompt",
      name: "Prompt",
      type: "TextArea",
      value: "Enter text here...",
    },
    {
      desc: "Seed value for generation (optional)",
      name: "Seed",
      type: "Number",
      value: 0,
    },
    {
      desc: "Aspect ration of the generated image",
      name: "Ratio",
      type: "select",
      value: "1:1",
      options: ["1:1", "9:16", "16:9", "3:4", "4:3"],
    },
    {
      desc: "Model to be used for image generation",
      name: "Model",
      type: "select",
      value: "imagen-3.0-generate-002",
      options: [
        "imagen-4.0-generate-preview-06-06",
        "imagen-4.0-fast-generate-preview-06-06",
        "imagen-4.0-ultra-generate-preview-06-06",
        "imagen-3.0-generate-002",
        "imagen-3.0-generate-001",
        "imagen-3.0-fast-generate-001",
      ],
    },
    {
      desc: "Should people be generated in the image",
      name: "Person",
      type: "select",
      value: "allow_all",
      options: ["allow_adult", "allow_all", "dont_allow"],
    },
    {
      desc: "Output type of the image",
      name: "Image Format",
      type: "select",
      value: "jpeg",
      options: ["jpeg", "png"],
    },
    {
      desc: "Quality of the image (applicable only if the output type is jpeg",
      name: "Image Quality",
      type: "Slider",
      value: 75,
      min: 0,
      max: 100,
      step: 1,
    },
  ],
  difficulty: "easy",
  tags: ["imagen", "google", "ai", "image"],
};

class imagen_node extends BaseNode {
  constructor() {
    super(config);
  }

  // Helper function to get value from inputs or contents
  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  estimateUsage(inputs, contents, serverData) {
    const Model = this.getValue(
      inputs,
      contents,
      "Model",
      "imagen-3.0-generate-002"
    );

    const modelPricing = {
      "imagen-4.0-generate-preview-06-06": 27,
      "imagen-4.0-fast-generate-preview-06-06": 14,
      "imagen-4.0-ultra-generate-preview-06-06": 40,
      "imagen-3.0-generate-002": 27,
      "imagen-3.0-generate-001": 27,
      "imagen-3.0-fast-generate-001": 14,
    };

    return modelPricing[Model] || config.credit; // Default to config credit if model isn't found
  }

  // --- Imagen API Helper Functions ---

  getAccessToken = (webconsole) => {
    webconsole.info("IMAGEN NODE | Obtaining Google Cloud access token");
    return new Promise((resolve, reject) => {
      exec("gcloud auth print-access-token", (error, stdout, stderr) => {
        if (error) {
          return reject(
            new Error(
              "Failed to get Google Cloud access token. Is gcloud CLI installed and authenticated? Error: " +
                error.message
            )
          );
        }
        resolve(stdout.trim());
      });
    });
  };

  generateImageWithImagen = async (
    accessToken,
    webconsole,
    PROJECT_ID,
    LOCATION_ID,
    API_ENDPOINT,
    MODEL_ID,
    Prompt,
    Seed,
    aspectRatio,
    imageFormat,
    imageQuality,
    peopleAllow
  ) => {
    const predictUrl = `https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:predict`;

    const requestBody = {
      instances: [
        {
          prompt: Prompt,
          ...(!Number.isNaN(Seed) && {
            seed: Math.max(0, Number.parseInt(Seed)),
          }),
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio,
        outputOptions: {
          mimeType: imageFormat,
          ...(imageFormat === "image/jpeg" && {
            compressionQuality: imageQuality,
          }),
        },
        personGeneration: peopleAllow,
        includeRaiReason: true,
      },
    };

    webconsole.info("IMAGEN NODE | Sending image generation request to Imagen");
    try {
      const response = await axios.post(predictUrl, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.data.predictions && response.data.predictions.length > 0) {
        const prediction = response.data.predictions[0];
        if (Object.keys(prediction).includes("raiFilterReason")) {
          webconsole.error(
            "IMAGEN NODE | Prompt got caught in Google's filter, rewrite the prompt."
          );
          return null; // Return null on filter
        }

        const imageContent = prediction.bytesBase64Encoded;
        if (!imageContent) {
          throw new Error(
            "imageContent field is missing or empty in Imagen response"
          );
        }

        webconsole.info(
          `IMAGEN NODE | Image generation completed successfully`
        );
        // Extract the file extension from the mimeType
        const extension = imageFormat.split("/").pop();
        return { imageContent, fileExtension: extension };
      } else {
        throw new Error("No predictions found in Imagen response");
      }
    } catch (error) {
      const errorMessage = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      throw new Error(`Error generating image with Imagen: ${errorMessage}`);
    }
  };

  saveImageFile = async (imageContent, extension, webconsole) => {
    if (!imageContent) {
      throw new Error("imageContent is undefined or null");
    }

    const tempDir = "./runtime_files";
    if (!(await fs.stat(tempDir).catch(() => null))) {
      await fs.mkdir(tempDir, { recursive: true });
    }
    const outputImageFilename = path.join(
      tempDir,
      `generated_image_${Date.now()}.${extension}`
    );

    webconsole.info(
      `IMAGEN NODE | Saving image file to ${outputImageFilename}`
    );

    try {
      const imageBuffer = Buffer.from(imageContent, "base64");
      await fs.writeFile(outputImageFilename, imageBuffer);
      webconsole.success(
        `IMAGEN NODE | Image successfully saved to ${outputImageFilename}`
      );
      return outputImageFilename;
    } catch (error) {
      throw new Error(`Error saving image file: ${error.message}`);
    }
  };

  // --- Unified Execution Method ---
  async executeImagenGeneration(
    {
      Prompt,
      Seed,
      Model,
      aspectRatio,
      peopleAllow,
      imageFormat,
      imageQuality,
    },
    webconsole,
    serverData
  ) {
    if (!Prompt) {
      throw new Error("No Prompt provided for image generation.");
    }

    const PROJECT_ID = process.env.IMAGEN_PROJECT_ID;
    const LOCATION_ID = process.env.IMAGEN_LOCATION_ID || "us-central1";
    const API_ENDPOINT =
      process.env.IMAGEN_API_ENDPOINT ||
      "us-central1-aiplatform.googleapis.com";
    const MODEL_ID = Model;

    if (!PROJECT_ID) {
      throw new Error(
        "IMAGEN_PROJECT_ID not set in environment variables. Cannot proceed."
      );
    }

    // Pre-processing
    const mimeType = imageFormat === "jpeg" ? "image/jpeg" : "image/png";
    const quality = Math.max(0, Math.min(Number.parseInt(imageQuality), 100));

    let imageFilePath = null;
    try {
      const accessToken = await this.getAccessToken(webconsole);

      const generationResult = await this.generateImageWithImagen(
        accessToken,
        webconsole,
        PROJECT_ID,
        LOCATION_ID,
        API_ENDPOINT,
        MODEL_ID,
        Prompt,
        Seed,
        aspectRatio,
        mimeType,
        quality,
        peopleAllow
      );

      if (!generationResult) {
        // Image was filtered by Google's RAI system
        return { "Image Link": null };
      }

      const { imageContent, fileExtension } = generationResult;
      imageFilePath = await this.saveImageFile(
        imageContent,
        fileExtension,
        webconsole
      );

      const imageFileMime = await fileTypeFromFile(imageFilePath);
      if (!imageFileMime || !imageFileMime.mime.startsWith("image/")) {
        throw new Error("The generated file is not a valid image file.");
      }

      const imageFileStream = (
        await fs.open(imageFilePath, "r")
      ).createReadStream();

      const { success, fileURL: uploadedUrl, message } = await serverData.s3Util.addFile(
        path.basename(imageFilePath),
        imageFileStream,
        imageFileMime.mime
      );
      await fs.unlink(imageFilePath);

      if (!success) {
        throw new Error(`Failed to upload image file to S3: ${message}`);
      }
      
      return { "Image Link": uploadedUrl };
    } catch (error) {
      // Clean up temporary file on error
      if (imageFilePath) {
        try {
          await fs.unlink(imageFilePath);
          webconsole.info(
            `IMAGEN NODE | Cleaned up temporary image file: ${imageFilePath}`
          );
        } catch (cleanupError) {
          // Ignore cleanup error
        }
      }
      throw error;
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("IMAGEN NODE | Starting execution");

    const Prompt = this.getValue(inputs, contents, "Prompt", "");
    const Seed = this.getValue(inputs, contents, "Seed", NaN);
    const Model = this.getValue(
      inputs,
      contents,
      "Model",
      "imagen-3.0-generate-002"
    );
    const aspectRatio = this.getValue(inputs, contents, "Ratio", "1:1");
    const peopleAllow = this.getValue(inputs, contents, "Person", "allow_all");
    const imageFormat = this.getValue(inputs, contents, "Image Format", "jpeg");
    const imageQuality = this.getValue(inputs, contents, "Image Quality", 75);

    // Calculate credit based on inputs
    const executionCredit = this.estimateUsage(inputs, contents, serverData);

    // Initial environment/input checks
    const PROJECT_ID = process.env.IMAGEN_PROJECT_ID;
    if (!PROJECT_ID) {
      this.setCredit(0);
      webconsole.error("IMAGEN NODE | IMAGEN_PROJECT_ID not set in .env file");
    }
    if (!Prompt) {
      this.setCredit(0);
      webconsole.error("IMAGEN NODE | No Prompt provided in node inputs.");
    }

    const modelOptions = [
      "imagen-4.0-generate-preview-06-06",
      "imagen-4.0-fast-generate-preview-06-06",
      "imagen-4.0-ultra-generate-preview-06-06",
      "imagen-3.0-generate-002",
      "imagen-3.0-generate-001",
      "imagen-3.0-fast-generate-001",
    ];

    const imagenImageTool = tool(
      async (
        {
          prompt,
          seed,
          model,
          aspectRatio,
          personGeneration,
          imageFormat,
          imageQuality,
        },
        toolConfig
      ) => {
        webconsole.info("IMAGEN IMAGE TOOL | Invoking tool");

        const toolInputs = [{ name: "Prompt", value: prompt }];
        const toolContents = [{ name: "Model", value: model }];
        const toolCredit = this.estimateUsage(
          toolInputs,
          toolContents,
          serverData
        );

        if (!process.env.IMAGEN_PROJECT_ID) {
          webconsole.error("IMAGEN IMAGE TOOL | IMAGEN_PROJECT_ID not set.");
          return [
            JSON.stringify({
              "Image Link": null,
              error: "IMAGEN_PROJECT_ID is not configured.",
            }),
            this.getCredit(),
          ];
        }

        try {
          const result = await this.executeImagenGeneration(
            {
              Prompt: prompt,
              Seed: seed,
              Model: model,
              aspectRatio: aspectRatio,
              peopleAllow: personGeneration,
              imageFormat: imageFormat,
              imageQuality: imageQuality,
            },
            webconsole,
            serverData
          );

          this.setCredit(this.getCredit() + toolCredit);
          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - toolCredit);
          webconsole.error(
            `IMAGEN IMAGE TOOL | Error during generation: ${error.message}`
          );
          return [
            JSON.stringify({ "Image Link": null, error: error.message }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "googleImagenImageGenerator",
        description:
          "Generates an AI image using Google's Imagen model based on a text prompt. Allows control over model quality, aspect ratio, output format (jpeg/png), and generation settings. Requires gcloud authentication.",
        schema: z.object({
          prompt: z
            .string()
            .min(1)
            .describe(
              "The detailed, descriptive text prompt for the image content."
            ),
          seed: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe(
              "A numerical seed value to ensure deterministic and reproducible results."
            ),
          model: z
            .enum(modelOptions)
            .default("imagen-3.0-generate-002")
            .describe(
              "The Imagen model to use (Fast models are cheaper and quicker)."
            ),
          aspectRatio: z
            .enum(["1:1", "9:16", "16:9", "3:4", "4:3"])
            .default("1:1")
            .describe("The aspect ratio of the generated image."),
          personGeneration: z
            .enum(["allow_adult", "allow_all", "dont_allow"])
            .default("allow_all")
            .describe(
              "Controls whether people (including adults) are allowed in the generated image."
            ),
          imageFormat: z
            .enum(["jpeg", "png"])
            .default("jpeg")
            .describe("The desired output file format for the image."),
          imageQuality: z
            .number()
            .int()
            .min(0)
            .max(100)
            .default(75)
            .optional()
            .describe(
              "The quality setting (0-100) for JPEG output (ignored for PNG)."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // Check if initial checks failed
    if (this.getCredit() === 0) {
      return {
        "Image Link": null,
        Tool: imagenImageTool,
        Credits: 0,
      };
    }

    // Set the credit for direct execution
    this.setCredit(executionCredit);

    // Direct execution
    try {
      const result = await this.executeImagenGeneration(
        {
          Prompt,
          Seed,
          Model,
          aspectRatio,
          peopleAllow,
          imageFormat,
          imageQuality,
        },
        webconsole,
        serverData
      );

      return {
        ...result,
        Credits: this.getCredit(),
        Tool: imagenImageTool,
      };
    } catch (error) {
      webconsole.error(
        `IMAGEN NODE | Error during direct execution: ${error.message}`
      );
      this.setCredit(0); // Refund credits on failure

      return {
        "Image Link": null,
        Credits: 0,
        Tool: imagenImageTool,
      };
    }
  }
}

export default imagen_node;
