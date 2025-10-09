import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createWriteStream } from "fs";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import FormData from "form-data";
import { parseFile } from 'music-metadata';
import { fileTypeFromFile } from "file-type";
import dotenv from "dotenv";

dotenv.config();

const config = {
    title: "Text to Speech",
    category: "audio",
    type: "text_to_speech",
    icon: {},
    desc: "Convert text to speech using Eleven Labs",
    credit: 150,
    inputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Text to generate speech for",
            name: "Content",
            type: "Text",
        },
        {
            desc: "Specific voice ID to use (will override the above option)",
            name: "VoiceID",
            type: "Text",
        },
        {
            desc: "Emotional setting of the voice (lower is more emotional)",
            name: "Emotion",
            type: "Number",
        },
        {
            desc: "Speed of the generated speech",
            name: "Speed",
            type: "Number",
        },
    ],
    outputs: [
        {
            desc: "Generated audio",
            name: "Audio Link",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "Text to generate speech for",
            name: "Content",
            type: "TextArea",
            value: "Text here ...",
        },
        {
            desc: "Voice model to use",
            name: "Voice",
            type: "select",
            value: "George (warm resonance)",
            options: [
                "Aria (middle aged female calm)",
                "Sarah (young adult woman confident)",
                "Laura (young adult female sunny)",
                "Charlie (young aussie male confident)",
                "George (warm resonance)",
                "Callum (gravelly edgy)",
            ],
        },
        {
            desc: "Specific voice ID to use (will override the above option)",
            name: "VoiceID",
            type: "Text",
            value: "ID here ...",
        },
        {
            desc: "Emotional setting of the voice (lower is more emotional)",
            name: "Emotion",
            type: "Slider",
            value: 0.5,
            min: 0.0,
            max: 1.0,
            step: 0.1,
        },
        {
            desc: "Speed of the generated speech",
            name: "Speed",
            type: "Slider",
            value: 1.0,
            min: 0,
            max: 2.0,
            step: 0.1,
        },
        {
            desc: "Model to use for speech generation",
            name: "Model",
            type: "select",
            value: "eleven_multilingual_v2",
            options: [
                "eleven_multilingual_v2",
                "eleven_v3",
                "eleven_flash_v2_5",
                "eleven_turbo_v2_5",
            ],
        },
    ],
    difficulty: "easy",
    tags: ["TTS", "audio", "elevenlabs"],
}

class text_to_speech extends BaseNode {
    constructor() {
        super(config);
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
        try {
            webconsole.info("TEXT TO SPEECH NODE | Started execution");

            const ContentFilter = inputs.find((e) => e.name === "Content");
            const ContentText = ContentFilter?.value || contents.find((e) => e.name === "Content")?.value || "";

            if (!ContentText) {
                webconsole.error("TEXT TO SPEECH NODE | No text provided");
                return null;
            }

            const VoiceIDFilter = inputs.find((e) => e.name === "VoiceID");
            let VoiceID = VoiceIDFilter?.value || contents.find((e) => e.name === "VoiceID")?.value || "";

            const Voice = contents.find((e) => e.name === "Voice")?.value || "George (warm resonance)";
            const voiceMap = {
                "Aria (middle aged female calm)": "9BWtsMINqrJLrRacOk9x",
                "Sarah (young adult woman confident)": "EXAVITQu4vr4xnSDxMaL",
                "Laura (young adult female sunny)": "FGY2WhTYpPnrIDTdsKH5",
                "Charlie (young aussie male confident)": "IKne3meq5aSn9XLyUdCD",
                "George (warm resonance)": "JBFqnCBsd6RMkjVDRZzb",
                "Callum (gravelly edgy)": "N2lVS1w4EtoT3dr4eOWO",
            }

            if (!VoiceID) {
                VoiceID = voiceMap[Voice];
            }

            const EmotionFilter = inputs.find((e) => e.name === "Emotion");
            let Emotion = EmotionFilter?.value || contents.find((e) => e.name === "Emotion")?.value || 0.5;
            Emotion = Math.max(0.0, Math.min(Emotion, 1.0));

            const SpeedFilter = inputs.find((e) => e.name === "Speed");
            let Speed = SpeedFilter?.value || contents.find((e) => e.name === "Speed")?.value || 1.0;
            Speed = Math.max(0.0, Math.min(Speed, 2.0));

            const Model = contents.find((e) => e.name === "Model")?.value || "eleven_multilingual_v2";

            const elevenlabs = new ElevenLabsClient();

            const tempDir = "./runtime_files";
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            webconsole.info("TEXT TO SPEECH NODE | Generating audio");

            const audio = await elevenlabs.textToSpeech.convert(VoiceID, {
                modelId: Model,
                text: ContentText,
                outputFormat: "mp3_44100_128",
                voiceSettings: {
                    stability: Number.parseInt(Emotion),
                    speed: Number.parseFloat(Speed),
                },
            });

            webconsole.success("TEXT TO SPEECH NODE | Audio generated successfully");

            const fileName = `${uuid()}.mp3`;
            const fileStream = createWriteStream(`./runtime_files/${fileName}`);

            const audioReader = audio.getReader();
            const writeChunks = async () => {
                while (true) {
                    const { done, value } = await audioReader.read();
                    if (done) {
                        break;
                    }
                    fileStream.write(value);
                }
                fileStream.end();
            };
            await writeChunks();
            await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
            });

            const metadata = await parseFile(`./runtime_files/${fileName}`);
            const durationInSeconds = metadata.format.duration || 60;

            const creditUsage = Math.ceil(durationInSeconds * (100 / 60));
            this.setCredit(creditUsage);

            const fileMimeType = await fileTypeFromFile(`./runtime_files/${fileName}`);
            if (!fileMimeType || !fileMimeType.mime.startsWith('audio/')) {
                webconsole.error("TEXT TO SPEECH NODE | The generated file is not a valid audio file.");
                fs.unlinkSync(`./runtime_files/${fileName}`);
                return null;
            }

            const audioFileStream = fs.createReadStream(`./runtime_files/${fileName}`);

            const audioLink = await serverData.s3Util.addFile(
                bucket=undefined,
                key=fileName,
                body=audioFileStream,
                contentType=fileMimeType.mime,
            );
            fs.unlinkSync(`./runtime_files/${fileName}`);


            webconsole.success("TEXT TO SPEECH NODE | Successfully uploaded audio");
            return {
                "Audio Link": audioLink,
                "Credits": this.getCredit(),
            };
            
        } catch (error) {
            webconsole.error("TEXT TO SPEECH NODE | Some error occured: ", error);
            this.setCredit(0);
            return null;
        }
    }
}

export default text_to_speech;