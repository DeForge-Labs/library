import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import FormData from "form-data";

dotenv.config();

const config = {
    title: "Veo3 AI Video",
    category: "GenAI",
    type: "veo3_node",
    icon: {},
    desc: "Generate AI videos using Google Veo3",
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
            desc: "Aspect ratio of the video",
            name: "Ratio",
            type: "select",
            value: "16:9",
            options: [
            "16:9",
            "9:16"        
            ],
        },
        {
            desc: "Enhance the prompt using Gemini",
            name: "Enhance Prompt",
            type: "CheckBox",
            value: false,
        },
        {
            desc: "Generate audio along with video",
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

class veo3_node extends BaseNode {

    constructor() {
        super(config);
    }


    async run(inputs, contents, webconsole, serverData) {

        webconsole.info("VEO3 NODE | Configuring model");
        
        const PromptFilter = inputs.find((e) => e.name === "Prompt");
        const Prompt = PromptFilter?.value || contents.find((e) => e.name === "Prompt")?.value || "";

        const NegPromptFilter = inputs.find((e) => e.name === "Negative Prompt");
        const NegPrompt = NegPromptFilter?.value || contents.find((e) => e.name === "Negative Prompt")?.value || "";

        const Ratio = contents.find((e) => e.name === "Ratio")?.value || "16:9";
        const Enhance = contents.find((e) => e.name === "Enhance Prompt")?.value || false;
        const Audio = contents.find((e) => e.name === "Generate Audio")?.value || true;

        const PersonFilter = contents.find((e) => e.name === "Person")?.value || "Allow adults";
        const Person = (PersonFilter == "Allow adults") ? "allow_adult" : "dont_allow";

        if (!Prompt) {
            webconsole.error("VEO3 NODE | No Prompt provided");
            return null;
        }

        const PROJECT_ID = process.env.VEO_PROJECT_ID;
        const LOCATION_ID = process.env.VEO_LOCATION_ID || 'us-central1';
        const API_ENDPOINT = process.env.VEO_API_ENDPOINT || 'us-central1-aiplatform.googleapis.com';
        const MODEL_ID = process.env.VEO_MODEL_ID || 'veo-3.0-generate-preview';
        const POLLING_INTERVAL_MS = 10000;
        const POLLING_TIMEOUT_MS = 30 * 60 * 1000;

        if (!PROJECT_ID) {
            webconsole.error("VEO3 NODE | VEO_PROJECT_ID not set in .env file");
            return null;
        }

        const getAccessToken = () => {
            webconsole.info('VEO3 NODE | Obtaining Google Cloud access token...');
            return new Promise((resolve, reject) => {
                exec('gcloud auth print-access-token', (error, stdout, stderr) => {
                    if (error) {
                        webconsole.error(`VEO3 NODE | gcloud auth error: ${error.message}`);
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
                        prompt: {
                            text: Prompt,
                        },
                    },
                ],
                parameters: {
                    aspectRatio: Ratio,
                    sampleCount: 1,
                    durationSeconds: "8",
                    personGeneration: Person,
                    addWatermark: true,
                    includeRaiReason: true,
                    generateAudio: Audio,
                    negativePrompt: NegPrompt,
                },
            };

            webconsole.info('VEO3 NODE | Sending video generation request to Veo3...');
            try {
                const response = await axios.post(predictUrl, requestBody, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });

                const operationName = response.data.name;
                webconsole.info(`VEO3 NODE | Video generation initiated. Operation ID: ${operationName}`);
                return operationName;

            } catch (error) {
                webconsole.error(`VEO3 NODE | Error initiating video generation with Veo3: ${error.message}`);
                if (error.response) {
                    webconsole.error(`VEO3 NODE | Veo3 Response: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            }
        }

        const pollVeo3Operation = async (accessToken, operationName) => {
            const operationUrl = `https://${API_ENDPOINT}/v1/${operationName}`;
            const startTime = Date.now();
            const tempDir = "./runtime_files";
            if (!await fs.stat(tempDir).catch(() => null)) {
                await fs.mkdir(tempDir, { recursive: true });
            }
            const outputVideoFilename = path.join(tempDir, `generated_video_${Date.now()}.mp4`);

            webconsole.info(`VEO3 NODE | Polling operation: ${operationName}`);

            while (Date.now() - startTime < POLLING_TIMEOUT_MS) {
                try {
                    const response = await axios.get(operationUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    });

                    const operation = response.data;

                    if (operation.done) {
                        if (operation.error) {
                            throw new Error(`Veo3 operation failed: ${JSON.stringify(operation.error)}`);
                        }
                        if (operation.response && operation.response.predictions && operation.response.predictions.length > 0) {
                            const prediction = operation.response.predictions[0];
                            if (prediction.video && prediction.video.blob) {
                                const videoData = prediction.video.blob;
                                const videoBuffer = Buffer.from(videoData, 'base64');
                                await fs.writeFile(outputVideoFilename, videoBuffer);
                                webconsole.success(`VEO3 NODE | Video successfully saved to ${outputVideoFilename}`);
                                return outputVideoFilename;
                            }
                        }
                        throw new Error('Veo3 operation done, but no video blob found in response.');
                    } else {
                        webconsole.info(`VEO3 NODE | Operation ${operationName} still in progress...`);
                    }
                } catch (error) {
                    webconsole.error(`VEO3 NODE | Error polling Veo3 operation: ${error.message}`);
                    throw error;
                }

                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
            }

            throw new Error(`Veo3 operation timed out after ${POLLING_TIMEOUT_MS / 60000} minutes.`);
        }

        const uploadTo0x0st = async (filePath) => {
            const url = 'https://0x0.st';
            const form = new FormData();
            const fileStream = await fs.readFile(filePath);
            form.append('file', fileStream, { filename: path.basename(filePath) });

            webconsole.info(`VEO3 NODE | Uploading ${filePath} to 0x0.st...`);
            try {
                const response = await axios.post(url, form, {
                    headers: {
                        ...form.getHeaders(),
                    },
                });

                if (response.status === 200) {
                    const uploadedUrl = response.data.trim();
                    webconsole.success(`VEO3 NODE | Video uploaded successfully to: ${uploadedUrl}`);
                    return uploadedUrl;
                } else {
                    throw new Error(`0x0.st upload failed with status ${response.status}: ${response.data}`);
                }
            } catch (error) {
                webconsole.error(`VEO3 NODE | Error uploading to 0x0.st: ${error.message}`);
                throw error;
            }
        }

        let videoFilePath = null;
        try {
            const accessToken = await getAccessToken();
            const operationId = await generateVideoWithVeo3(accessToken);
            videoFilePath = await pollVeo3Operation(accessToken, operationId);

            if (videoFilePath) {
                const uploadedUrl = await uploadTo0x0st(videoFilePath);
                await fs.unlink(videoFilePath);
                return { "Video Link": uploadedUrl };
            }
            return null;
        } catch (error) {
            webconsole.error(`VEO3 NODE | An error occurred during the process: ${error.message}`);
            if (videoFilePath) {
                try {
                    await fs.unlink(videoFilePath);
                    webconsole.info(`VEO3 NODE | Cleaned up temporary video file: ${videoFilePath}`);
                } catch (cleanupError) {
                    webconsole.error(`VEO3 NODE | Could not clean up ${videoFilePath}: ${cleanupError.message}`);
                }
            }
            return null;
        }
    }
}

export default veo3_node;