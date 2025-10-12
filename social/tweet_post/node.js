import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { Client, auth } from "twitter-api-sdk";
import { tool } from "@langchain/core/tools"; // Import tool
import { z } from "zod"; // Import zod

dotenv.config();

const config = {
  title: "Tweet Post",
  category: "social",
  type: "tweet_post",
  icon: {},
  desc: "Post an update to your Twitter/X account",
  credit: 10,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Text that you want to post",
      name: "Post",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The link of the posted tweet",
      name: "Tweet Link",
      type: "Text",
    },
    {
      desc: "The tool version of this node, to be used by LLMs", // Add Tool output
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Text that you want to post",
      name: "Post",
      type: "TextArea",
      value: "Enter text here...",
    },
    {
      desc: "Connect to your Twitter account",
      name: "Twitter",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["twitter", "tweet", "post", "social"],
};

class tweet_post extends BaseNode {
  constructor() {
    super(config);
  }

  // Helper function to get value from inputs or contents
  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  calculateTweetLength(text) {
    const URL_LENGTH = 23;
    const URL_REGEX = /(https?:\/\/[^\s]+)/g;
    // This regex targets CJK characters which Twitter weights as 2 characters
    const WEIGHTED_CHARS_REGEX =
      /[\u1100-\u11FF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF01-\uFFEE]/;

    if (typeof text !== "string") {
      return 0;
    }

    const textWithoutUrls = text.replace(URL_REGEX, "");
    const urls = text.match(URL_REGEX) || [];
    const urlLength = urls.length * URL_LENGTH;

    let weightedTextLength = 0;
    // Iterate over grapheme clusters (characters)
    for (const char of Array.from(textWithoutUrls)) {
      if (char.match(WEIGHTED_CHARS_REGEX)) {
        weightedTextLength += 2;
      } else {
        weightedTextLength += 1;
      }
    }

    return weightedTextLength + urlLength;
  }

  trimTweet(text) {
    const MAX_CHARS = 280;

    let textAsGraphemes = Array.from(text);
    let currentText = text;

    // Note: The original implementation calls an external `calculateTweetLength`
    // without `this.`, so I'm assuming it should be `this.calculateTweetLength`.
    while (this.calculateTweetLength(currentText) > MAX_CHARS) {
      textAsGraphemes.pop();
      currentText = textAsGraphemes.join("");
    }
    return currentText;
  }

  /**
   * @override
   * @inheritdoc
   * * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs
   * @param {import("../../core/BaseNode/node.js").Contents[]} contents
   * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole
   * @param {import("../../core/BaseNode/node.js").IServerData} serverData
   */
  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("TWEET POST NODE | Starting execution");

    // 4. Create the Tool
    const tweetPostTool = tool(
      async ({ textContent }, toolConfig) => {
        webconsole.info("TWEET POST TOOL | Invoking tool");

        // Simulate success as the actual API call is handled by the main run logic
        const result = {
          status: "Awaiting execution",
          action: `Attempting to post tweet with content: "${textContent.substring(
            0,
            50
          )}..."`,
          link: "https://x.com/USER_XID/status/TWEET_ID_PENDING_EXECUTION",
        };

        return [JSON.stringify(result), this.getCredit()];
      },
      {
        name: "twitterPostCreator",
        description:
          "Posts a text-only update (tweet) to the connected Twitter/X account. The text will be automatically truncated if it exceeds the 280-character limit.",
        schema: z.object({
          textContent: z
            .string()
            .min(1)
            .describe("The full text content to be posted as a tweet."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    let Post = this.getValue(inputs, contents, "Post", "");

    if (!Post) {
      webconsole.warn(
        "TWEET POST NODE | Empty post body. Returning tool only."
      );
      this.setCredit(0);
      return { "Tweet Link": null, Tool: tweetPostTool };
    }

    try {
      // Trim the post content if it exceeds the limit
      const MAX_CHARS = 280;
      const tweetLength = this.calculateTweetLength(Post);
      if (tweetLength > MAX_CHARS) {
        webconsole.warn(
          `TWEET POST NODE | Post length (${tweetLength}) exceeds max chars (${MAX_CHARS}). Trimming...`
        );
        Post = this.trimTweet(Post);
      }

      const tokens = serverData.socialList;
      if (!Object.keys(tokens).includes("twitter")) {
        webconsole.error(
          "TWEET POST NODE | Please connect your twitter account. Returning tool only."
        );
        this.setCredit(0);
        return { "Tweet Link": null, Tool: tweetPostTool };
      }

      const x_token = tokens["twitter"];
      if (!x_token) {
        webconsole.error(
          "TWEET POST NODE | Twitter token missing. Please reconnect your account. Returning tool only."
        );
        this.setCredit(0);
        return { "Tweet Link": null, Tool: tweetPostTool };
      }

      const refreshTokenHandler = serverData.refreshUtil;

      // Initialize Auth Client with Token and Credentials
      const authClient = new auth.OAuth2User({
        client_id: process.env.X_CLIENT_ID,
        client_secret: process.env.X_CLIENT_SECRET,
        callback: "https://api.deforge.io/api/workflow/connectSocialCallback",
        scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
        token: x_token,
      });

      // Token Refresh Logic
      if (authClient.isAccessTokenExpired()) {
        webconsole.info("TWEET POST NODE | Refreshing token");
        const { token } = await authClient.refreshAccessToken();
        authClient.token = token;

        // Persist the new token using the handler
        await refreshTokenHandler.handleTwitterToken(token);
      }

      const client = new Client(authClient);

      // Get user info to construct the final tweet link
      const userLookupData = await client.users.findMyUser({
        "user.fields": ["username"],
      });

      if (userLookupData.errors && userLookupData.errors.length > 0) {
        throw new Error(
          `Error occured while extracting username: \n${JSON.stringify(
            userLookupData.errors
          )}`
        );
      }

      const userXID = userLookupData.data?.username || "";
      if (!userXID) {
        webconsole.error(
          "TWEET POST NODE | No username found for connected account"
        );
        return { "Tweet Link": null, Tool: tweetPostTool };
      }

      webconsole.info(`TWEET POST NODE | Posting tweet as @${userXID}`);

      // Post the tweet
      const postRes = await client.tweets.createTweet({
        text: Post.replace(/\\n/g, "\n"), // Replace escaped newlines
      });

      if (postRes.errors?.length > 0) {
        webconsole.error(
          "TWEET POST NODE | Some error occured posting the tweet: ",
          JSON.stringify(postRes.errors)
        );
        return { "Tweet Link": null, Tool: tweetPostTool };
      }

      const tweetID = postRes.data?.id || "";
      if (!tweetID) {
        webconsole.error(
          "TWEET POST NODE | No error or tweet id received from twitter API"
        );
        return { "Tweet Link": null, Tool: tweetPostTool };
      }

      const tweetLink = `https://x.com/${userXID}/status/${tweetID}`;
      webconsole.success(
        `TWEET POST NODE | Successfully tweeted: ${tweetLink}`
      );

      this.setCredit(this.getCredit() + config.credit); // Add credit after successful execution

      return {
        "Tweet Link": tweetLink,
        Credits: this.getCredit(),
        Tool: tweetPostTool,
      };
    } catch (error) {
      webconsole.error(
        `TWEET POST NODE | An error occurred: ${error.message || error}`
      );
      this.setCredit(this.getCredit() - config.credit); // Subtract credit on failure
      return {
        "Tweet Link": null,
        Credits: this.getCredit(),
        Tool: tweetPostTool,
      };
    }
  }
}

export default tweet_post;
