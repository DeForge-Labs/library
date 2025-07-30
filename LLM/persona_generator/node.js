import BaseNode from "../../core/BaseNode/node.js";
import { Scraper } from "agent-twitter-client";
import { GoogleGenAI } from "@google/genai";
import postgres from "postgres";
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

class PersonaDatabase {
    constructor() {
        this.sql = postgres(process.env.POSTGRES_URL);
        this.initialized = false;
    }

    async initializeTable() {
        if (this.initialized) return;
        
        try {
            await this.sql`
                CREATE TABLE IF NOT EXISTS personas (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(15) NOT NULL,
                    social_media VARCHAR(50) NOT NULL DEFAULT 'twitter',
                    persona_prompt TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(username, social_media)
                )
            `;
            
            // Create index for faster lookups
            await this.sql`
                CREATE INDEX IF NOT EXISTS idx_personas_username_social 
                ON personas(username, social_media)
            `;
            
            this.initialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize personas table: ${error.message}`);
        }
    }

    async getPersona(username, socialMedia = 'twitter') {
        await this.initializeTable();
        
        try {
            const result = await this.sql`
                SELECT persona_prompt, created_at, updated_at 
                FROM personas 
                WHERE username = ${username} AND social_media = ${socialMedia}
            `;
            
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new Error(`Failed to retrieve persona: ${error.message}`);
        }
    }

    async savePersona(username, personaPrompt, socialMedia = 'twitter') {
        await this.initializeTable();
        
        try {
            const result = await this.sql`
                INSERT INTO personas (username, social_media, persona_prompt, updated_at)
                VALUES (${username}, ${socialMedia}, ${personaPrompt}, CURRENT_TIMESTAMP)
                ON CONFLICT (username, social_media)
                DO UPDATE SET 
                    persona_prompt = ${personaPrompt},
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, created_at, updated_at
            `;
            
            return result[0];
        } catch (error) {
            throw new Error(`Failed to save persona: ${error.message}`);
        }
    }

    async close() {
        await this.sql.end();
    }
}

class persona_generator extends BaseNode {

    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {

        webconsole.info("PERSONA CREATOR NODE | Searching your given user");

        const redisUtil = serverData.redisUtil;
        const personaDB = new PersonaDatabase();

        const userFilter = inputs.find((e) => e.name === "Username");
        const user = userFilter?.value || contents.find((e) => e.name === "Username")?.value || "";

        if (!user) {
            webconsole.error("PERSONA CREATOR NODE | Username or Link required");
            return null;
        }

        const socialFilter = contents.find((e) => e.name === "Social");
        const social = socialFilter?.value || "twitter";

        let posts = [];
        let username = null;

        switch (social) {
            case "Twitter":
                try {
                    // Extract username first
                    const xUtil = new twitterUtils();
                    username = xUtil.extractTwitterUsername(user);
                    
                    if (!username) {
                        webconsole.error("PERSONA CREATOR NODE | Invalid Twitter username or link provided");
                        return null;
                    }

                    webconsole.info(`PERSONA CREATOR NODE | Extracted Twitter username: ${username}`);

                    // Check if we already have a cached persona for this user
                    try {
                        const cachedPersona = await personaDB.getPersona(username, social.toLowerCase());
                        if (cachedPersona) {
                            webconsole.info(`PERSONA CREATOR NODE | Found cached persona for ${username}`);
                            await personaDB.close();
                            return {
                                "Persona": cachedPersona.persona_prompt
                            };
                        }
                    } catch (error) {
                        webconsole.error(`PERSONA CREATOR NODE | Database error (continuing with scraping): ${error.message}`);
                    }

                    webconsole.info(`PERSONA CREATOR NODE | No cached persona found, scraping ${social} for ${username}`);
                    const scraper = new Scraper();

                    const cookies = await redisUtil.getKey("deforge:twitter:cookies");
                    if (cookies) {
                        await scraper.setCookies(JSON.parse(cookies).cookies);
                    }
                    else {
                        await scraper.login(
                            process.env.TWITTER_USERNAME,
                            process.env.TWITTER_PASSWORD,
                            process.env.TWITTER_EMAIL,
                            process.env.TWITTER_TWO_FACTOR_SECRET,
                            process.env.TWITTER_API_KEY,
                            process.env.TWITTER_API_SECRET_KEY,
                            process.env.TWITTER_ACCESS_TOKEN,
                            process.env.TWITTER_ACCESS_TOKEN_SECRET
                        );

                        const newCookies = await scraper.getCookies();
                        await redisUtil.setKey("deforge:twitter:cookies",
                            JSON.stringify({ cookies: newCookies.map((cookie) => cookie.toString()) })
                        );
                    }

                    const profile = await scraper.getProfile(username);
                    if (!profile) {
                        webconsole.error("PERSONA CREATOR NODE | No profile found with username: ", username);
                        await personaDB.close();
                        return null;
                    }

                    const tweetGenerator = scraper.getTweets(username, 10);
                    for await (const tweet of tweetGenerator) {
                        posts.push(tweet);
                    }
                    
                } catch (error) {
                    webconsole.error(`PERSONA CREATOR NODE | Error processing Twitter input: ${error}`);
                    await personaDB.close();
                    return null;
                }
                break;
        
            default:
                webconsole.error(`PERSONA CREATOR NODE | Unsupported social media: ${social}`);
                await personaDB.close();
                return null;
        }

        try {
            const gemini = new GoogleGenAI({});
            const geminiResponse = await gemini.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Analyze these twitter posts by ${username} and reply properly: ${JSON.stringify(posts)}`,
                config: {
                    systemInstruction: "You analyze Twitter posts and generate a prompt that describes the persona of the user whose posts you analyzed for LLMs to use it as their persona instruction. Generate a prompt with clear instructions for the LLM to act like the user. Do not reply with any greeting or any other information, reply with just the prompt. This is necessary as your reply will be directly fed to another LLM.",
                },
            });

            const personaPrompt = geminiResponse.text;
            webconsole.success("PERSONA CREATOR NODE | Successfully generated persona");

            // Save the generated persona to the database
            try {
                await personaDB.savePersona(username, personaPrompt, social.toLowerCase());
                webconsole.info(`PERSONA CREATOR NODE | Persona saved to database for ${username}`);
            } catch (error) {
                webconsole.error(`PERSONA CREATOR NODE | Failed to save persona to database: ${error.message}`);
            }

            await personaDB.close();

            return {
                "Persona": personaPrompt
            };
        } catch (error) {
            webconsole.error("PERSONA CREATOR NODE | Some error occured while generating persona: ", error);
            await personaDB.close();
            return null;
        }
    }
}

export default persona_generator;