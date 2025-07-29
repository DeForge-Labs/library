import BaseNode from "../../core/BaseNode/node.js";
import { Scraper } from "agent-twitter-client";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const config = {
    title: "AI Persona Creator",
    category: "LLM",
    type: "persona_generator",
    icon: {},
    desc: "Generate a persona of any user from any social media and add to a LLM",
    inputs: [
        {
            desc: "Username or Link to the user",
            name: "Username",
            type: "Text",
        },
    ],
    outputs: [
        {
            desc: "The persona details of the user",
            name: "Persona",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "Username or Link to the user",
            name: "Username",
            type: "Text",
            value: "Enter username or link here...",
        },
        {
            desc: "The social media to search for",
            name: "Social",
            type: "select",
            value: "Twitter",
            options: [
            "Twitter",        
            ],
        },
    ],
    difficulty: "easy",
    tags: ["ai", "search", "social"],
}

class twitterUtils {

    extractTwitterUsername(input) {
        if (!input || typeof input !== 'string') {
            return null;
        }

        const trimmedInput = input.trim();
        
        // Check if it's a URL
        if (trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')) {
            try {
                const url = new URL(trimmedInput);
                
                // Check if it's a valid Twitter/X domain
                if (!['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com'].includes(url.hostname)) {
                    return null;
                }
                
                const pathParts = url.pathname.split('/').filter(part => part.length > 0);
                
                // Check for invalid URLs like status links
                if (pathParts.length === 0 || pathParts.includes('status') || pathParts.includes('i')) {
                    return null;
                }
                
                // Extract username from URL (first path segment)
                const username = pathParts[0];
                return this.validateUsername(username);
                
            } catch (error) {
                return null;
            }
        }
        
        // Handle @username format
        let username = trimmedInput;
        if (username.startsWith('@')) {
            username = username.substring(1);
        }
        
        return this.validateUsername(username);
    }

    validateUsername(username) {
        if (!username || username.length === 0) {
            return null;
        }
        
        // Twitter username rules:
        // - Can only contain letters, numbers, and underscores
        // - Must be 1-15 characters long
        // - Cannot be just numbers
        const usernameRegex = /^[A-Za-z0-9_]{1,15}$/;
        const isOnlyNumbers = /^\d+$/.test(username);
        
        if (!usernameRegex.test(username) || isOnlyNumbers) {
            return null;
        }
        
        return username;
    }
}

class persona_generator extends BaseNode {

    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {

        webconsole.info("PERSONA CREATOR NODE | Searching your given user");

        const userFilter = inputs.find((e) => e.name === "Username");
        const user = userFilter?.value || contents.find((e) => e.name === "Username")?.value || "";

        if (!user) {
            webconsole.error("PERSONA CREATOR NODE | Username or Link required");
            return null;
        }

        const socialFilter = contents.find((e) => e.name === "Social");
        const social = socialFilter?.value || "twitter";

        let posts = [];

        switch (social) {
            case "twitter":
                try {
                    const xUtil = new twitterUtils();
                    // Extract username from various Twitter/X input formats
                    let username = xUtil.extractTwitterUsername(user);
                    
                    if (!username) {
                        webconsole.error("PERSONA CREATOR NODE | Invalid Twitter username or link provided");
                        return null;
                    }
                    
                    webconsole.info(`PERSONA CREATOR NODE | Extracted Twitter username: ${username}`);
                    
                    const scraper = new Scraper();
                    await scraper.login(
                        process.env.TWITTER_USERNAME,
                        process.env.TWITTER_PASSWORD,
                        process.env.TWITTER_EMAIL,
                        process.env.TWITTER_API_KEY,
                        process.env.TWITTER_API_SECRET_KEY,
                        process.env.TWITTER_ACCESS_TOKEN,
                        process.env.TWITTER_ACCESS_TOKEN_SECRET
                    );

                    const profile = await scraper.getProfile(username);
                    if (!profile) {
                        webconsole.error("PERSONA CREATOR NODE | No profile found with username: ", username);
                        return null;
                    }

                    const tweetGenerator = scraper.getTweets(username, 10);
                    for (const tweet of tweetGenerator) {
                        posts.push(tweet);
                    }
                    
                } catch (error) {
                    webconsole.error(`PERSONA CREATOR NODE | Error processing Twitter input: ${error.message}`);
                    return null;
                }
                break;
        
            default:
                webconsole.error(`PERSONA CREATOR NODE | Unsupported social media: ${social}`);
                return null;
        }

        try {
            const gemini = new GoogleGenAI({});
            const geminiResponse = await gemini.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Analyze these twitter posts and reply properly: ${JSON.stringify(posts)}`,
                config: {
                    systemInstruction: "You analyze Twitter posts and generate a prompt that describes the persona of the user whose posts you analyzed for LLMs to use it as their persona instruction. Generate a prompt with clear instructions for the LLM to act like the user. Do not reply with any greeting or any other information, reply with just the prompt. This is necessary as your reply will be directly fed to another LLM.",
                },
            });

            const personaPrompt = geminiResponse.text;
            webconsole.success("PERSONA CREATOR NODE | Successfully generated persona");

            return {
                "Persona": personaPrompt
            };
        } catch (error) {
            webconsole.error("PERSONA CREATOR NODE | Some error occured while generating persona: ", error);
            return null;
        }
    }
}

export default persona_generator;