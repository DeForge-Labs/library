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
  credit: 5,
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
      throw new Error(`Image upload failed: ${errorMessage}`);
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
      throw new Error(`Video upload failed: ${errorMessage}`);
    }
  }

  async executePost(
    Content,
    ImageLink,
    VideoLink,
    Visibility,
    linkedin_token,
    webconsole
  ) {
    if (ImageLink && VideoLink) {
      throw new Error("Cannot post both an image and a video simultaneously.");
    }

    const access_token = linkedin_token.access_token;
    const restClientLinkedin = new RestliClient();

    webconsole.info("LINKEDIN POST NODE | Getting connected user information");
    const meResponse = await restClientLinkedin.get({
      resourcePath: "/userinfo",
      accessToken: access_token,
    });
    const author = `urn:li:person:${meResponse.data.sub}`;

    let postContent = {};
    let postBodyText = Content || "";
    let mediaUrn = null;

    if (ImageLink) {
      mediaUrn = await this.uploadImage(
        restClientLinkedin,
        access_token,
        author,
        ImageLink,
        webconsole
      );
      if (!mediaUrn) {
        throw new Error("Image upload failed.");
      }
      postContent = {
        content: {
          media: {
            id: mediaUrn,
          },
        },
      };
    } else if (VideoLink) {
      mediaUrn = await this.uploadVideo(
        restClientLinkedin,
        access_token,
        author,
        VideoLink,
        webconsole
      );
      if (!mediaUrn) {
        throw new Error("Video upload failed.");
      }
      postContent = {
        content: {
          media: {
            title: Content.substring(0, 100) || "Uploaded Media",
            id: mediaUrn,
          },
        },
      };
    }

    const postEntity = {
      author: author,
      lifecycleState: "PUBLISHED",
      visibility: Visibility,
      commentary: postBodyText,
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...postContent,
    };

    const postsCreateResponse = await restClientLinkedin.create({
      resourcePath: "/posts",
      entity: postEntity,
      accessToken: access_token,
      versionString: "202504",
    });

    const postId = postsCreateResponse.createdEntityId;
    const postLink = `https://www.linkedin.com/feed/update/${postId}/`;

    return { "Post Link": postLink };
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("LINKEDIN POST NODE | Starting execution");

    const Content = this.getValue(inputs, contents, "Content", "");
    const VideoLink = this.getValue(inputs, contents, "Video Link", "");
    const ImageLink = this.getValue(inputs, contents, "Image Link", "");
    const Visibility = this.getValue(inputs, contents, "Visibility", "PUBLIC");
    const executionCredit = this.getCredit();

    const tokens = serverData.socialList;
    const linkedin_token = tokens["linkedin"];

    if (!linkedin_token || !linkedin_token.access_token) {
      this.setCredit(0);
      webconsole.error(
        "LINKEDIN POST NODE | LinkedIn token missing. Please connect your account. Returning tool only."
      );
    }

    const linkedInPostTool = tool(
      async ({ content, imageUrl, videoUrl, visibility }, toolConfig) => {
        webconsole.info("LINKEDIN POST CREATOR TOOL | Invoking tool");

        if (!linkedin_token || !linkedin_token.access_token) {
          webconsole.error("LINKEDIN TOOL | Token missing. Cannot execute.");
          return [
            JSON.stringify({
              "Post Link": null,
              error: "LinkedIn token is not connected or available.",
            }),
            this.getCredit(),
          ];
        }

        try {
          const result = await this.executePost(
            content,
            imageUrl,
            videoUrl,
            visibility,
            linkedin_token,
            webconsole
          );

          this.setCredit(this.getCredit() + executionCredit);

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - executionCredit);
          webconsole.error(`LINKEDIN POST TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              "Post Link": null,
              error: error.message,
            }),
            this.getCredit(),
          ];
        }
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

    // If token is missing, return immediately with tool
    if (!linkedin_token || !linkedin_token.access_token) {
      return {
        "Post Link": null,
        Tool: linkedInPostTool,
        Credits: this.getCredit(),
      };
    }

    // Check for direct execution
    if (!Content && !ImageLink && !VideoLink) {
      webconsole.info(
        "LINKEDIN POST NODE | No content provided. Returning tool only."
      );
      this.setCredit(0);
      return {
        "Post Link": null,
        Tool: linkedInPostTool,
        Credits: this.getCredit(),
      };
    }

    try {
      // Execute the post creation directly
      const result = await this.executePost(
        Content,
        ImageLink,
        VideoLink,
        Visibility,
        linkedin_token,
        webconsole
      );

      // Successfully posted, return results
      return {
        ...result,
        Credits: this.getCredit(),
        Tool: linkedInPostTool,
      };
    } catch (error) {
      // Failure during direct execution
      this.setCredit(0);
      webconsole.error(
        "LINKEDIN POST NODE | Error during direct execution: " + error.message
      );

      return {
        "Post Link": null,
        Credits: this.getCredit(),
        Tool: linkedInPostTool,
      };
    }
  }
}

export default linkedin_post;
