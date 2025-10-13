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
  title: "Veo AI Video",
  category: "GenAI",
  type: "veo_node",
  icon: {},
  desc: "Generate AI videos using Google Veo ",
  credit: 2667,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Video generation prompt",
      name: "Prompt",
      type: "Text",
    },
    {
      desc: "Negative video generation prompt",
      name: "Negative Prompt",
      type: "Text",
    },
    {
      desc: "Duration of the video (only applicable for Veo2)",
      name: "Duration",
      type: "Number",
    },
    {
      desc: "Generate audio along with video (applicable only for Veo3)",
      name: "Generate Audio",
      type: "Boolean",
    },
  ],
  outputs: [
    {
      desc: "Temporary link to the video",
      name: "Video Link",
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
      desc: "Video generation prompt",
      name: "Prompt",
      type: "TextArea",
      value: "Enter text here...",
    },
    {
      desc: "Negative video generation prompt",
      name: "Negative Prompt",
      type: "TextArea",
      value: "Enter text here...",
    },
    {
      desc: "Duration of the video (only applicable for Veo2)",
      name: "Duration",
      type: "Slider",
      value: 6,
      min: 5,
      max: 8,
      step: 1,
    },
    {
      desc: "Model to be used for video generation",
      name: "Model",
      type: "select",
      value: "Veo3",
      options: ["Veo3", "Veo2"],
    },
    {
      desc: "Aspect ratio of the video (applicable only for Veo2)",
      name: "Ratio",
      type: "select",
      value: "16:9",
      options: ["16:9", "9:16"],
    },
    {
      desc: "Generate audio along with video (applicable only for Veo3)",
      name: "Generate Audio",
      type: "CheckBox",
      value: true,
    },
    {
      desc: "Should people be generated in the video",
      name: "Person",
      type: "select",
      value: "Allow adults",
      options: ["Allow adults", "Dont allow"],
    },
  ],
  difficulty: "medium",
  tags: ["veo", "google", "ai", "video"],
};

class veo_node extends BaseNode {
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
    const Model = this.getValue(inputs, contents, "Model", "Veo3");

    const DurationFilter = inputs.find((e) => e.name === "Duration");
    let Duration =
      DurationFilter?.value ||
      contents.find((e) => e.name === "Duration")?.value ||
      8;

    const Audio = this.getValue(inputs, contents, "Generate Audio", true);

    if (Model === "Veo3") {
      if (Audio) {
        return 4000;
      } else {
        return 2667;
      }
    } else {
      Duration = Math.max(5, Math.min(Duration, 8));
      return 334 * Duration;
    }
  }

  getAccessToken = (webconsole) => {
    webconsole.info("VEO NODE | Obtaining Google Cloud access token");
    return new Promise((resolve, reject) => {
      exec("gcloud auth print-access-token", (error, stdout, stderr) => {
        if (error) {
          webconsole.error(`VEO NODE | gcloud auth error: ${error.message}`);
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

  generateVideoWithVeo3 = async (
    accessToken,
    Model,
    Prompt,
    NegPrompt,
    Ratio,
    Duration,
    Person,
    Audio,
    webconsole
  ) => {
    const ModelDict = {
      Veo3: "veo-3.0-generate-preview",
      Veo2: "veo-2.0-generate-001",
    };
    const MODEL_ID = ModelDict[Model];
    const PROJECT_ID = process.env.VEO_PROJECT_ID;
    const LOCATION_ID = process.env.VEO_LOCATION_ID || "us-central1";
    const API_ENDPOINT =
      process.env.VEO_API_ENDPOINT || "us-central1-aiplatform.googleapis.com";

    const predictUrl = `https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:predictLongRunning`;

    const requestBody = {
      instances: [
        {
          prompt: Prompt,
        },
      ],
      parameters: {
        aspectRatio: Ratio,
        sampleCount: 1,
        durationSeconds: Duration,
        personGeneration: Person,
        addWatermark: true,
        includeRaiReason: true,
        generateAudio: Audio,
        negativePrompt: NegPrompt,
      },
    };

    webconsole.info("VEO NODE | Sending video generation request...");
    try {
      const response = await axios.post(predictUrl, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const operationName = response.data.name;
      webconsole.info(
        `VEO NODE | Video generation initiated. Operation ID: ${operationName
          .split("/")
          .at(-1)}`
      );
      return operationName;
    } catch (error) {
      const errorMessage = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      throw new Error(`Error initiating video generation: ${errorMessage}`);
    }
  };

  pollVeo3Operation = async (accessToken, operationName, webconsole) => {
    const PROJECT_ID = process.env.VEO_PROJECT_ID;
    const LOCATION_ID = process.env.VEO_LOCATION_ID || "us-central1";
    const API_ENDPOINT =
      process.env.VEO_API_ENDPOINT || "us-central1-aiplatform.googleapis.com";
    const MODEL_ID = "veo-3.0-generate-preview";
    const POLLING_INTERVAL_MS = 10000;
    const POLLING_TIMEOUT_MS = 30 * 60 * 1000;

    const pollUrl = `https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:fetchPredictOperation`;
    const startTime = Date.now();
    const tempDir = "./runtime_files";
    if (!(await fs.stat(tempDir).catch(() => null))) {
      await fs.mkdir(tempDir, { recursive: true });
    }
    const outputVideoFilename = path.join(
      tempDir,
      `generated_video_${Date.now()}.mp4`
    );

    webconsole.info(`VEO NODE | Polling operation`);

    while (Date.now() - startTime < POLLING_TIMEOUT_MS) {
      try {
        const response = await axios.post(
          pollUrl,
          { operationName: operationName },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json; charset=utf-8",
            },
          }
        );

        const operation = response.data;

        if (operation.done) {
          if (operation.error) {
            throw new Error(
              `Veo operation failed: ${JSON.stringify(operation.error)}`
            );
          }
          if (
            operation.response &&
            operation.response.videos &&
            operation.response.videos.length > 0
          ) {
            const video = operation.response.videos[0];
            if (video.bytesBase64Encoded) {
              const videoBuffer = Buffer.from(
                video.bytesBase64Encoded,
                "base64"
              );
              await fs.writeFile(outputVideoFilename, videoBuffer);
              webconsole.success(
                `VEO NODE | Video successfully saved to ${outputVideoFilename}`
              );
              return outputVideoFilename;
            }
          }
          throw new Error(
            "Veo operation done, but no video data found in response."
          );
        } else {
          webconsole.info(`VEO NODE | Operation still in progress...`);
        }
      } catch (error) {
        const errorMessage = error.response
          ? JSON.stringify(error.response.data)
          : error.message;
        throw new Error(`Error polling Veo operation: ${errorMessage}`);
      }

      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
    }

    throw new Error(
      `Veo operation timed out after ${POLLING_TIMEOUT_MS / 60000} minutes.`
    );
  };

  async executeVeoGeneration(
    { Prompt, NegPrompt, Model, Duration, Audio, Ratio, PersonFilter },
    webconsole,
    serverData
  ) {
    if (!Prompt) {
      throw new Error("No Prompt provided for video generation.");
    }

    const PROJECT_ID = process.env.VEO_PROJECT_ID;
    if (!PROJECT_ID) {
      throw new Error(
        "VEO_PROJECT_ID not set in environment variables. Cannot proceed."
      );
    }

    // Apply model-specific overrides and set parameters
    let finalDuration = Duration;
    let finalAudio = Audio;
    let finalRatio = Ratio;
    const Person =
      PersonFilter == "Allow adults" ? "allow_adult" : "dont_allow";

    if (Model === "Veo3") {
      finalDuration = 8; // Veo3 is fixed at 8s
      finalRatio = "16:9"; // Veo3 ratio is usually fixed or determined internally
    } else {
      // Veo2
      finalDuration = Math.max(5, Math.min(Duration, 8)); // Clip duration for Veo2
      finalAudio = false; // Audio is not generated for Veo2
    }

    let videoFilePath = null;
    try {
      const accessToken = await this.getAccessToken(webconsole);
      const operationId = await this.generateVideoWithVeo3(
        accessToken,
        Model,
        Prompt,
        NegPrompt,
        finalRatio,
        finalDuration,
        Person,
        finalAudio,
        webconsole
      );
      videoFilePath = await this.pollVeo3Operation(
        accessToken,
        operationId,
        webconsole
      );

      if (!videoFilePath) {
        throw new Error(
          "Video generation completed, but failed to retrieve the final file path."
        );
      }

      const videoFileMime = await fileTypeFromFile(videoFilePath);
      if (!videoFileMime || !videoFileMime.mime.startsWith("video/")) {
        throw new Error("The generated file is not a valid video file.");
      }

      const videoFileStream = await fs.open(videoFilePath, "r");

      // Assuming s3Util.addFile exists and returns the permanent URL
      const uploadedUrl = await serverData.s3Util.addFile(
        path.basename(videoFilePath),
        videoFileStream.createReadStream(),
        videoFileMime.mime
      );

      // Close file stream and delete temporary file
      await videoFileStream.close();
      await fs.unlink(videoFilePath);

      return { "Video Link": uploadedUrl };
    } catch (error) {
      // Clean up temporary file on error
      if (videoFilePath) {
        try {
          await fs.unlink(videoFilePath);
          webconsole.info(
            `VEO NODE | Cleaned up temporary video file: ${videoFilePath}`
          );
        } catch (cleanupError) {
          // Ignore cleanup error
        }
      }
      throw error;
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("VEO NODE | Starting configuration");

    const Prompt = this.getValue(inputs, contents, "Prompt", "");
    const NegPrompt = this.getValue(inputs, contents, "Negative Prompt", "");
    const Duration = this.getValue(inputs, contents, "Duration", 8);
    const Audio = this.getValue(inputs, contents, "Generate Audio", true);
    const Model = this.getValue(inputs, contents, "Model", "Veo3");
    const Ratio = this.getValue(inputs, contents, "Ratio", "16:9");
    const PersonFilter = this.getValue(
      inputs,
      contents,
      "Person",
      "Allow adults"
    );
    const executionCredit = this.estimateUsage(inputs, contents, serverData);

    // Initial check for required inputs and environment variables
    const PROJECT_ID = process.env.VEO_PROJECT_ID;
    if (!PROJECT_ID) {
      this.setCredit(0);
      webconsole.error("VEO NODE | VEO_PROJECT_ID not set in .env file");
    }

    if (!Prompt) {
      this.setCredit(0);
      webconsole.error("VEO NODE | No Prompt provided in node inputs.");
    }

    const ModelDict = { Veo3: true, Veo2: true };
    if (!Object.keys(ModelDict).includes(Model)) {
      this.setCredit(0);
      webconsole.error("VEO NODE | Unknown model selected in node inputs.");
    }

    const veoVideoTool = tool(
      async (
        {
          prompt,
          negativePrompt,
          model,
          duration,
          aspectRatio,
          generateAudio,
          personGeneration,
        },
        toolConfig
      ) => {
        webconsole.info("VEO VIDEO TOOL | Invoking tool");

        const toolCredit = this.estimateUsage(
          [
            { name: "Duration", value: duration },
            { name: "Generate Audio", value: generateAudio },
          ],
          [{ name: "Model", value: model }],
          serverData
        );

        if (!process.env.VEO_PROJECT_ID) {
          webconsole.error("VEO VIDEO TOOL | VEO_PROJECT_ID not set.");
          return [
            JSON.stringify({
              "Video Link": null,
              error: "VEO_PROJECT_ID is not configured.",
            }),
            this.getCredit(),
          ];
        }

        try {
          const result = await this.executeVeoGeneration(
            {
              Prompt: prompt,
              NegPrompt: negativePrompt || "",
              Model: model,
              Duration: duration,
              Audio: generateAudio,
              Ratio: aspectRatio,
              PersonFilter: personGeneration,
            },
            webconsole,
            serverData
          );

          this.setCredit(this.getCredit() + toolCredit);
          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - toolCredit);
          webconsole.error(
            `VEO VIDEO TOOL | Error during generation: ${error.message}`
          );
          return [
            JSON.stringify({ "Video Link": null, error: error.message }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "googleVeoVideoGenerator",
        description:
          "Generates an AI video using Google's Veo model based on a text prompt. This is a long-running operation. Note: Veo3 always generates 8s video; Veo2 allows 5-8s duration.",
        schema: z.object({
          prompt: z
            .string()
            .min(1)
            .describe(
              "The detailed, descriptive text prompt for the video content."
            ),
          negativePrompt: z
            .string()
            .optional()
            .describe(
              "Prompt describing content to explicitly avoid in the generated video."
            ),
          model: z
            .enum(["Veo3", "Veo2"])
            .default("Veo3")
            .describe(
              "The Veo model to use (Veo3 is the latest, recommended model)."
            ),
          duration: z
            .number()
            .int()
            .min(5)
            .max(8)
            .default(8)
            .optional()
            .describe(
              "The video duration in seconds. Only effective with Veo2 (5-8s)."
            ),
          aspectRatio: z
            .enum(["16:9", "9:16"])
            .default("16:9")
            .optional()
            .describe(
              "The video aspect ratio (16:9 for landscape, 9:16 for portrait). Only effective with Veo2."
            ),
          generateAudio: z
            .boolean()
            .default(true)
            .optional()
            .describe(
              "Whether to generate sound effects and music for the video (only applies to Veo3)."
            ),
          personGeneration: z
            .enum(["Allow adults", "Dont allow"])
            .default("Allow adults")
            .optional()
            .describe(
              "Controls whether adults or people are allowed in the generated content."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // If initial checks failed, return with 0 credits and the tool
    if (this.getCredit() === 0) {
      return {
        "Video Link": null,
        Tool: veoVideoTool,
        Credits: 0,
      };
    }

    // Set the estimated credit for direct execution
    this.setCredit(executionCredit);

    // Direct execution
    try {
      const result = await this.executeVeoGeneration(
        {
          Prompt,
          NegPrompt,
          Model,
          Duration,
          Audio,
          Ratio,
          PersonFilter,
        },
        webconsole,
        serverData
      );

      return {
        ...result,
        Credits: this.getCredit(),
        Tool: veoVideoTool,
      };
    } catch (error) {
      webconsole.error(
        `VEO NODE | Error during direct execution: ${error.message}`
      );
      this.setCredit(0); // Refund credits on failure

      return {
        "Video Link": null,
        Credits: 0,
        Tool: veoVideoTool,
      };
    }
  }
}

export default veo_node;
