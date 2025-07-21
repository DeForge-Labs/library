import BaseNode from "../../core/BaseNode/node.js";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";

dotenv.config();

const config = {
    title: "Speech To Text",
    category: "audio",
    type: "speech_to_text",
    icon: {},
    desc: "Convert speech to text using Eleven Labs",
    inputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Link to the Audio to convert",
            name: "Audio Link",
            type: "Text",
        }
    ],
    outputs: [
        {
            desc: "Transcribed text",
            name: "Transcription",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "Link to the Audio to convert",
            name: "Audio Link",
            type: "Text",
            value: "Link here ...",
        },
        {
            desc: "Model to use for transcription",
            name: "Model",
            type: "select",
            value: "scribe v1",
            options: [
                "scribe v1",
                "scribe v1 experimental",
            ],
        },
    ],
    difficulty: "easy",
    tags: ["transcribe", "audio", "elevenlabs"],
}

class speech_to_text extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("SPEECH TO TEXT NODE | Started execution");

            const LinkFilter = inputs.find((e) => e.name === "Audio Link");
            const Link = LinkFilter?.value || contents.find((e) => e.name === "Audio Link")?.value || "";

            if (!Link) {
                webconsole.error("SPEECH TO TEXT NODE | No audio link provided");
                return null;
            }

            const Model = contents.find((e) => e.name === "Model")?.value || "scribe v1";
            const modelMap = {
                "scribe v1": "scribe_v1",
                "scribe v1 experimental": "scribe_v1_experimental",
            };

            const elevenlabs = new ElevenLabsClient();

            const fileResponse = await fetch(Link);
            const audioBlob = new Blob([await fileResponse.arrayBuffer()], { type: "audio/ogg" });

            webconsole.info("SPEECH TO TEXT NODE | Transcribing audio");

            const transcription = await elevenlabs.speechToText.convert({
                file: audioBlob,
                modelId: modelMap[Model],
                diarize: false,
                tagAudioEvents: false,
            });

            const transcribedText = transcription.text;
            webconsole.success("SPEECH TO TEXT NODE | Successfully transcribed audio");
            return {
                "Transcription": transcribedText
            };
            
        } catch (error) {
            webconsole.error("TG NODE | Some error occured");
            return null;
        }
    }
}

export default speech_to_text;