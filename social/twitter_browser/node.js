import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "X (Twitter) Browser",
  category: "Social",
  type: "twitter_node",
  icon: {},
  desc: "Search tweets, track keywords, or browse user profiles",
  credit: 30,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The search query (e.g. 'AI from:elonmusk' or '#web3')",
      name: "Query",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "List of tweets found",
      name: "Tweets",
      type: "JSON",
    },
    {
      desc: "The tool version for LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Search query (supports operators like from:, since:, #)",
      name: "Query",
      type: "Text",
      value: "AI news",
    },
    {
      desc: "Type of search",
      name: "Query Type",
      type: "select",
      value: "Latest",
      options: ["Latest", "Top"],
    },
    {
      desc: "Number of tweets to fetch (max 20 per request)",
      name: "Limit",
      type: "Slider",
      value: 10,
      min: 1,
      max: 20,
      step: 1,
    },
  ],
  difficulty: "medium",
  tags: ["twitter", "x", "social", "search", "osint"],
};

class twitter_node extends BaseNode {
  constructor() {
    super(config);
  }

  async fetchTweets(query, queryType, webconsole, serverData) {
    const apiKey =
      serverData.envList?.TWITTER_API_KEY || process.env.TWITTER_API_KEY;

    if (!apiKey) {
      throw new Error(
        "TWITTER_API_KEY is not configured in environment variables.",
      );
    }

    try {
      webconsole.info(
        `X NODE | Searching for: "${query}" (Type: ${queryType})`,
      );

      const response = await axios.get(
        "https://api.twitterapi.io/twitter/tweet/advanced_search",
        {
          params: {
            query: query,
            queryType: queryType,
          },
          headers: {
            "X-API-Key": apiKey,
          },
        },
      );

      if (!response.data || !response.data.tweets) {
        return [];
      }

      return response.data.tweets.map((t) => ({
        id: t.id,
        text: t.text,
        author: t.author?.userName,
        author_name: t.author?.name,
        created_at: t.createdAt,
        metrics: {
          retweets: t.retweetCount,
          likes: t.likeCount,
          replies: t.replyCount,
          views: t.viewCount,
        },
        url: `https://x.com/${t.author?.userName}/status/${t.id}`,
      }));
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      webconsole.error(`X NODE | API Error: ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    const getValue = (name, defaultValue = null) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined && input.value !== "") return input.value;
      const content = contents.find((c) => c.name === name);
      if (content?.value !== undefined) return content.value;
      return defaultValue;
    };

    const query = getValue("Query", "");
    const queryType = getValue("Query Type", "Latest");
    const limit = Number(getValue("Limit", 10));

    const twitterTool = tool(
      async ({ query: tQuery, queryType: tType }) => {
        webconsole.info("X TOOL | Invoked by LLM");
        try {
          const data = await this.fetchTweets(
            tQuery || query,
            tType || queryType,
            webconsole,
            serverData,
          );

          const slicedData = data.slice(0, limit);

          this.setCredit(this.getCredit() + 30);
          return [JSON.stringify(slicedData, null, 2), this.getCredit()];
        } catch (err) {
          return [`Error searching X: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "x_twitter_search",
        description:
          "Search for real-time tweets and news on X (Twitter). Use this to find current events, public sentiment, or specific user posts.",
        schema: z.object({
          query: z
            .string()
            .describe(
              "The search query. Supports operators like 'from:username' or '#hashtag'",
            ),
          queryType: z
            .enum(["Latest", "Top"])
            .optional()
            .describe(
              "Whether to get the newest tweets or the most popular ones",
            ),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!query) {
      return { Tweets: [], Tool: twitterTool, Credits: 0 };
    }

    try {
      const allTweets = await this.fetchTweets(
        query,
        queryType,
        webconsole,
        serverData,
      );
      const results = allTweets.slice(0, limit);

      this.setCredit(30);

      return {
        Tweets: results,
        Tool: twitterTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      return {
        Tweets: [],
        Tool: twitterTool,
        Credits: 0,
      };
    }
  }
}

export default twitter_node;
