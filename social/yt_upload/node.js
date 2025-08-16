import BaseNode from "../../core/BaseNode/node.js";
import { google } from "googleapis";
import { Downloader } from "nodejs-file-downloader";
import dotenv from "dotenv";
import fs from "fs";
import { fileTypeFromFile } from "file-type";

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
            options: [
                "Public",
                "Private",
                "Unlisted"       
            ],
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
}

class yt_upload extends BaseNode {

    constructor() {
        super(config);
    }


    async run(inputs, contents, webconsole, serverData) {

        webconsole.info("YOUTUBE UPLOAD NODE | Starting configuration");

        const LinkFilter = inputs.find((e) => e.name === "Link");
        const Link = LinkFilter?.value || contents.find((e) => e.name === "Link")?.value || "";

        const TitleFilter = inputs.find((e) => e.name === "Title");
        const Title = TitleFilter?.value || contents.find((e) => e.name === "Title")?.value || "";

        const DescriptionFilter = inputs.find((e) => e.name === "Description");
        const Description = DescriptionFilter?.value || contents.find((e) => e.name === "Description")?.value || "";

        const TagsFilter = inputs.find((e) => e.name === "Tags");
        const Tags = TagsFilter?.value || contents.find((e) => e.name === "Tags")?.value || "";

        const Category = contents.find((e) => e.name === "Category")?.value || "People & Blogs";
        const Privacy = contents.find((e) => e.name === "Privacy")?.value || "Public";

        if (!Link || !Title) {
            webconsole.error(`YOUTUBE UPLOAD NODE | Video link or/and title missing`);
            return null;
        }

        const tokens = serverData.socialList;
        if (!Object.keys(tokens).includes("youtube")) {
            webconsole.error("YOUTUBE UPLOAD NODE | Please connect your youtube account");
            return null;
        }

        const yt_token = tokens["youtube"];
        if (!yt_token) {
            webconsole.error("YOUTUBE UPLOAD NODE | Some error occured, please reconnect your youtube account");
            return null;
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GCP_CLIENT_ID,
            process.env.GCP_CLIENT_SECRET,
            process.env.GCP_REDIRECT_URL
        );

        oauth2Client.setCredentials(yt_token);
        const service = google.youtube("v3");

        
        const categoryList = {
            "Autos & Vehicles": 2,
            "Comedy": 34,
            "Education": 27,
            "Enterntainment": 24,
            "Film & Animation": 1,
            "Gaming": 20,
            "Howto & Style": 26,
            "Music": 10,
            "News & Politics": 25,
            "Nonprofits & Activism": 29,
            "People & Blogs": 22,
            "Pets & Animals": 15,
            "Science & Technology": 28,
            "Sports": 42,
            "Travel & Events": 19,
        };

        const tempDir = "./runtime_files";
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        webconsole.info("YOUTUBE UPLOAD NODE | Downloading video...");
        const downloader = new Downloader({
            url: Link,
            directory: tempDir,
        });

        try {
            const { filePath } = await downloader.download();
            if (!filePath) {
                webconsole.error("YOUTUBE UPLOAD NODE | Video download failed.");
                return null;
            }
            webconsole.info(`YOUTUBE UPLOAD NODE | Video downloaded`);

            const fileType = await fileTypeFromFile(filePath);
            if (!fileType || !fileType.mime.startsWith('video/')) {
                webconsole.error("YOUTUBE UPLOAD NODE | The downloaded file is not a valid video file.");
                fs.unlinkSync(filePath);
                return null;
            }

            webconsole.info("YOUTUBE UPLOAD NODE | Uploading to YouTube...");

            const videoCategory = categoryList[Category];

            const response = await service.videos.insert({
                auth: oauth2Client,
                part: "snippet,status",
                requestBody: {
                    snippet: {
                        title: Title,
                        description: Description,
                        tags: Tags.split(",").map(tag => tag.trim()),
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

            fs.unlinkSync(filePath);

            if (response.data.id) {
                const videoLink = `https://www.youtube.com/watch?v=${response.data.id}`;
                webconsole.success(`YOUTUBE UPLOAD NODE | Video uploaded successfully: ${videoLink}`);
                return { "Video Link": videoLink };
            } else {
                webconsole.error("YOUTUBE UPLOAD NODE | Failed to upload video to YouTube.");
                return null;
            }

        } catch (error) {
            webconsole.error(`YOUTUBE UPLOAD NODE | An error occurred: ${error.message}`);
            return null;
        }
    }
}

export default yt_upload;