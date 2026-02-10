import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Suno Music Gen",
  category: "GenAI",
  type: "suno_music_gen",
  icon: {},
  desc: "Generate music using Suno AI. Returns a Task ID to check status later.",
  credit: 65,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Description of the song or Lyrics (depending on mode)",
      name: "Prompt",
      type: "Text",
    },
    {
      desc: "Enable Custom Mode (Requires Style & Title)",
      name: "Custom Mode",
      type: "Boolean",
    },
    {
      desc: "Instrumental only (No lyrics)",
      name: "Instrumental",
      type: "Boolean",
    },
    {
      desc: "Music Style (Required for Custom Mode)",
      name: "Style",
      type: "Text",
    },
    {
      desc: "Song Title (Required for Custom Mode)",
      name: "Title",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The Task ID to track progress",
      name: "Task ID",
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
      desc: "Description or Lyrics",
      name: "Prompt",
      type: "TextArea",
      value: "A relaxing lofi beat...",
    },
    {
      desc: "Enable Custom Mode",
      name: "Custom Mode",
      type: "CheckBox",
      value: false,
    },
    {
      desc: "Instrumental",
      name: "Instrumental",
      type: "CheckBox",
      value: false,
    },
    {
      desc: "Music Style (Custom Mode only)",
      name: "Style",
      type: "TextArea",
      value: "",
    },
    {
      desc: "Song Title (Custom Mode only)",
      name: "Title",
      type: "TextArea",
      value: "",
    },
    {
      desc: "Model Version",
      name: "Model",
      type: "select",
      value: "V4",
      options: ["V4", "V4_5", "V4_5PLUS", "V5"],
    },
  ],
  difficulty: "medium",
  tags: ["suno", "music", "ai", "audio"],
};

class suno_music_gen extends BaseNode {
  constructor() {
    super(config);
  }

  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  async executeGenerate(prompt, customMode, instrumental, style, title, model, webconsole) {
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) throw new Error("Missing SUNO_API_KEY environment variable.");

    // Validation based on documentation
    if (customMode) {
      if (!style) throw new Error("Custom Mode requires a Style.");
      if (!title) throw new Error("Custom Mode requires a Title.");
      if (!instrumental && !prompt) throw new Error("Custom Mode (Non-instrumental) requires a Prompt (Lyrics).");
    } else {
      if (!prompt) throw new Error("Non-custom mode requires a Prompt.");
    }

    const payload = {
      customMode: customMode,
      instrumental: instrumental,
      model: model,
      callBackUrl: "https://example.com/callback",
    };

    if (customMode) {
      payload.style = style;
      payload.title = title;
      if (prompt) payload.prompt = prompt;
    } else {
      payload.prompt = prompt; 
    }

    webconsole.info(`SUNO GEN | Requesting generation with Model: ${model}`);

    try {
      const response = await fetch("https://api.sunoapi.org/api/v1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || data.message || "Unknown Suno API Error");
      }

      const taskId = data.data?.taskId;
      
      if (!taskId) throw new Error("No Task ID returned from Suno API.");
      
      webconsole.success(`SUNO GEN | Task created: ${taskId}`);
      return taskId;

    } catch (error) {
      throw new Error(`Suno Generation Failed: ${error.message}`);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("SUNO GEN | Begin execution");

    const prompt = this.getValue(inputs, contents, "Prompt", "");
    const customMode = this.getValue(inputs, contents, "Custom Mode", false);
    const instrumental = this.getValue(inputs, contents, "Instrumental", false);
    const style = this.getValue(inputs, contents, "Style", "");
    const title = this.getValue(inputs, contents, "Title", "");
    const model = this.getValue(inputs, contents, "Model", "V4");

    const sunoTool = tool(
      async ({ prompt, customMode, instrumental, style, title, model }, toolConfig) => {
        try {
          const taskId = await this.executeGenerate(prompt, customMode, instrumental, style, title, model, webconsole);
          return [JSON.stringify({ taskId: taskId }), this.getCredit()];
        } catch (error) {
          return [JSON.stringify({ error: error.message }), this.getCredit()];
        }
      },
      {
        name: "sunoMusicGenerator",
        description: "Generates music using Suno AI. Returns a Task ID which must be checked later for the actual audio URL.",
        schema: z.object({
          prompt: z.string().describe("Lyrics (if custom) or song description."),
          customMode: z.boolean().default(false).describe("Set true for specific style/title control."),
          instrumental: z.boolean().default(false).describe("True for no lyrics."),
          style: z.string().optional().describe("Music genre/style (Required if customMode is true)."),
          title: z.string().optional().describe("Song title (Required if customMode is true)."),
          model: z.enum(["V4", "V4_5", "V4_5PLUS", "V5"]).default("V4"),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    if (!prompt && !instrumental) {
       webconsole.info("SUNO GEN | Missing essential inputs, returning tool.");
       this.setCredit(0);
       return { "Task ID": null, Tool: sunoTool };
    }

    try {
      const taskId = await this.executeGenerate(prompt, customMode, instrumental, style, title, model, webconsole);
      return {
        "Task ID": taskId,
        Credits: this.getCredit(),
        Tool: sunoTool,
      };
    } catch (error) {
      webconsole.error("SUNO GEN | Error: " + error.message);
      return {
        "Task ID": null,
        Credits: this.getCredit(),
        Tool: sunoTool,
        Error: error.message,
      };
    }
  }
}

export default suno_music_gen;