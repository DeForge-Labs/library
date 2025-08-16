import BaseNode from "../../core/BaseNode/node.js";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { Downloader } from "nodejs-file-downloader";
import { fileTypeFromFile } from "file-type";
import { v4 as uuid } from "uuid";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const config = {
    title: "Dub Video Audio",
    category: "audio",
    type: "dub_media",
    icon: {},
    desc: "Dub your video or audio to another language using Eleven Labs",
    credit: 2000,
    inputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Link to the Media to dub",
            name: "Media Link",
            type: "Text",
        }
    ],
    outputs: [
        {
            desc: "Link to the dubbed media file",
            name: "Dubbed Link",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "Link to the Media to dub",
            name: "Media Link",
            type: "Text",
            value: "Link here ...",
        },
        {
            desc: "Language to dub media into",
            name: "Dub Language",
            type: "select",
            value: "Japanese",
            options: [
                "English",
                "Hindi",
                "Portuguese",
                "Chinese",
                "Spanish",
                "French",
                "German",
                "Japanese",
                "Arabic",
                "Russian",
                "Korean",
                "Indonesian",
                "Italian",
                "Dutch",
                "Turkish",
                "Polish",
                "Swedish",
                "Filipino",
                "Malay",
                "Romanian",
                "Ukrainian",
                "Greek",
                "Czech",
                "Danish",
                "Finnish",
                "Bulgarian",
                "Croatian",
                "Slovak",
                "Tamil",
            ],
        },
    ],
    difficulty: "easy",
    tags: ["dubbing", "translate", "audio", "elevenlabs"],
}

class dub_media extends BaseNode {
    constructor() {
        super(config);
    }

    uploadTo0x0st = async (filePath) => {
        const url = 'https://0x0.st';
        const form = new FormData();
        const fileStream = fs.readFileSync(filePath);
        form.append('file', fileStream, { filename: path.basename(filePath) });

        try {
            const response = await axios.post(url, form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Deforge/1.0 (contact@deforge.io)',
                },
            });

            if (response.status === 200) {
                const uploadedUrl = response.data.trim();
                return uploadedUrl;
            } else {
                throw new Error(`0x0.st upload failed with status ${response.status}: ${response.data}`);
            }
        } catch (error) {
            webconsole.error(`TEXT TO SPEECH NODE | Error uploading audio to 0x0.st: ${error.message}`);
        }
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("DUB MEDIA NODE | Started execution");

            const LinkFilter = inputs.find((e) => e.name === "Media Link");
            const Link = LinkFilter?.value || contents.find((e) => e.name === "Media Link")?.value || "";

            if (!Link) {
                webconsole.error("DUB MEDIA NODE | No media link provided");
                return null;
            }

            const DubLanguage = contents.find((e) => e.name === "Dub Language")?.value || "Japanese";
            const langMap = {
                "English": "en",
                "Hindi": "hi",
                "Portuguese": "pt",
                "Chinese": "zh",
                "Spanish": "es",
                "French": "fr",
                "German": "de",
                "Japanese": "ja",
                "Arabic": "ar",
                "Russian": "ru",
                "Korean": "ko",
                "Indonesian": "id",
                "Italian": "it",
                "Dutch": "nl",
                "Turkish": "tr",
                "Polish": "pl",
                "Swedish": "sv",
                "Filipino": "fil",
                "Malay": "ms",
                "Romanian": "ro",
                "Ukrainian": "uk",
                "Greek": "el",
                "Czech": "cs",
                "Danish": "da",
                "Finnish": "fi",
                "Bulgarian": "bg",
                "Croatian": "hr",
                "Slovak": "sk",
                "Tamil": "ta",
            };

            const elevenlabs = new ElevenLabsClient();

            const tempDir = "./runtime_files";
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            webconsole.info("DUB MEDIA NODE | Downloading media...");
            const downloader = new Downloader({
                url: Link,
                directory: tempDir,
            });

            const { filePath } = await downloader.download();
            if (!filePath) {
                webconsole.error("DUB MEDIA NODE | Media download failed.");
                return null;
            }
            
            const fileType = await fileTypeFromFile(filePath);
            if (!fileType || (!fileType.mime.startsWith('audio/') && !fileType.mime.startsWith('video/'))) {
                webconsole.error("DUB MEDIA NODE | The downloaded file is not a valid media file.");
                fs.unlinkSync(filePath);
                return null;
            }
            const mediaBlobBuffer = fs.readFileSync(filePath);
            const mediaBlob = new Blob([mediaBlobBuffer], {type: fileType.mime});

            webconsole.info("DUB MEDIA NODE | Dubbing media");

            const dubInstance = await elevenlabs.dubbing.create({
                file: mediaBlob,
                targetLang: langMap[DubLanguage]
            });

            webconsole.info("DUB MEDIA NODE | Created Eleven Labs dubbing job with ID: ", dubInstance.dubbingId);

            fs.unlinkSync(filePath);

            while (true) {
                webconsole.info("DUB MEDIA NODE | Polling dubbing status ...");
                const { status } = await elevenlabs.dubbing.get(dubInstance.dubbingId);

                if (status === "dubbed") {
                    webconsole.success("DUB MEDIA NODE | Successfully dubbed media");
                    const dubbedFile = await elevenlabs.dubbing.audio.get(
                        dubInstance.dubbingId,
                        langMap[DubLanguage],
                    );

                    const fileName = `${uuid()}.hold`;
                    const fileStream = fs.createWriteStream(`./runtime_files/${fileName}`);
                    
                    const dubReader = dubbedFile.getReader();
                    const writeChunks = async () => {
                        while (true) {
                            const { done, value } = await dubReader.read();
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

                    const dubFileType = await fileTypeFromFile(`./runtime_files/${fileName}`);
                    
                    let fileExtension = 'mp3'; // default fallback
                    if (dubFileType && dubFileType.mime) {
                        // Extract extension from mime type if ext is not available
                        if (dubFileType.mime.includes('mp4')) {
                            fileExtension = 'mp4';
                        } else if (dubFileType.mime.includes('mp3') || dubFileType.mime.includes('mpeg3') || dubFileType.mime.includes('x-mpeg-3')) {
                            fileExtension = 'mp3';
                        }
                    }
                    
                    const newFileName = `${uuid()}.${fileExtension}`;
                    const newFilePath = `./runtime_files/${newFileName}`;
                    
                    fs.renameSync(`./runtime_files/${fileName}`, newFilePath);
                    
                    const dubLink = await this.uploadTo0x0st(newFilePath);
                    webconsole.success("DUB MEDIA NODE | Succefully uploaded to 0x0: ", dubLink);
                    fs.unlinkSync(newFilePath);

                    return {
                        "Dubbed Link": dubLink
                    };
                }
                
                // Wait 5 second before next poll
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
        } catch (error) {
            webconsole.error("DUB MEDIA NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default dub_media;