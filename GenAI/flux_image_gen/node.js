import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Flux Image Gen",
  category: "GenAI", 
  type: "flux_image_gen",
  icon: {},
  desc: "Generate images using Flux AI.",
  credit: 65,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The image description",
      name: "Prompt",
      type: "Text",
    },
    {
      desc: "Random seed for generation",
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
      desc: "The generated image URL",
      name: "Image URL",
      type: "Text",
    },
    {
      desc: "The tool version of this node",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "The image description",
      name: "Prompt",
      type: "Text",
      value: "A futuristic city...",
    },
    {
      desc: "Image resolution",
      name: "Resolution",
      type: "select",
      value: "1024x768",
      options: ["1024x768", "1600x800", "1920x1080"],
    },
    {
      desc: "Random seed (optional)",
      name: "Seed",
      type: "Number",
      value: 42,
    },
  ],
  difficulty: "medium",
  tags: ["image", "flux", "ai", "generation"],
};

class flux_image_gen extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * Helper to get values from inputs/contents
   */
  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  /**
   * Helper to parse resolution string into width/height
   */
  parseResolution(resolutionStr) {
    if (!resolutionStr || typeof resolutionStr !== "string") {
      return { width: 1024, height: 768 }; 
    }
    const parts = resolutionStr.split("x");
    if (parts.length === 2) {
      return {
        width: parseInt(parts[0], 10),
        height: parseInt(parts[1], 10),
      };
    }
    return { width: 1024, height: 768 };
  }

  /**
   * Execute Flux Generation logic (Task + Polling)
   */
  async executeFluxGeneration(prompt, resolution, seed, webconsole) {
    // 1. Validate API Key
    const apiKey = process.env.FLUX_API_KEY;
    if (!apiKey) {
      throw new Error("Missing FLUX_API_KEY in environment variables.");
    }

    if (!prompt) throw new Error("Prompt is required.");

    const { width, height } = this.parseResolution(resolution);
    
    const body = {
      prompt: prompt,
      width: width,
      height: height,
      steps: 28,
      prompt_upsampling: false,
      seed: Number(seed) || 42,
      guidance: 5,
      safety_tolerance: 2,
      output_format: "jpeg",
    };

    webconsole.info(`FLUX GEN | Requesting generation: ${width}x${height}`);

    let pollingUrl;
    try {
      const response = await fetch("https://api.bfl.ai/v1/flux-dev", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Flux API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      pollingUrl = data.polling_url;
      
      webconsole.info(`FLUX GEN | Task initiated. Polling URL received.`);
    } catch (error) {
      throw new Error(`Failed to initiate Flux generation: ${error.message}`);
    }

    let tries = 0;
    const maxTries = 20; 
    
    while (tries < maxTries) {
      try {
        const pollResponse = await fetch(pollingUrl, {
            method: "GET",
            headers: {
                "x-key": apiKey
            }
        });
        
        if (!pollResponse.ok) {
           console.warn("Polling request failed, retrying...");
        } else {
            const pollData = await pollResponse.json();

            if (pollData.status === "Ready") {
                webconsole.success("FLUX GEN | Image ready.");
                return pollData.result.sample; 
            } else if (pollData.status === "Failed") {
                throw new Error("Flux generation status returned Failed.");
            }
        }

      } catch (e) {
         webconsole.error(`FLUX GEN | Polling error: ${e.message}`);
      }

      tries++;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error("Flux generation timed out.");
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("FLUX GEN | Begin execution");

    const prompt = this.getValue(inputs, contents, "Prompt", "");
    const resolution = this.getValue(inputs, contents, "Resolution", "1280x720");
    const seed = this.getValue(inputs, contents, "Seed", 42);

    const fluxTool = tool(
      async ({ prompt, resolution, seed }, toolConfig) => {
        webconsole.info("FLUX TOOL | Invoking tool");
        try {
          const resultUrl = await this.executeFluxGeneration(
            prompt,
            resolution,
            seed,
            webconsole
          );
          return [JSON.stringify({ imageUrl: resultUrl }), this.getCredit()];
        } catch (error) {
          webconsole.error(`FLUX TOOL | Error: ${error.message}`);
          return [JSON.stringify({ error: error.message }), this.getCredit()];
        }
      },
      {
        name: "fluxImageGenerator",
        description: "Generates an image using Flux AI based on a text prompt. Returns a URL to the generated image.",
        schema: z.object({
          prompt: z.string().describe("The detailed text description of the image to generate."),
          resolution: z.enum(["1280x720", "1600x800", "1920x1080"])
            .default("1280x720")
            .describe("The resolution of the output image."),
          seed: z.number().default(42).describe("The random seed for generation."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    if (!prompt) {
      webconsole.info("FLUX GEN | Prompt missing, returning tool only");
      this.setCredit(0);
      return {
        "Image URL": null,
        Tool: fluxTool,
      };
    }

    try {
      const imageUrl = await this.executeFluxGeneration(
        prompt,
        resolution,
        seed,
        webconsole
      );

      return {
        "Image URL": imageUrl,
        Credits: this.getCredit(),
        Tool: fluxTool,
      };
    } catch (error) {
      webconsole.error("FLUX GEN | Error: " + error.message);
      return {
        "Image URL": null,
        Credits: this.getCredit(),
        Tool: fluxTool,
        Error: error.message,
      };
    }
  }
}

export default flux_image_gen;