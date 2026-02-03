import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Reddit Browser",
  category: "social",
  type: "reddit_node",
  icon: {},
  desc: "Search subreddits, fetch trending posts, or get latest discussions from Reddit.",
  credit: 15,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Subreddit to browse (e.g., 'startups', 'technology')",
      name: "Subreddit",
      type: "Text",
    },
    {
      desc: "Search query to filter posts",
      name: "Search Query",
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
      desc: "The list of posts found",
      name: "Posts",
      type: "JSON",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Subreddit to browse",
      name: "Subreddit",
      type: "Text",
      value: "all",
    },
    {
      desc: "Search query (leave empty for frontpage of subreddit)",
      name: "Search Query",
      type: "Text",
      value: "",
    },
    {
      desc: "Sort order",
      name: "Sort",
      type: "select",
      value: "relevance",
      options: ["relevance", "hot", "top", "new", "comments"],
    },
    {
      desc: "Time filter (for top/relevance)",
      name: "Time",
      type: "select",
      value: "week",
      options: ["all", "year", "month", "week", "day", "hour"],
    },
    {
      desc: "Number of posts to fetch",
      name: "Limit",
      type: "Slider",
      value: 5,
      min: 1,
      max: 25,
      step: 1,
    },
  ],
  difficulty: "medium",
  tags: ["reddit", "social", "research", "scraping"],
};

class reddit_node extends BaseNode {
  constructor() {
    super(config);
  }

  async fetchReddit(subreddit, query, sort, time, limit, webconsole) {
    try {
      const sub = subreddit?.replace(/r\//, "") || "all";
      let url = "";

      if (query && query.trim() !== "") {
        url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&sort=${sort}&t=${time}&limit=${limit}&restrict_sr=1`;
      } else {
        const listingType = sort === "relevance" ? "hot" : sort;
        url = `https://www.reddit.com/r/${sub}/${listingType}.json?limit=${limit}&t=${time}`;
      }

      webconsole.info(`REDDIT NODE | Requesting: ${url}`);

      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "DeforgeAI/1.0.0 (Workflows and Agents; +https://deforge.io)",
        },
      });

      if (
        !response.data ||
        !response.data.data ||
        !response.data.data.children
      ) {
        return [];
      }

      return response.data.data.children.map((child) => {
        const p = child.data;
        return {
          title: p.title,
          author: p.author,
          score: p.score,
          num_comments: p.num_comments,
          subreddit: p.subreddit,
          url: `https://www.reddit.com${p.permalink}`,
          text: p.selftext ? p.selftext.slice(0, 2000) : "[Link/Image Post]",
        };
      });
    } catch (error) {
      webconsole.error(`REDDIT NODE | API Error: ${error.message}`);
      throw error;
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

    const subreddit = getValue("Subreddit", "all");
    const query = getValue("Search Query", "");
    const sort = getValue("Sort", "relevance");
    const time = getValue("Time", "week");
    const limit = Number(getValue("Limit", 5));

    const redditTool = tool(
      async ({
        subreddit: tSub,
        query: tQuery,
        sort: tSort,
        limit: tLimit,
      }) => {
        webconsole.info("REDDIT TOOL | Invoked by LLM");
        try {
          const data = await this.fetchReddit(
            tSub || subreddit,
            tQuery || query,
            tSort || sort,
            time,
            tLimit || limit,
            webconsole,
          );

          this.setCredit(this.getCredit() + 15);

          if (data.length === 0)
            return "No Reddit posts found for that criteria.";

          return [JSON.stringify(data, null, 2), this.getCredit()];
        } catch (err) {
          return [
            `Error fetching Reddit data: ${err.message}`,
            this.getCredit(),
          ];
        }
      },
      {
        name: "reddit_search",
        description:
          "Search Reddit for posts, discussions, or user opinions. Useful for market research, finding trends, or checking community sentiment.",
        schema: z.object({
          subreddit: z
            .string()
            .describe("The subreddit to search in (e.g., 'startups')"),
          query: z.string().describe("The search keywords"),
          sort: z
            .enum(["relevance", "hot", "top", "new"])
            .optional()
            .describe("How to sort results"),
          limit: z.number().optional().describe("Number of results (max 10)"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    try {
      webconsole.info("REDDIT NODE | Running direct fetch");
      const posts = await this.fetchReddit(
        subreddit,
        query,
        sort,
        time,
        limit,
        webconsole,
      );

      this.setCredit(15);

      return {
        Posts: posts,
        Tool: redditTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      return {
        Posts: "[]",
        Tool: redditTool,
        Credits: 0,
      };
    }
  }
}

export default reddit_node;
