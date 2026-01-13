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
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
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

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  async executeYoutubeUpload(
    Link,
    Title,
    Description,
    Tags,
    Category,
    Privacy,
    yt_token,
    webconsole
  ) {
    if (!Link || !Title) {
      throw new Error("Video link and title are required for upload.");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GCP_CLIENT_ID,
      process.env.GCP_CLIENT_SECRET,
      process.env.GCP_REDIRECT_URL
    );

    // This node does not implement token refresh, assuming the token passed is valid.
    // Errors will be caught below if authorization fails.
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
    const videoCategory = categoryList[Category];

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
        throw new Error("Video download failed. File path is null.");
      }
      webconsole.info(`YOUTUBE UPLOAD NODE | Video downloaded`);

      const fileType = await fileTypeFromFile(filePath);
      if (!fileType || !fileType.mime.startsWith("video/")) {
        throw new Error("The downloaded file is not a valid video file.");
      }

      webconsole.info("YOUTUBE UPLOAD NODE | Uploading to YouTube...");

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

      if (response.data.id) {
        const videoLink = `https://www.youtube.com/watch?v=${response.data.id}`;
        webconsole.success(
          `YOUTUBE UPLOAD NODE | Video uploaded successfully: ${videoLink}`
        );
        return { "Video Link": videoLink };
      } else {
        throw new Error(
          "Failed to upload video to YouTube (no video ID returned)."
        );
      }
    } catch (error) {
      // Clean up downloaded file on error
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      // Re-throw the error for the caller's try/catch block
      throw error;
    }
  }

  async run(inputs, contents, webconsole, serverData) {
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

    const tokens = serverData.socialList;
    const yt_token = tokens["youtube"];

    // Check for missing token/connection at the start
    if (!yt_token) {
      this.setCredit(0);
      webconsole.error(
        "YOUTUBE UPLOAD NODE | YouTube token missing. Please connect your account."
      );
    }

    const ytUploadTool = tool(
      async (
        { videoLink, title, description, tags, category, privacy },
        toolConfig
      ) => {
        webconsole.info("YOUTUBE UPLOAD TOOL | Invoking tool");

        if (!yt_token) {
          webconsole.error(
            "YOUTUBE UPLOAD TOOL | Token missing. Cannot execute."
          );
          return [
            JSON.stringify({
              "Video Link": null,
              error: "YouTube token is not connected or available.",
            }),
            this.getCredit(),
          ];
        }

        try {
          const result = await this.executeYoutubeUpload(
            videoLink,
            title,
            description || "",
            tags || "",
            category,
            privacy,
            yt_token,
            webconsole
          );

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          webconsole.error(
            `YOUTUBE UPLOAD TOOL | An error occurred: ${error.message}`
          );
          return [
            JSON.stringify({
              "Video Link": null,
              error: error.message,
            }),
            this.getCredit(),
          ];
        }
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

    // If token is missing, return immediately with tool
    if (!yt_token) {
      return {
        "Video Link": null,
        Tool: ytUploadTool,
        Credits: this.getCredit(),
      };
    }

    // Check for missing required inputs
    if (!Link || !Title) {
      this.setCredit(0);
      webconsole.error(
        `YOUTUBE UPLOAD NODE | Video link or/and title missing in node input. Returning tool only.`
      );
      return {
        "Video Link": null,
        Tool: ytUploadTool,
        Credits: this.getCredit(),
      };
    }

    // Direct execution
    try {
      const result = await this.executeYoutubeUpload(
        Link,
        Title,
        Description,
        Tags,
        Category,
        Privacy,
        yt_token,
        webconsole
      );

      return {
        ...result,
        Credits: this.getCredit(),
        Tool: ytUploadTool,
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        `YOUTUBE UPLOAD NODE | Error during direct execution: ${error.message}`
      );
      return {
        "Video Link": null,
        Credits: this.getCredit(),
        Tool: ytUploadTool,
      };
    }
  }
}

export default yt_upload;
