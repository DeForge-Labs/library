import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Reddit Browser",
  category: "social",
  type: "reddit_browser",
  icon: {},
  desc: "Search subreddits or fetch top discussions from Reddit.",
  credit: 15,
  inputs: [
    { desc: "The flow of the workflow", name: "Flow", type: "Flow" },
    { desc: "Search query", name: "Search Query", type: "Text" },
  ],
  outputs: [
    { desc: "The Flow to trigger", name: "Flow", type: "Flow" },
    { desc: "List of posts found", name: "Posts", type: "JSON" },
    { desc: "The tool version for LLMs", name: "Tool", type: "Tool" },
  ],
  fields: [
    {
      desc: "Specific subreddit (optional, leave blank for all of Reddit)",
      name: "Subreddit",
      type: "Text",
      value: "",
    },
    {
      desc: "Search query (e.g., 'best budget cameras')",
      name: "Search Query",
      type: "Text",
      value: "",
    },
    {
      desc: "Number of results to fetch (Max 5)",
      name: "Limit",
      type: "Slider",
      value: 5,
      min: 1,
      max: 5,
      step: 1,
    },
  ],
  difficulty: "medium",
  tags: ["reddit", "social", "research", "jina"],
};

class reddit_node extends BaseNode {
  constructor() {
    super(config);
  }

  async fetchReddit(subreddit, query, limit, webconsole) {
    try {
      const subPart = subreddit
        ? `reddit.com/r/${subreddit.replace(/r\//, "")}`
        : "reddit.com";
      const fullQuery = `${query} site:${subPart}`;

      const url = `https://s.jina.ai/?q=${encodeURIComponent(fullQuery)}`;

      webconsole.info(`JINA-REDDIT | Searching: ${fullQuery}`);

      const response = await axios.get(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.JINA_API_KEY}`,
          "X-Engine": "direct",
        },
        timeout: 30000,
      });

      if (!response.data || !response.data.data) return [];

      return response.data.data.slice(0, limit).map((item) => ({
        title: item.title,
        url: item.url,
        content: item.content.slice(0, 3000),
        source: "Reddit (via Jina AI)",
      }));
    } catch (error) {
      webconsole.error(`JINA-REDDIT ERROR | ${error.message}`);
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

    const subreddit = getValue("Subreddit", "");
    const query = getValue("Search Query", "");
    const limit = Number(getValue("Limit", 5));

    const redditTool = tool(
      async ({ subreddit: tSub, query: tQuery, limit: tLimit }) => {
        try {
          const data = await this.fetchReddit(
            tSub || subreddit,
            tQuery || query,
            tLimit || limit,
            webconsole,
          );
          this.setCredit(this.getCredit() + 15);
          return [JSON.stringify(data, null, 2), this.getCredit()];
        } catch (err) {
          return [`Error: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "reddit_search",
        description:
          "Searches Reddit for community discussions and opinions on a specific topic.",
        schema: z.object({
          subreddit: z
            .string()
            .optional()
            .describe("Subreddit to search in (e.g. 'startups')"),
          query: z.string().describe("Search keywords"),
          limit: z.number().optional().describe("Number of posts (1-5)"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    try {
      if (!query) throw new Error("Search query is required.");
      const posts = await this.fetchReddit(subreddit, query, limit, webconsole);
      this.setCredit(15);
      return { Posts: posts, Tool: redditTool, Credits: this.getCredit() };
    } catch (error) {
      this.setCredit(0);
      return { Posts: [], Tool: redditTool, Credits: 0 };
    }
  }
}

export default reddit_node;
