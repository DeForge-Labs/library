import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import { fileTypeFromFile } from "file-type";

dotenv.config();

const config = {
    title: "Veo AI Video",
    category: "GenAI",
    type: "veo_node",
    icon: {},
    desc: "Generate AI videos using Google Veo",
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
            options: [
            "Veo3",
            "Veo2"        
            ],
        },
        {
            desc: "Aspect ratio of the video (applicable only for Veo2)",
            name: "Ratio",
            type: "select",
            value: "16:9",
            options: [
            "16:9",
            "9:16"        
            ],
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
            options: [
            "Allow adults",
            "Dont allow"        
            ],
        },
    ],
    difficulty: "medium",
    tags: ["veo", "google", "ai", "video"],
}

class veo_node extends BaseNode {

    constructor() {
        super(config);
    }

    /**
     * @override
     * @inheritdoc
     * 
     * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs
     * @param {import("../../core/BaseNode/node.js").Contents[]} contents
     * @param {import("../../core/BaseNode/node.js").IServerData} serverData
     */
    estimateUsage(inputs, contents, serverData) {
        const Model = contents.find((e) => e.name === "Model")?.value || "Veo3";
        
        const DurationFilter = inputs.find((e) => e.name === "Duration");
        let Duration = DurationFilter?.value || contents.find((e) => e.name === "Duration")?.value || 8;

        const AudioFilter = inputs.find((e) => e.name === "Generate Audio");
        let Audio = AudioFilter?.value || contents.find((e) => e.name === "Generate Audio")?.value || true;

        if (Model === "Veo3") {
            if (Audio) {
                return 4000;
            }
            else {
                return 2667;
            }
        }
        else {
            Duration = Math.max(5, Math.min(Duration, 8));
            return 334 * Duration;
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

        webconsole.info("VEO NODE | Configuring model");
        
        const PromptFilter = inputs.find((e) => e.name === "Prompt");
        const Prompt = PromptFilter?.value || contents.find((e) => e.name === "Prompt")?.value || "";

        const NegPromptFilter = inputs.find((e) => e.name === "Negative Prompt");
        const NegPrompt = NegPromptFilter?.value || contents.find((e) => e.name === "Negative Prompt")?.value || "";

        const DurationFilter = inputs.find((e) => e.name === "Duration");
        let Duration = DurationFilter?.value || contents.find((e) => e.name === "Duration")?.value || 8;

        const AudioFilter = inputs.find((e) => e.name === "Generate Audio");
        let Audio = AudioFilter?.value || contents.find((e) => e.name === "Generate Audio")?.value || true;

        const Model = contents.find((e) => e.name === "Model")?.value || "Veo3";
        let Ratio = contents.find((e) => e.name === "Ratio")?.value || "16:9";        
        const PersonFilter = contents.find((e) => e.name === "Person")?.value || "Allow adults";
        const Person = (PersonFilter == "Allow adults") ? "allow_adult" : "dont_allow";

        const ModelDict = {
            "Veo3": "veo-3.0-generate-preview",
            "Veo2": "veo-2.0-generate-001"
        }
        if (!Object.keys(ModelDict).includes(Model)) {
            webconsole.error("VEO NODE | Unknown model selected");
            return null;
        }

        if (!Prompt) {
            webconsole.error("VEO NODE | No Prompt provided");
            return null;
        }

        if (Model === "Veo3") {
            Duration = 8;
            Ratio = "16:9";
            if (Audio) {
                this.setCredit(4000)
            }
            else {
                this.setCredit(2667)
            }
        }
        else {
            Duration = Math.max(5, Math.min(Duration, 8));
            Audio = false;
            this.setCredit(334 * Duration);
        }

        const PROJECT_ID = process.env.VEO_PROJECT_ID;
        const LOCATION_ID = process.env.VEO_LOCATION_ID || 'us-central1';
        const API_ENDPOINT = process.env.VEO_API_ENDPOINT || 'us-central1-aiplatform.googleapis.com';
        const MODEL_ID = ModelDict[Model];
        const POLLING_INTERVAL_MS = 10000;
        const POLLING_TIMEOUT_MS = 30 * 60 * 1000;

        if (!PROJECT_ID) {
            webconsole.error("VEO NODE | VEO_PROJECT_ID not set in .env file");
            return null;
        }

        const getAccessToken = () => {
            webconsole.info('VEO NODE | Obtaining Google Cloud access token');
            return new Promise((resolve, reject) => {
                exec('gcloud auth print-access-token', (error, stdout, stderr) => {
                    if (error) {
                        webconsole.error(`VEO NODE | gcloud auth error: ${error.message}`);
                        return reject(new Error('Failed to get Google Cloud access token. Is gcloud CLI installed and authenticated?'));
                    }
                    resolve(stdout.trim());
                });
            });
        }

        const generateVideoWithVeo3 = async (accessToken) => {
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

            webconsole.info('VEO NODE | Sending video generation request to Veo3...');
            try {
                const response = await axios.post(predictUrl, requestBody, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });

                const operationName = response.data.name;
                webconsole.info(`VEO NODE | Video generation initiated. Operation ID: ${operationName.split("/").at(-1)}`);
                return operationName;

            } catch (error) {
                webconsole.error(`VEO NODE | Error initiating video generation with Veo3: ${error.message}`);
                if (error.response) {
                    webconsole.error(`VEO NODE | Veo3 Response: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            }
        }

        const pollVeo3Operation = async (accessToken, operationName) => {
            const pollUrl = `https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:fetchPredictOperation`;
            const startTime = Date.now();
            const tempDir = "./runtime_files";
            if (!await fs.stat(tempDir).catch(() => null)) {
                await fs.mkdir(tempDir, { recursive: true });
            }
            const outputVideoFilename = path.join(tempDir, `generated_video_${Date.now()}.mp4`);

            webconsole.info(`VEO NODE | Polling operation`);

            while (Date.now() - startTime < POLLING_TIMEOUT_MS) {
                try {
                    const response = await axios.post(pollUrl, 
                        { "operationName": operationName }, 
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json; charset=utf-8',
                            },
                        }
                    );

                    const operation = response.data;

                    if (operation.done) {
                        if (operation.error) {
                            throw new Error(`Veo3 operation failed: ${JSON.stringify(operation.error)}`);
                        }
                        if (operation.response && operation.response.videos && operation.response.videos.length > 0) {
                            const video = operation.response.videos[0];
                            if (video.bytesBase64Encoded) {
                                const videoBuffer = Buffer.from(video.bytesBase64Encoded, 'base64');
                                await fs.writeFile(outputVideoFilename, videoBuffer);
                                webconsole.success(`VEO NODE | Video successfully saved to ${outputVideoFilename}`);
                                return outputVideoFilename;
                            }
                        }
                        throw new Error('Veo3 operation done, but no video data found in response.');
                    } else {
                        webconsole.info(`VEO NODE | Operation still in progress...`);
                    }
                } catch (error) {
                    webconsole.error(`VEO NODE | Error polling Veo3 operation: ${error.message}`);
                    if (error.response) {
                        webconsole.error(`VEO NODE | Polling Response: ${JSON.stringify(error.response.data)}`);
                    }
                    throw error;
                }

                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
            }

            throw new Error(`Veo3 operation timed out after ${POLLING_TIMEOUT_MS / 60000} minutes.`);
        }

        let videoFilePath = null;
        try {
            const accessToken = await getAccessToken();
            const operationId = await generateVideoWithVeo3(accessToken);
            videoFilePath = await pollVeo3Operation(accessToken, operationId);

            if (videoFilePath) {
                const videoFileMime = await fileTypeFromFile(videoFilePath);
                if (!videoFileMime || !videoFileMime.mime.startsWith('video/')) {
                    webconsole.error("VEO NODE | The generated file is not a valid video file.");
                    await fs.unlink(videoFilePath);
                    return null;
                }

                const videoFileStream = fs.createReadStream(videoFilePath);

                const uploadedUrl = await serverData.s3Util.addFile(
                    bucket=undefined,
                    key=path.basename(videoFilePath),
                    body=videoFileStream,
                    contentType=videoFileMime.mime,
                );
                await fs.unlink(videoFilePath);
                return { "Video Link": uploadedUrl, "Credits": this.getCredit() };
            }
            return null;
        } catch (error) {
            webconsole.error(`VEO NODE | An error occurred during the process: ${error.message}`);
            if (videoFilePath) {
                try {
                    await fs.unlink(videoFilePath);
                    webconsole.info(`VEO NODE | Cleaned up temporary video file: ${videoFilePath}`);
                } catch (cleanupError) {
                    webconsole.error(`VEO NODE | Could not clean up ${videoFilePath}: ${cleanupError.message}`);
                }
            }
            this.setCredit(0);
            return null;
        }
    }
}

export default veo_node;