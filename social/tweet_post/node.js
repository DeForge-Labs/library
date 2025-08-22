import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { Client, auth } from "twitter-api-sdk";

dotenv.config();

const config = {
    title: "Tweet Post",
    category: "social",
    type: "tweet_post",
    icon: {},
    desc: "Post an update to your twitter account",
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
}

class tweet_post extends BaseNode {

    constructor() {
        super(config);
    }

    calculateTweetLength(text) {

        const URL_LENGTH = 23;
        const URL_REGEX = /(https?:\/\/[^\s]+)/g;
        const WEIGHTED_CHARS_REGEX = /[\u1100-\u11FF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF01-\uFFEE]/;
        
        if (typeof text !== 'string') {
            return 0;
        }

        const textWithoutUrls = text.replace(URL_REGEX, '');
        const urls = text.match(URL_REGEX) || [];
        const urlLength = urls.length * URL_LENGTH;

        let weightedTextLength = 0;
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

        while (calculateTweetLength(currentText) > MAX_CHARS) {
            textAsGraphemes.pop();
            currentText = textAsGraphemes.join('');
        }
        return currentText;
    }

    async run(inputs, contents, webconsole, serverData) {

        webconsole.info("TWEET POST NODE | Starting configuration");

        const PostFilter = inputs.find((e) => e.name === "Post");
        let Post = PostFilter?.value || contents.find((e) => e.name === "Post")?.value || "";

        if (!Post) {
            webconsole.error("TWEET POST NODE | Empty post body");
            return null;
        }

        try {

            const MAX_CHARS = 280;
            const tweetLength = this.calculateTweetLength(Post);
            if (tweetLength > MAX_CHARS) {
                Post = this.trimTweet(Post);
            }

            const tokens = serverData.socialList;
            if (!Object.keys(tokens).includes("twitter")) {
                webconsole.error("TWEET POST NODE | Please connect your twitter account");
                return null;
            }

            const x_token = tokens["twitter"];
            if (!x_token) {
                webconsole.error("TWEET POST NODE | Some error occured, please reconnect your twitter account");
                return null;
            }

            const refreshTokenHandler = serverData.refreshUtil;

            const authClient = new auth.OAuth2User({
                client_id: process.env.X_CLIENT_ID,
                client_secret: process.env.X_CLIENT_SECRET,
                callback: "https://api.deforge.io/api/workflow/connectSocialCallback",
                scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
                token: x_token,
            });

            if (authClient.isAccessTokenExpired()) {
                webconsole.info("TWEET POST NODE | Refreshing token");
                const { token } = await authClient.refreshAccessToken();
                authClient.token = token;

                await refreshTokenHandler.handleTwitterToken(token);
            }
            
            const client = new Client(authClient);
        
            const userLookupData = await client.users.findMyUser({
                "user.fields": ["username"],
            });

            if (userLookupData.errors && userLookupData.errors.length > 0) {
                throw new Error(`Error occured while extracting username: \n${JSON.stringify(userLookupData.errors)}`);
            }

            const userXID = userLookupData.data?.username || "";
            if (!userXID) {
                webconsole.error("TWEET POST NODE | No username found for connected account");
                return null;
            }
            
            webconsole.info("TWEET POST NODE | Tweeting your thoughts");

            const postRes = await client.tweets.createTweet({
                text: Post.replace(/\\n/g, "\n"),
            });

            webconsole.success("TWEET POST NODE | Successfully tweeted your post");

            if (postRes.errors?.length > 0) {
                webconsole.error("TWEET POST NODE | Some error occured posting the tweet: ", JSON.stringify(postRes.errors));
                return null;
            }

            const tweetID = postRes.data?.id || "";
            if (!tweetID) {
                webconsole.error("TWEET POST NODE | No error or tweet id received from twitter API");
                return null;
            }

            const tweetLink = `https://x.com/${userXID}/status/${tweetID}`;
            return {
                "Tweet Link": tweetLink
            };
            

        } catch (error) {
            webconsole.error(`TWEET POST NODE | An error occurred: ${error}`);
            return null;
        }
    }
}

export default tweet_post;