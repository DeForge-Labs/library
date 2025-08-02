import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import FormData from "form-data";

dotenv.config();

const config = {
    title: "Lyria AI Music",
    category: "GenAI",
    type: "lyria_node",
    icon: {},
    desc: "Generate AI music using Google Lyria",
    credit: 100,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Music generation prompt",
            name: "Prompt",
            type: "Text",
        },
        {
            desc: "Negative music generation prompt",
            name: "Negative Prompt",
            type: "Text",
        },
        {
            desc: "Seed value for generation (optional)",
            name: "Seed",
            type: "Number",
        },
    ],
    outputs: [
        {
            desc: "Temporary link to the audio",
            name: "Audio Link",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "Music generation prompt",
            name: "Prompt",
            type: "TextArea",
            value: "Enter text here...",
        },
        {
            desc: "Negative music generation prompt",
            name: "Negative Prompt",
            type: "TextArea",
            value: "Enter text here...",
        },
        {
            desc: "Seed value for generation (optional)",
            name: "Seed",
            type: "Number",
            value: 0,
        },
        {
            desc: "Model to be used for music generation",
            name: "Model",
            type: "select",
            value: "lyria-002",
            options: [
            "lyria-002",       
            ],
        },
    ],
    difficulty: "easy",
    tags: ["lyria", "google", "ai", "music"],
}

class lyria_node extends BaseNode {

    constructor() {
        super(config);
    }


    async run(inputs, contents, webconsole, serverData) {

        webconsole.info("LYRIA NODE | Configuring model");
        
        const PromptFilter = inputs.find((e) => e.name === "Prompt");
        const Prompt = PromptFilter?.value || contents.find((e) => e.name === "Prompt")?.value || "";

        const NegPromptFilter = inputs.find((e) => e.name === "Negative Prompt");
        const NegPrompt = NegPromptFilter?.value || contents.find((e) => e.name === "Negative Prompt")?.value || "";

        const SeedFilter = inputs.find((e) => e.name === "Seed");
        const Seed = SeedFilter?.value || contents.find((e) => e.name === "Seed")?.value || NaN;

        const Model = contents.find((e) => e.name === "Model")?.value || "lyria-002";

        if (!Prompt) {
            webconsole.error("LYRIA NODE | No Prompt provided");
            return null;
        }

        const PROJECT_ID = process.env.LYRIA_PROJECT_ID;
        const LOCATION_ID = process.env.LYRIA_LOCATION_ID || 'us-central1';
        const API_ENDPOINT = process.env.LYRIA_API_ENDPOINT || 'us-central1-aiplatform.googleapis.com';
        const MODEL_ID = Model;

        if (!PROJECT_ID) {
            webconsole.error("LYRIA NODE | LYRIA_PROJECT_ID not set in .env file");
            return null;
        }

        const getAccessToken = () => {
            webconsole.info('LYRIA NODE | Obtaining Google Cloud access token');
            return new Promise((resolve, reject) => {
                exec('gcloud auth print-access-token', (error, stdout, stderr) => {
                    if (error) {
                        webconsole.error(`LYRIA NODE | gcloud auth error: ${error.message}`);
                        return reject(new Error('Failed to get Google Cloud access token. Is gcloud CLI installed and authenticated?'));
                    }
                    resolve(stdout.trim());
                });
            });
        }

        const generateMusicWithLyria = async (accessToken) => {
            const predictUrl = `https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:predict`;

            const requestBody = {
                instances: [
                    {
                        prompt: Prompt,
                        negative_prompt: NegPrompt,
                        ...(!Number.isNaN(Seed) && { seed: Number.parseInt(Seed) })
                    },
                ],
            };

            webconsole.info('LYRIA NODE | Sending music generation request to Lyria');
            try {
                const response = await axios.post(predictUrl, requestBody, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });
                
                // Extract the audio content from the response
                if (response.data.predictions && response.data.predictions.length > 0) {
                    const prediction = response.data.predictions[0];
                    
                    const audioContent = prediction.bytesBase64Encoded;
                    if (!audioContent) {
                        throw new Error('audioContent field is missing or empty in Lyria response');
                    }
                    
                    webconsole.info(`LYRIA NODE | Music generation completed successfully`);
                    return audioContent;
                } else {
                    throw new Error('No predictions found in Lyria response');
                }

            } catch (error) {
                webconsole.error(`LYRIA NODE | Error generating music with Lyria: ${error.message}`);
                if (error.response) {
                    webconsole.error(`LYRIA NODE | Lyria Response: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            }
        }

        const saveAudioFile = async (audioContent) => {
            if (!audioContent) {
                throw new Error('audioContent is undefined or null');
            }
            
            if (typeof audioContent !== 'string') {
                throw new Error(`audioContent should be a string, but received: ${typeof audioContent}`);
            }
            
            const tempDir = "./runtime_files";
            if (!await fs.stat(tempDir).catch(() => null)) {
                await fs.mkdir(tempDir, { recursive: true });
            }
            const outputAudioFilename = path.join(tempDir, `generated_audio_${Date.now()}.wav`);

            webconsole.info(`LYRIA NODE | Saving audio file to ${outputAudioFilename}`);

            try {
                const audioBuffer = Buffer.from(audioContent, 'base64');
                await fs.writeFile(outputAudioFilename, audioBuffer);
                webconsole.success(`LYRIA NODE | Audio successfully saved to ${outputAudioFilename}`);
                return outputAudioFilename;
            } catch (error) {
                webconsole.error(`LYRIA NODE | Error saving audio file: ${error.message}`);
                throw error;
            }
        }

        const uploadTo0x0st = async (filePath) => {
            const url = 'https://0x0.st';
            const form = new FormData();
            const fileStream = await fs.readFile(filePath);
            form.append('file', fileStream, { filename: path.basename(filePath) });

            webconsole.info(`LYRIA NODE | Uploading ${filePath} to 0x0.st...`);
            try {
                const response = await axios.post(url, form, {
                    headers: {
                        ...form.getHeaders(),
                        'User-Agent': 'Deforge/1.0 (contact@deforge.io)',
                    },
                });

                if (response.status === 200) {
                    const uploadedUrl = response.data.trim();
                    webconsole.success(`LYRIA NODE | Audio uploaded successfully to: ${uploadedUrl}`);
                    return uploadedUrl;
                } else {
                    throw new Error(`0x0.st upload failed with status ${response.status}: ${response.data}`);
                }
            } catch (error) {
                webconsole.error(`LYRIA NODE | Error uploading to 0x0.st: ${error.message}`);
                throw error;
            }
        }

        let audioFilePath = null;
        try {
            const accessToken = await getAccessToken();
            const audioContent = await generateMusicWithLyria(accessToken);
            audioFilePath = await saveAudioFile(audioContent);

            if (audioFilePath) {
                const uploadedUrl = await uploadTo0x0st(audioFilePath);
                await fs.unlink(audioFilePath);
                return { "Audio Link": uploadedUrl };
            }
            return null;
        } catch (error) {
            webconsole.error(`LYRIA NODE | An error occurred during the process: ${error.message}`);
            if (audioFilePath) {
                try {
                    await fs.unlink(audioFilePath);
                    webconsole.info(`LYRIA NODE | Cleaned up temporary audio file: ${audioFilePath}`);
                } catch (cleanupError) {
                    webconsole.error(`LYRIA NODE | Could not clean up ${audioFilePath}: ${cleanupError.message}`);
                }
            }
            return null;
        }
    }
}

export default lyria_node;