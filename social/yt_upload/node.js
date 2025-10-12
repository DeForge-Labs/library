import BaseNode from "../../core/BaseNode/node.js";
import { google } from "googleapis";
import { Downloader } from "nodejs-file-downloader";
import dotenv from "dotenv";
import fs from "fs";
import { fileTypeFromFile } from "file-type";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config();

const config = {
  title: "YouTube Upload",
  category: "social",
  type: "yt_upload",
  icon: {},
  desc: "Upload videos to your YouTube channel",
  credit: 0,
  inputs: [
    {
      desc: "Link to the video to upload",
      name: "Link",
      type: "Text",
    },
    {
      desc: "Title of the video to upload",
      name: "Title",
      type: "Text",
    },
    {
      desc: "Description of the video to upload",
      name: "Description",
      type: "Text",
    },
    {
      desc: "Tags for the video to upload (Comma separated list of tags)",
      name: "Tags",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The link of the uploaded video",
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
      desc: "Link to the video to upload",
      name: "Link",
      type: "Text",
      value: "Enter text here...",
    },
    {
      desc: "Title of the video to upload",
      name: "Title",
      type: "Text",
      value: "Enter text here...",
    },
    {
      desc: "Description of the video to upload",
      name: "Description",
      type: "TextArea",
      value: "Enter text here...",
    },
    {
      desc: "Tags for the video to upload (Comma separated list of tags)",
      name: "Tags",
      type: "Text",
      value: "Enter tags here...",
    },
    {
      desc: "The category of the video",
      name: "Category",
      type: "select",
      value: "People & Blogs",
      options: [
        "Autos & Vehicles",
        "Comedy",
        "Education",
        "Enterntainment",
        "Film & Animation",
        "Gaming",
        "Howto & Style",
        "Music",
        "News & Politics",
        "Nonprofits & Activism",
        "People & Blogs",
        "Pets & Animals",
        "Science & Technology",
        "Sports",
        "Travel & Events",
      ],
    },
    {
      desc: "The privacy status of the video",
      name: "Privacy",
      type: "select",
      value: "Public",
      options: ["Public", "Private", "Unlisted"],
    },
    {
      desc: "Connect to your YouTube account",
      name: "YouTube",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["youtube", "video", "upload", "social"],
};

class yt_upload extends BaseNode {
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

  /**
   * @override
   * @inheritdoc
   * * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs
   * @param {import("../../core/BaseNode/node.js").Contents[]} contents
   * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole
   * @param {import("../../core/BaseNode/node.js").IServerData} serverData
   */
  async run(inputs, contents, webconsole, serverData) {
    // 4. Create the Tool
    const ytUploadTool = tool(
      async (
        { videoLink, title, description, tags, category, privacy },
        toolConfig
      ) => {
        webconsole.info("YOUTUBE UPLOAD TOOL | Invoking tool");

        // Simulation of the result for the LLM agent
        const result = {
          status: "Awaiting execution",
          action: `Attempting to upload video "${title}" to YouTube with privacy set to ${privacy}.`,
          videoLink:
            "https://www.youtube.com/watch?v=VIDEO_ID_PENDING_EXECUTION",
        };

        return [JSON.stringify(result), this.getCredit()];
      },
      {
        name: "youtubeVideoUploader",
        description:
          "Uploads a video to the connected YouTube channel from a public URL. Requires a video file link, title, and preferred category/privacy settings.",
        schema: z.object({
          videoLink: z
            .string()
            .url()
            .describe(
              "The public URL of the video file to be downloaded and uploaded."
            ),
          title: z
            .string()
            .min(1)
            .max(100)
            .describe("The title of the YouTube video (max 100 characters)."),
          description: z
            .string()
            .optional()
            .describe("The description/caption for the video."),
          tags: z
            .string()
            .optional()
            .describe(
              "A comma-separated string of tags (e.g., 'vlog, daily, tech') to apply to the video."
            ),
          category: z
            .enum([
              "Autos & Vehicles",
              "Comedy",
              "Education",
              "Enterntainment",
              "Film & Animation",
              "Gaming",
              "Howto & Style",
              "Music",
              "News & Politics",
              "Nonprofits & Activism",
              "People & Blogs",
              "Pets & Animals",
              "Science & Technology",
              "Sports",
              "Travel & Events",
            ])
            .default("People & Blogs")
            .describe("The YouTube category for the video."),
          privacy: z
            .enum(["Public", "Private", "Unlisted"])
            .default("Public")
            .describe("The privacy setting for the uploaded video."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    webconsole.info("YOUTUBE UPLOAD NODE | Starting configuration");

    const Link = this.getValue(inputs, contents, "Link", "");
    const Title = this.getValue(inputs, contents, "Title", "");
    const Description = this.getValue(inputs, contents, "Description", "");
    const Tags = this.getValue(inputs, contents, "Tags", "");
    const Category = this.getValue(
      inputs,
      contents,
      "Category",
      "People & Blogs"
    );
    const Privacy = this.getValue(inputs, contents, "Privacy", "Public");

    if (!Link || !Title) {
      webconsole.error(`YOUTUBE UPLOAD NODE | Video link or/and title missing`);
      return { "Video Link": null, Tool: ytUploadTool }; // Return tool on error
    }

    const tokens = serverData.socialList;
    if (!Object.keys(tokens).includes("youtube")) {
      webconsole.error(
        "YOUTUBE UPLOAD NODE | Please connect your youtube account"
      );
      return { "Video Link": null, Tool: ytUploadTool }; // Return tool on error
    }

    const yt_token = tokens["youtube"];
    if (!yt_token) {
      webconsole.error(
        "YOUTUBE UPLOAD NODE | Some error occured, please reconnect your youtube account"
      );
      return { "Video Link": null, Tool: ytUploadTool }; // Return tool on error
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GCP_CLIENT_ID,
      process.env.GCP_CLIENT_SECRET,
      process.env.GCP_REDIRECT_URL
    );

    oauth2Client.setCredentials(yt_token);
    const service = google.youtube("v3");

    // YouTube Category IDs
    const categoryList = {
      "Autos & Vehicles": 2,
      Comedy: 34,
      Education: 27,
      Enterntainment: 24,
      "Film & Animation": 1,
      Gaming: 20,
      "Howto & Style": 26,
      Music: 10,
      "News & Politics": 25,
      "Nonprofits & Activism": 29,
      "People & Blogs": 22,
      "Pets & Animals": 15,
      "Science & Technology": 28,
      Sports: 42,
      "Travel & Events": 19,
    };

    const tempDir = "./runtime_files";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // --- Video Download ---
    webconsole.info("YOUTUBE UPLOAD NODE | Downloading video...");
    const downloader = new Downloader({
      url: Link,
      directory: tempDir,
    });

    let filePath = null;
    try {
      const downloadResult = await downloader.download();
      filePath = downloadResult.filePath;
      if (!filePath) {
        webconsole.error("YOUTUBE UPLOAD NODE | Video download failed.");
        return { "Video Link": null, Tool: ytUploadTool };
      }
      webconsole.info(`YOUTUBE UPLOAD NODE | Video downloaded`);

      const fileType = await fileTypeFromFile(filePath);
      if (!fileType || !fileType.mime.startsWith("video/")) {
        webconsole.error(
          "YOUTUBE UPLOAD NODE | The downloaded file is not a valid video file."
        );
        fs.unlinkSync(filePath);
        return { "Video Link": null, Tool: ytUploadTool };
      }

      webconsole.info("YOUTUBE UPLOAD NODE | Uploading to YouTube...");

      const videoCategory = categoryList[Category];

      // --- Video Upload ---
      const response = await service.videos.insert({
        auth: oauth2Client,
        part: "snippet,status",
        requestBody: {
          snippet: {
            title: Title,
            description: Description,
            tags: Tags.split(",").map((tag) => tag.trim()),
            categoryId: videoCategory,
          },
          status: {
            privacyStatus: Privacy.toLowerCase(),
          },
        },
        media: {
          body: fs.createReadStream(filePath),
        },
      });

      // Clean up downloaded file
      fs.unlinkSync(filePath);

      if (response.data.id) {
        const videoLink = `https://www.youtube.com/watch?v=${response.data.id}`;
        webconsole.success(
          `YOUTUBE UPLOAD NODE | Video uploaded successfully: ${videoLink}`
        );
        return {
          "Video Link": videoLink,
          Credits: this.getCredit(),
          Tool: ytUploadTool,
        };
      } else {
        webconsole.error(
          "YOUTUBE UPLOAD NODE | Failed to upload video to YouTube."
        );
        return { "Video Link": null, Tool: ytUploadTool };
      }
    } catch (error) {
      webconsole.error(
        `YOUTUBE UPLOAD NODE | An error occurred: ${error.message}`
      );
      // Ensure file is deleted on error
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return { "Video Link": null, Tool: ytUploadTool }; // Return tool on API error
    }
  }
}

export default yt_upload;
