import BaseNode from "../../core/BaseNode/node.js";
import { RestliClient, AuthClient } from "linkedin-api-client";
import { fileTypeFromFile } from "file-type";
import { Downloader } from "nodejs-file-downloader";
import fs from "fs";
import axios from "axios";
import path from "path";
import dotenv from "dotenv";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config();

const config = {
  title: "LinkedIN Post",
  category: "social",
  type: "linkedin_post",
  icon: {},
  desc: "Make a post on LinkedIn with optional text, image, or video (requires LinkedIn connection).",
  credit: 0,
  inputs: [
    {
      desc: "Text content to post",
      name: "Content",
      type: "Text",
    },
    {
      desc: "Link of the video to upload",
      name: "Video Link",
      type: "Text",
    },
    {
      desc: "Link of the image to upload",
      name: "Image Link",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The link of the newly created post",
      name: "Post Link",
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
      desc: "Text content to post",
      name: "Content",
      type: "TextArea",
      value: "Enter text here...",
    },
    {
      desc: "Link of the video to upload",
      name: "Video Link",
      type: "Text",
      value: "Enter video link here...",
    },
    {
      desc: "Link of the image to upload",
      name: "Image Link",
      type: "Text",
      value: "Enter image link here...",
    },
    {
      desc: "The visibility of the post",
      name: "Visibility",
      type: "select",
      value: "PUBLIC",
      options: ["PUBLIC", "CONNECTIONS", "LOGGED_IN"],
    },
    {
      desc: "Connect to your Linked In account",
      name: "LinkedIn",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["linkedin", "video", "image", "post", "social media"],
};

class linkedin_post extends BaseNode {
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

  // --- Media Upload Helpers (Keep as is) ---

  async downloadFile(url, webconsole) {
    const tempDir = "./runtime_files";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    webconsole.info(`LINKEDIN POST NODE | Downloading file from ${url}...`);
    const downloader = new Downloader({
      url: url,
      directory: tempDir,
    });

    try {
      const { filePath } = await downloader.download();
      if (!filePath) {
        webconsole.error("LINKEDIN POST NODE | File download failed.");
        return null;
      }
      webconsole.info(`LINKEDIN POST NODE | File downloaded to ${filePath}`);
      return filePath;
    } catch (error) {
      webconsole.error(
        `LINKEDIN POST NODE | File download error: ${error.message}`
      );
      return null;
    }
  }

  async uploadImage(client, accessToken, authorUrn, imageUrl, webconsole) {
    const filePath = await this.downloadFile(imageUrl, webconsole);
    if (!filePath) return null;

    try {
      const fileInfo = await fileTypeFromFile(filePath);
      if (!fileInfo || !fileInfo.mime.startsWith("image/")) {
        webconsole.error(
          "LINKEDIN POST NODE | The downloaded file is not a valid image file."
        );
        fs.unlinkSync(filePath);
        return null;
      }

      webconsole.info("LINKEDIN POST NODE | Initializing image upload...");
      const initResponse = await client.action({
        resourcePath: "/images",
        actionName: "initializeUpload",
        data: {
          initializeUploadRequest: {
            owner: authorUrn,
          },
        },
        accessToken: accessToken,
      });

      const uploadUrl = initResponse.data.value.uploadUrl;
      const imageUrn = initResponse.data.value.image;

      webconsole.info("LINKEDIN POST NODE | Uploading image...");
      const imageBuffer = fs.readFileSync(filePath);

      await axios.put(uploadUrl, imageBuffer, {
        headers: { "Content-Type": fileInfo.mime },
      });

      webconsole.info("LINKEDIN POST NODE | Image uploaded successfully.");
      fs.unlinkSync(filePath);
      return imageUrn;
    } catch (error) {
      const errorMessage = error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message;
      webconsole.error(
        `LINKEDIN POST NODE | Image upload failed: ${errorMessage}`
      );
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return null;
    }
  }

  async uploadVideo(client, accessToken, authorUrn, videoUrl, webconsole) {
    const filePath = await this.downloadFile(videoUrl, webconsole);
    if (!filePath) return null;

    try {
      const fileInfo = await fileTypeFromFile(filePath);
      if (!fileInfo || !fileInfo.mime.startsWith("video/")) {
        webconsole.error(
          "LINKEDIN POST NODE | The downloaded file is not a valid video file."
        );
        fs.unlinkSync(filePath);
        return null;
      }

      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;

      webconsole.info("LINKEDIN POST NODE | Initializing video upload...");
      const initResponse = await client.action({
        resourcePath: "/videos",
        actionName: "initializeUpload",
        data: {
          initializeUploadRequest: {
            owner: authorUrn,
            fileSizeBytes: fileSizeInBytes,
          },
        },
        accessToken: accessToken,
      });

      const { uploadInstructions, video, uploadToken } =
        initResponse.data.value;
      const uploadedPartIds = [];

      webconsole.info("LINKEDIN POST NODE | Uploading video parts...");
      for (const instruction of uploadInstructions) {
        const { uploadUrl, firstByte, lastByte } = instruction;
        const stream = fs.createReadStream(filePath, {
          start: firstByte,
          end: lastByte,
        });

        const uploadResponse = await axios.put(uploadUrl, stream, {
          headers: { "Content-Type": "application/octet-stream" },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        uploadedPartIds.push(uploadResponse.headers.etag);
      }

      webconsole.info("LINKEDIN POST NODE | Finalizing video upload...");
      await client.action({
        resourcePath: "/videos",
        actionName: "finalizeUpload",
        data: {
          finalizeUploadRequest: {
            video: video,
            uploadToken: uploadToken,
            uploadedPartIds: uploadedPartIds,
          },
        },
      });

      webconsole.info("LINKEDIN POST NODE | Video uploaded successfully.");
      fs.unlinkSync(filePath);
      return video;
    } catch (error) {
      const errorMessage = error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message;
      webconsole.error(
        `LINKEDIN POST NODE | Video upload failed: ${errorMessage}`
      );
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return null;
    }
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
    webconsole.info("LINKEDIN POST NODE | Starting execution");

    const Content = this.getValue(inputs, contents, "Content", "");
    const VideoLink = this.getValue(inputs, contents, "Video Link", "");
    const ImageLink = this.getValue(inputs, contents, "Image Link", "");
    const Visibility = this.getValue(inputs, contents, "Visibility", "PUBLIC");

    // 4. Create the Tool
    const linkedInPostTool = tool(
      async ({ content, imageUrl, videoUrl, visibility }, toolConfig) => {
        // The tool is used by the agent to structure the request.
        // We return a simulated success message describing what would happen.
        const mediaType = imageUrl ? "Image" : videoUrl ? "Video" : "Text-only";
        const result = {
          status: "Awaiting execution",
          action: `Attempting to post to LinkedIn with content: "${content.substring(
            0,
            50
          )}..." and media: ${mediaType}`,
          postLink:
            "https://www.linkedin.com/feed/update/POST_ID_PENDING_EXECUTION/",
        };

        return [JSON.stringify(result), this.getCredit()];
      },
      {
        name: "linkedinPostCreator",
        description:
          "Creates a new post on the connected user's LinkedIn profile. It supports text-only posts, posts with a single image URL, or posts with a single video URL. Only one media link (Image or Video) should be provided.",
        schema: z
          .object({
            content: z
              .string()
              .describe(
                "The main text content (caption) of the LinkedIn post."
              ),
            imageUrl: z
              .string()
              .url()
              .optional()
              .describe(
                "A public URL for an image file (.png, .jpg, etc.) to include in the post."
              ),
            videoUrl: z
              .string()
              .url()
              .optional()
              .describe(
                "A public URL for a video file to include in the post. Do not provide if 'imageUrl' is used."
              ),
            visibility: z
              .enum(["PUBLIC", "CONNECTIONS", "LOGGED_IN"])
              .default("PUBLIC")
              .describe("The audience who can see the post."),
          })
          .refine((data) => !(data.imageUrl && data.videoUrl), {
            message:
              "Cannot post both an image and a video simultaneously. Provide only one media link.",
            path: ["imageUrl", "videoUrl"],
          }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for direct execution
    if (!Content && !ImageLink && !VideoLink) {
      webconsole.info(
        "LINKEDIN POST NODE | No content provided. Returning tool only."
      );
      this.setCredit(0);
      return {
        "Post Link": null,
        Tool: linkedInPostTool,
      };
    }

    const tokens = serverData.socialList;
    const linkedin_token = tokens["linkedin"];

    if (!linkedin_token || !linkedin_token.access_token) {
      webconsole.error(
        "LINKEDIN POST NODE | LinkedIn token missing. Please connect your account. Returning tool only."
      );
      this.setCredit(0);
      return {
        "Post Link": null,
        Tool: linkedInPostTool,
      };
    }

    // --- 6. Execute the actual LinkedIn API logic ---
    try {
      const access_token = linkedin_token.access_token;
      const restClientLinkedin = new RestliClient();

      // 6.1 Get Author URN
      webconsole.info(
        "LINKEDIN POST NODE | Getting connected user information"
      );
      const meResponse = await restClientLinkedin.get({
        resourcePath: "/userinfo",
        accessToken: access_token,
      });
      const author = `urn:li:person:${meResponse.data.sub}`;

      let postContent = {};

      // 6.2 Handle Media Upload (Image has priority over Video)
      if (ImageLink) {
        const imageUrn = await this.uploadImage(
          restClientLinkedin,
          access_token,
          author,
          ImageLink,
          webconsole
        );
        if (!imageUrn) {
          return { "Post Link": null, Tool: linkedInPostTool };
        }
        postContent = {
          content: {
            media: {
              id: imageUrn,
            },
          },
        };
      } else if (VideoLink) {
        const videoUrn = await this.uploadVideo(
          restClientLinkedin,
          access_token,
          author,
          VideoLink,
          webconsole
        );
        if (!videoUrn) {
          return { "Post Link": null, Tool: linkedInPostTool };
        }
        postContent = {
          content: {
            media: {
              title: Content.substring(0, 100) || "Uploaded Video", // Use part of the content as title
              id: videoUrn,
            },
          },
        };
      }

      // 6.3 Create Post Entity
      const postEntity = {
        author: author,
        lifecycleState: "PUBLISHED",
        visibility: Visibility,
        commentary: Content,
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        ...postContent,
      };

      // 6.4 Send Post Request
      const postsCreateResponse = await restClientLinkedin.create({
        resourcePath: "/posts",
        entity: postEntity,
        accessToken: access_token,
        versionString: "202504",
      });

      const postId = postsCreateResponse.createdEntityId;
      const postLink = `https://www.linkedin.com/feed/update/${postId}/`;
      webconsole.success(
        `LINKEDIN POST NODE | Post created successfully: ${postLink}`
      );

      return {
        "Post Link": postLink,
        Credits: this.getCredit(),
        Tool: linkedInPostTool,
      };
    } catch (error) {
      // Log full error for debugging
      const errorMessage = error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message;
      webconsole.error("LINKEDIN POST NODE | API Error: ", errorMessage);

      return {
        "Post Link": null,
        Credits: this.getCredit(),
        Tool: linkedInPostTool,
      };
    }
  }
}

export default linkedin_post;
