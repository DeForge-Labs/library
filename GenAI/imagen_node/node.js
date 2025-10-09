import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import { fileTypeFromFile } from "file-type";

dotenv.config();

const config = {
    title: "Imagen AI Images",
    category: "GenAI",
    type: "imagen_node",
    icon: {},
    desc: "Generate AI images using Google Imagen",
    credit: 14,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Image generation prompt",
            name: "Prompt",
            type: "Text",
        },
        {
            desc: "Seed value for generation (optional)",
            name: "Seed",
            type: "Number",
        },
        {
            desc: "Quality of the image (applicable only if the output type is jpeg",
            name: "Image Quality",
            type: "Number",
        },
    ],
    outputs: [
        {
            desc: "Temporary link to the image",
            name: "Image Link",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "Image generation prompt",
            name: "Prompt",
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
            desc: "Aspect ration of the generated image",
            name: "Ratio",
            type: "select",
            value: "1:1",
            options: [
                "1:1",
                "9:16",
                "16:9",
                "3:4",
                "4:3",
            ],
        },
        {
            desc: "Model to be used for image generation",
            name: "Model",
            type: "select",
            value: "imagen-3.0-generate-002",
            options: [
                "imagen-4.0-generate-preview-06-06",
                "imagen-4.0-fast-generate-preview-06-06",
                "imagen-4.0-ultra-generate-preview-06-06",
                "imagen-3.0-generate-002",
                "imagen-3.0-generate-001",
                "imagen-3.0-fast-generate-001",
            ],
        },
        {
            desc: "Should people be generated in the image",
            name: "Person",
            type: "select",
            value: "allow_all",
            options: [
                "allow_adult",
                "allow_all",
                "dont_allow",        
            ],
        },
        {
            desc: "Output type of the image",
            name: "Image Format",
            type: "select",
            value: "jpeg",
            options: [
                "jpeg",
                "png",      
            ],
        },
        {
            desc: "Quality of the image (applicable only if the output type is jpeg",
            name: "Image Quality",
            type: "Slider",
            value: 75,
            min: 0,
            max: 100,
            step: 1,
        },
    ],
    difficulty: "easy",
    tags: ["imagen", "google", "ai", "image"],
}

class imagen_node extends BaseNode {

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
        const Model = contents.find((e) => e.name === "Model")?.value || "imagen-3.0-generate-002";

        const modelPricing = {
            "imagen-4.0-generate-preview-06-06": 27,
            "imagen-4.0-fast-generate-preview-06-06": 14,
            "imagen-4.0-ultra-generate-preview-06-06": 40,
            "imagen-3.0-generate-002": 27,
            "imagen-3.0-generate-001": 27,
            "imagen-3.0-fast-generate-001": 14,
        };

        const creditUsage = modelPricing[Model];

        return creditUsage;
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

        webconsole.info("IMAGEN NODE | Configuring model");
        
        const PromptFilter = inputs.find((e) => e.name === "Prompt");
        const Prompt = PromptFilter?.value || contents.find((e) => e.name === "Prompt")?.value || "";

        const SeedFilter = inputs.find((e) => e.name === "Seed");
        const Seed = SeedFilter?.value || contents.find((e) => e.name === "Seed")?.value || NaN;

        const Model = contents.find((e) => e.name === "Model")?.value || "imagen-3.0-generate-002";
        const aspectRatio = contents.find((e) => e.name === "Ratio")?.value || "1:1";
        const peopleAllow = contents.find((e) => e.name === "Person")?.value || "allow_all";
        let imageFormat = contents.find((e) => e.name === "Image Format")?.value || "jpeg";
        let imageQuality = contents.find((e) => e.name === "Image Quality")?.value || 75;

        imageFormat = imageFormat === "jpeg" ? "image/jpeg" : "image/png";
        imageQuality = Math.max(0, Math.min(Number.parseInt(imageQuality), 100));

        // Model pricing in deforge tokens
        const modelPricing = {
            "imagen-4.0-generate-preview-06-06": 27,
            "imagen-4.0-fast-generate-preview-06-06": 14,
            "imagen-4.0-ultra-generate-preview-06-06": 40,
            "imagen-3.0-generate-002": 27,
            "imagen-3.0-generate-001": 27,
            "imagen-3.0-fast-generate-001": 14,
        };

        const creditUsage = modelPricing[Model];
        this.setCredit(creditUsage);

        if (!Prompt) {
            webconsole.error("IMAGEN NODE | No Prompt provided");
            return null;
        }

        const PROJECT_ID = process.env.IMAGEN_PROJECT_ID;
        const LOCATION_ID = process.env.IMAGEN_LOCATION_ID || 'us-central1';
        const API_ENDPOINT = process.env.IMAGEN_API_ENDPOINT || 'us-central1-aiplatform.googleapis.com';
        const MODEL_ID = Model;

        if (!PROJECT_ID) {
            webconsole.error("IMAGEN NODE | IMAGEN_PROJECT_ID not set in .env file");
            return null;
        }

        const getAccessToken = () => {
            webconsole.info('IMAGEN NODE | Obtaining Google Cloud access token');
            return new Promise((resolve, reject) => {
                exec('gcloud auth print-access-token', (error, stdout, stderr) => {
                    if (error) {
                        webconsole.error(`IMAGEN NODE | gcloud auth error: ${error.message}`);
                        return reject(new Error('Failed to get Google Cloud access token. Is gcloud CLI installed and authenticated?'));
                    }
                    resolve(stdout.trim());
                });
            });
        }

        const generateImageWithImagen = async (accessToken) => {
            const predictUrl = `https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:predict`;

            const requestBody = {
                instances: [
                    {
                        prompt: Prompt,
                        ...(!Number.isNaN(Seed) && { seed: Math.max(0, Number.parseInt(Seed)) })
                    },
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: aspectRatio,
                    outputOptions: {
                        mimeType: imageFormat,
                        ...(imageFormat === "image/jpeg" && { compressionQuality: imageQuality }),
                    },
                    personGeneration: peopleAllow,
                    includeRaiReason: true,
                }
            };

            webconsole.info('IMAGEN NODE | Sending image generation request to Imagen');
            try {
                const response = await axios.post(predictUrl, requestBody, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });
                
                // Extract the image content from the response
                if (response.data.predictions && response.data.predictions.length > 0) {
                    const prediction = response.data.predictions[0];
                    if (Object.keys(prediction).includes("raiFilterReason")) {
                        webconsole.error("IMAGEN NODE | Prompt got caught in google's filter, rewrite the prompt");
                        return null;
                    }
                    
                    const imageContent = prediction.bytesBase64Encoded;
                    if (!imageContent) {
                        throw new Error('imageContent field is missing or empty in Imagen response');
                    }
                    
                    webconsole.info(`IMAGEN NODE | Image generation completed successfully`);
                    return { imageContent,  imageFormat: imageFormat.slice(-3)};
                } else {
                    throw new Error('No predictions found in Imagen response');
                }

            } catch (error) {
                webconsole.error(`IMAGEN NODE | Error generating image with imagen: ${error.message}`);
                if (error.response) {
                    webconsole.error(`IMAGEN NODE | Imagen Response: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            }
        }

        const saveImageFile = async (imageContent, extension) => {
            if (!imageContent) {
                throw new Error('imageContent is undefined or null');
            }
            
            if (typeof imageContent !== 'string') {
                throw new Error(`imageContent should be a string, but received: ${typeof imageContent}`);
            }
            
            const tempDir = "./runtime_files";
            if (!await fs.stat(tempDir).catch(() => null)) {
                await fs.mkdir(tempDir, { recursive: true });
            }
            const outputImageFilename = path.join(tempDir, `generated_image_${Date.now()}.${extension}`);

            webconsole.info(`IMAGEN NODE | Saving image file to ${outputImageFilename}`);

            try {
                const imageBuffer = Buffer.from(imageContent, 'base64');
                await fs.writeFile(outputImageFilename, imageBuffer);
                webconsole.success(`IMAGEN NODE | Image successfully saved to ${outputImageFilename}`);
                return outputImageFilename;
            } catch (error) {
                webconsole.error(`IMAGEN NODE | Error saving image file: ${error.message}`);
                throw error;
            }
        }

        let imageFilePath = null;
        try {
            const accessToken = await getAccessToken();
            const { imageContent, imageFormat } = await generateImageWithImagen(accessToken);
            imageFilePath = await saveImageFile(imageContent, imageFormat);

            if (imageFilePath) {
                const imageFIleMime = await fileTypeFromFile(imageFilePath);
                if (!imageFIleMime || !imageFIleMime.mime.startsWith('image/')) {
                    webconsole.error("IMAGEN NODE | The generated file is not a valid image file.");
                }

                const imageFileStream = fs.createReadStream(imageFilePath);
                const uploadedUrl = await serverData.s3Util.addFile(
                    `${path.basename(imageFilePath)}`,
                    imageFileStream,
                    imageFIleMime.mime,
                );
                await fs.unlink(imageFilePath);
                return { "Image Link": uploadedUrl, "Credits": this.getCredit() };
            }
            return null;
        } catch (error) {
            webconsole.error(`IMAGEN NODE | An error occurred during the process: ${error.message}`);
            if (imageFilePath) {
                try {
                    await fs.unlink(imageFilePath);
                    webconsole.info(`IMAGEN NODE | Cleaned up temporary image file: ${imageFilePath}`);
                } catch (cleanupError) {
                    webconsole.error(`IMAGEN NODE | Could not clean up ${imageFilePath}: ${cleanupError.message}`);
                }
            }
            this.setCredit(0);
            return null;
        }
    }
}

export default imagen_node;