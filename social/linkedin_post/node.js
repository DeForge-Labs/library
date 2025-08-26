import BaseNode from "../../core/BaseNode/node.js";
import { RestliClient, AuthClient } from "linkedin-api-client";
import { fileTypeFromFile } from "file-type";
import { Downloader } from "nodejs-file-downloader";
import fs from "fs";
import axios from "axios";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const config = {
    title: "LinkedIN Post",
    category: "social",
    type: "linkedin_post",
    icon: {},
    desc: "Make a post on LinkedIn",
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
            desc: "The link of the post",
            name: "Post Link",
            type: "Text",
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
            options: [
                "PUBLIC",
                "CONNECTIONS",
                "LOGGED_IN",
            ],
        },
        {
            desc: "Connect to your Linked In account",
            name: "LinkedIn",
            type: "social",
            defaultValue: "",
        },
    ],
    difficulty: "easy",
    tags: ["linkedin", "video", "image", "post"],
}

class linkedin_post extends BaseNode {

    constructor() {
        super(config);
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
            webconsole.error(`LINKEDIN POST NODE | File download error: ${error.message}`);
            return null;
        }
    }

    async uploadImage(client, accessToken, authorUrn, imageUrl, webconsole) {
        const filePath = await this.downloadFile(imageUrl, webconsole);
        if (!filePath) return null;

        try {
            const fileInfo = await fileTypeFromFile(filePath);
            if (!fileInfo || !fileInfo.mime.startsWith('image/')) {
                webconsole.error("LINKEDIN POST NODE | The downloaded file is not a valid image file.");
                fs.unlinkSync(filePath);
                return null;
            }

            webconsole.info("LINKEDIN POST NODE | Initializing image upload...");
            const initResponse = await client.action({
                resourcePath: '/images',
                actionName: 'initializeUpload',
                data: {
                    initializeUploadRequest: {
                        owner: authorUrn
                    }
                },
                accessToken: accessToken,
            });

            const uploadUrl = initResponse.data.value.uploadUrl;
            const imageUrn = initResponse.data.value.image;

            webconsole.info("LINKEDIN POST NODE | Uploading image...");
            const imageBuffer = fs.readFileSync(filePath);

            await axios.put(uploadUrl, imageBuffer, {
                headers: { 'Content-Type': fileInfo.mime }
            });
            
            webconsole.info("LINKEDIN POST NODE | Image uploaded successfully.");
            fs.unlinkSync(filePath);
            return imageUrn;

        } catch (error) {
            const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
            webconsole.error(`LINKEDIN POST NODE | Image upload failed: ${errorMessage}`);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return null;
        }
    }

    async uploadVideo(client, accessToken, authorUrn, videoUrl, webconsole) {
        const filePath = await this.downloadFile(videoUrl, webconsole);
        if (!filePath) return null;

        try {
            const fileInfo = await fileTypeFromFile(filePath);
            if (!fileInfo || !fileInfo.mime.startsWith('video/')) {
                webconsole.error("LINKEDIN POST NODE | The downloaded file is not a valid video file.");
                fs.unlinkSync(filePath);
                return null;
            }
            
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;

            webconsole.info("LINKEDIN POST NODE | Initializing video upload...");
            const initResponse = await client.action({
                resourcePath: '/videos',
                actionName: 'initializeUpload',
                data: {
                    initializeUploadRequest: {
                        owner: authorUrn,
                        fileSizeBytes: fileSizeInBytes,
                    }
                },
                accessToken: accessToken
            });

            const { uploadInstructions, video, uploadToken } = initResponse.data.value;
            const uploadedPartIds = [];

            webconsole.info("LINKEDIN POST NODE | Uploading video parts...");
            for (const instruction of uploadInstructions) {
                const { uploadUrl, firstByte, lastByte } = instruction;
                const stream = fs.createReadStream(filePath, { start: firstByte, end: lastByte });
                
                const uploadResponse = await axios.put(uploadUrl, stream, {
                    headers: { 'Content-Type': 'application/octet-stream' },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });
                
                uploadedPartIds.push(uploadResponse.headers.etag);
            }

            webconsole.info("LINKEDIN POST NODE | Finalizing video upload...");
            await client.action({
                resourcePath: '/videos',
                actionName: 'finalizeUpload',
                data: {
                    finalizeUploadRequest: {
                        video: video,
                        uploadToken: uploadToken,
                        uploadedPartIds: uploadedPartIds
                    }
                },
                accessToken: accessToken
            });

            webconsole.info("LINKEDIN POST NODE | Video uploaded successfully.");
            fs.unlinkSync(filePath);
            return video;

        } catch (error) {
            const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
            webconsole.error(`LINKEDIN POST NODE | Video upload failed: ${errorMessage}`);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return null;
        }
    }

    /**
     * @override
     * @inheritdoc
     * 
     * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs 
     * @param {import("../../core/BaseNode/node.js").Contents[]} contents 
     * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole 
     * @param {import("../../core/BaseNode/node.js").IServerData} serverData
     */
    async run(inputs, contents, webconsole, serverData) {

        webconsole.info("LINKEDIN POST NODE | Starting configuration");

        const ContentFilter = inputs.find((e) => e.name === "Content");
        const Content = ContentFilter?.value || contents.find((e) => e.name === "Content")?.value || "";

        const VideoLinkFilter = inputs.find((e) => e.name === "Video Link");
        const VideoLink = VideoLinkFilter?.value || contents.find((e) => e.name === "Video Link")?.value || "";

        const ImageLinkFilter = inputs.find((e) => e.name === "Image Link");
        const ImageLink = ImageLinkFilter?.value || contents.find((e) => e.name === "Image Link")?.value || "";

        const Visibility = contents.find((e) => e.name === "Visibility")?.value || "PUBLIC";

        if (!Content) {
            webconsole.error(`LINKEDIN POST NODE | Content missing`);
            return null;
        }

        const tokens = serverData.socialList;
        if (!Object.keys(tokens).includes("linkedin")) {
            webconsole.error("LINKEDIN POST NODE | Please connect your linkedin account");
            return null;
        }

        const linkedin_token = tokens["linkedin"];
        if (!linkedin_token) {
            webconsole.error("LINKEDIN POST NODE | Some error occured, please reconnect your linkedin account");
            return null;
        }

        try {
            const access_token = linkedin_token.access_token;

            webconsole.info("LINKEDIN POST NODE | Getting connected user information");
            const restClientLinkedin = new RestliClient();

            const meResponse = await restClientLinkedin.get({
                resourcePath: '/userinfo',
                accessToken: access_token
            });

            const author = `urn:li:person:${meResponse.data.sub}`;

            let postContent = {};
            if (ImageLink) {
                const imageUrn = await this.uploadImage(restClientLinkedin, access_token, author, ImageLink, webconsole);
                if (!imageUrn) return null;
                postContent = {
                    content: {
                        media: {
                            id: imageUrn
                        }
                    }
                };
            } else if (VideoLink) {
                const videoUrn = await this.uploadVideo(restClientLinkedin, access_token, author, VideoLink, webconsole);
                if (!videoUrn) return null;
                postContent = {
                    content: {
                        media: {
                            title: Content.substring(0, 100), // Use part of the content as title
                            id: videoUrn
                        }
                    }
                };
            }

            const postEntity = {
                author: author,
                lifecycleState: 'PUBLISHED',
                visibility: Visibility,
                commentary: Content,
                distribution: {
                    feedDistribution: 'MAIN_FEED',
                    targetEntities: [],
                    thirdPartyDistributionChannels: []
                },
                ...postContent
            };

            const postsCreateResponse = await restClientLinkedin.create({
                resourcePath: '/posts',
                entity: postEntity,
                accessToken: access_token,
                versionString: '202504'
            });

            const postId = postsCreateResponse.createdEntityId;
            const postLink = `https://www.linkedin.com/feed/update/${postId}/`;
            webconsole.success(`LINKEDIN POST NODE | Post created successfully: ${postLink}`);

            return { "Post Link": postLink, "Credits": this.getCredit() };


        } catch (error) {
            webconsole.error("LINKEDIN POST NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default linkedin_post;