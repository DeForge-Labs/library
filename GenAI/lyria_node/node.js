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
  title: "Lyria AI Music",
  category: "GenAI",
  type: "lyria_node",
  icon: {},
  desc: "Generate AI music using Google Lyria",
  credit: 40,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Music generation prompt",
      name: "Prompt",
      type: "Text",
    },
    {
      desc: "Negative music generation prompt",
      name: "Negative Prompt",
      type: "Text",
    },
    {
      desc: "Seed value for generation (optional)",
      name: "Seed",
      type: "Number",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      desc: "Temporary link to the audio",
      name: "Audio Link",
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
      desc: "Music generation prompt",
      name: "Prompt",
      type: "TextArea",
      value: "Enter text here...",
    },
    {
      desc: "Negative music generation prompt",
      name: "Negative Prompt",
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
      desc: "Model to be used for music generation",
      name: "Model",
      type: "select",
      value: "lyria-002",
      options: ["lyria-002"],
    },
  ],
  difficulty: "easy",
  tags: ["lyria", "google", "ai", "music"],
};

class lyria_node extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    // Lyria credit is currently fixed per generation
    return config.credit;
  }

  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  // --- Lyria API Helper Functions ---

  getAccessToken = (webconsole) => {
    webconsole.info("LYRIA NODE | Obtaining Google Cloud access token");
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

  generateMusicWithLyria = async (
    accessToken,
    Model,
    Prompt,
    NegPrompt,
    Seed,
    webconsole
  ) => {
    const PROJECT_ID = process.env.LYRIA_PROJECT_ID;
    const LOCATION_ID = process.env.LYRIA_LOCATION_ID || "us-central1";
    const API_ENDPOINT =
      process.env.LYRIA_API_ENDPOINT || "us-central1-aiplatform.googleapis.com";
    const MODEL_ID = Model;

    const predictUrl = `https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:predict`;

    const requestBody = {
      instances: [
        {
          prompt: Prompt,
          negative_prompt: NegPrompt,
          ...(!Number.isNaN(Seed) && { seed: Number.parseInt(Seed) }),
        },
      ],
    };

    webconsole.info("LYRIA NODE | Sending music generation request to Lyria");
    try {
      const response = await axios.post(predictUrl, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.data.predictions && response.data.predictions.length > 0) {
        const audioContent = response.data.predictions[0].bytesBase64Encoded;
        if (!audioContent) {
          throw new Error(
            "audioContent field is missing or empty in Lyria response"
          );
        }
        webconsole.info(`LYRIA NODE | Music generation completed successfully`);
        return audioContent;
      } else {
        throw new Error("No predictions found in Lyria response");
      }
    } catch (error) {
      const errorMessage = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      throw new Error(`Error generating music with Lyria: ${errorMessage}`);
    }
  };

  saveAudioFile = async (audioContent, webconsole) => {
    if (!audioContent) {
      throw new Error("audioContent is undefined or null");
    }

    const tempDir = "./runtime_files";
    if (!(await fs.stat(tempDir).catch(() => null))) {
      await fs.mkdir(tempDir, { recursive: true });
    }
    const outputAudioFilename = path.join(
      tempDir,
      `generated_audio_${Date.now()}.wav`
    );

    webconsole.info(`LYRIA NODE | Saving audio file to ${outputAudioFilename}`);

    try {
      const audioBuffer = Buffer.from(audioContent, "base64");
      await fs.writeFile(outputAudioFilename, audioBuffer);
      webconsole.success(
        `LYRIA NODE | Audio successfully saved to ${outputAudioFilename}`
      );
      return outputAudioFilename;
    } catch (error) {
      throw new Error(`Error saving audio file: ${error.message}`);
    }
  };

  // --- Unified Execution Method ---
  async executeLyriaGeneration(
    { Prompt, NegPrompt, Seed, Model },
    webconsole,
    serverData
  ) {
    if (!Prompt) {
      throw new Error("No Prompt provided for music generation.");
    }

    const PROJECT_ID = process.env.LYRIA_PROJECT_ID;
    if (!PROJECT_ID) {
      throw new Error(
        "LYRIA_PROJECT_ID not set in environment variables. Cannot proceed."
      );
    }

    let audioFilePath = null;
    try {
      const accessToken = await this.getAccessToken(webconsole);
      const audioContent = await this.generateMusicWithLyria(
        accessToken,
        Model,
        Prompt,
        NegPrompt,
        Seed,
        webconsole
      );
      audioFilePath = await this.saveAudioFile(audioContent, webconsole);

      const audioFileMime = await fileTypeFromFile(audioFilePath);
      if (!audioFileMime || !audioFileMime.mime.startsWith("audio/")) {
        throw new Error("The generated file is not a valid audio file.");
      }

      const audioFileStream = (
        await fs.open(audioFilePath, "r")
      ).createReadStream();

      const { success, fileURL, message } = await serverData.s3Util.addFile(
        path.basename(audioFilePath),
        audioFileStream,
        audioFileMime.mime
      );

      if (!success) {
        throw new Error(`Failed to upload audio file to S3: ${message}`);
      }
      await fs.unlink(audioFilePath);

      return { "Audio Link": fileURL };
    } catch (error) {
      // Clean up temporary file on error
      if (audioFilePath) {
        try {
          await fs.unlink(audioFilePath);
          webconsole.info(
            `LYRIA NODE | Cleaned up temporary audio file: ${audioFilePath}`
          );
        } catch (cleanupError) {
          // Ignore cleanup error
        }
      }
      throw error;
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("LYRIA NODE | Starting execution");

    const executionCredit = this.estimateUsage(inputs, contents, serverData);

    const Prompt = this.getValue(inputs, contents, "Prompt", "");
    const NegPrompt = this.getValue(inputs, contents, "Negative Prompt", "");
    const Seed = this.getValue(inputs, contents, "Seed", NaN);
    const Model = this.getValue(inputs, contents, "Model", "lyria-002");

    // Initial environment/input checks
    const PROJECT_ID = process.env.LYRIA_PROJECT_ID;
    if (!PROJECT_ID) {
      this.setCredit(0);
      webconsole.error("LYRIA NODE | LYRIA_PROJECT_ID not set in .env file");
    }
    if (!Prompt) {
      this.setCredit(0);
      webconsole.error("LYRIA NODE | No Prompt provided in node inputs.");
    }

    const lyriaMusicTool = tool(
      async ({ prompt, negativePrompt, seed, model }, toolConfig) => {
        webconsole.info("LYRIA MUSIC TOOL | Invoking tool");

        const toolCredit = this.estimateUsage(inputs, contents, serverData);

        if (!process.env.LYRIA_PROJECT_ID) {
          webconsole.error("LYRIA MUSIC TOOL | LYRIA_PROJECT_ID not set.");
          return [
            JSON.stringify({
              "Audio Link": null,
              error: "LYRIA_PROJECT_ID is not configured.",
            }),
            this.getCredit(),
          ];
        }

        try {
          const result = await this.executeLyriaGeneration(
            {
              Prompt: prompt,
              NegPrompt: negativePrompt || "",
              Seed: seed,
              Model: model,
            },
            webconsole,
            serverData
          );

          this.setCredit(this.getCredit() + toolCredit);
          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - toolCredit);
          webconsole.error(
            `LYRIA MUSIC TOOL | Error during generation: ${error.message}`
          );
          return [
            JSON.stringify({ "Audio Link": null, error: error.message }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "googleLyriaMusicGenerator",
        description:
          "Generates an original piece of AI music (audio file) using Google's Lyria model based on a text prompt describing the desired music style, mood, and instrumentation. Requires gcloud authentication.",
        schema: z.object({
          prompt: z
            .string()
            .min(1)
            .describe(
              "The detailed, descriptive text prompt for the music (e.g., 'A dramatic orchestral score with fast strings and heavy brass, suitable for a movie trailer')."
            ),
          negativePrompt: z
            .string()
            .optional()
            .describe(
              "Prompt describing musical elements to explicitly avoid in the generated audio."
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
            .enum(["lyria-002"])
            .default("lyria-002")
            .describe("The Lyria model version to use."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // Check if initial checks failed
    if (this.getCredit() === 0) {
      return {
        "Audio Link": null,
        Tool: lyriaMusicTool,
        Credits: 0,
      };
    }

    // Set the credit for direct execution
    this.setCredit(executionCredit);

    // Direct execution
    try {
      const result = await this.executeLyriaGeneration(
        {
          Prompt,
          NegPrompt,
          Seed,
          Model,
        },
        webconsole,
        serverData
      );

      return {
        ...result,
        Credits: this.getCredit(),
        Tool: lyriaMusicTool,
      };
    } catch (error) {
      webconsole.error(
        `LYRIA NODE | Error during direct execution: ${error.message}`
      );
      this.setCredit(0); // Refund credits on failure

      return {
        "Audio Link": null,
        Credits: 0,
        Tool: lyriaMusicTool,
      };
    }
  }
}

export default lyria_node;
