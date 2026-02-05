import BaseNode from "../../core/BaseNode/node.js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";

const MAX_CHARS = 200000;
const CREDITS_PER_1M_TOKENS = 100;

const config = {
  title: "Quick RAG",
  category: "processing",
  type: "quick_rag_node",
  icon: {},
  desc: "Instantly process text or a URL to answer a specific query. (Max 200k characters)",
  credit: 10,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "URL to scrape or Raw Text to analyze",
      name: "Source",
      type: "Text",
    },
    {
      desc: "The question you want to ask about this source",
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
      desc: "Retrieved Context (The relevant parts of the text)",
      name: "Context",
      type: "Text",
    },
    {
      desc: "The tool version of this node",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "Source",
      type: "TextArea",
      desc: "URL or Text content",
      value: "",
    },
    {
      name: "Query",
      type: "Text",
      desc: "What do you want to find?",
      value: "",
    },
  ],
  difficulty: "medium",
  tags: ["rag", "scraping", "search", "memory", "ai"],
};

class quick_rag_node extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    try {
      const getValue = (name) => {
        const input = inputs.find((i) => i.name === name);
        if (input?.value) return input.value;
        return contents.find((c) => c.name === name)?.value || "";
      };

      const source = getValue("Source");
      let charLength = MAX_CHARS;

      if (source && !source.startsWith("http")) {
        charLength = source.length;
      }

      if (charLength > MAX_CHARS) charLength = MAX_CHARS;

      const estTokens = Math.ceil(charLength / 4);
      const embeddingCost = Math.ceil(
        estTokens * (CREDITS_PER_1M_TOKENS / 1e6),
      );

      return Math.max(1, embeddingCost);
    } catch (error) {
      return this.getCredit();
    }
  }

  async fetchUrlContent(url, webconsole) {
    try {
      webconsole.info("QUICK RAG | Fetching webpage (Jina AI)...");

      const response = await axios.get(`https://r.jina.ai/${url}`, {
        timeout: 30000,
      });

      let markdownContent = "";
      if (response.status === 200) {
        markdownContent =
          typeof response.data === "string"
            ? response.data
            : JSON.stringify(response.data);
      } else {
        throw new Error(`Failed to fetch webpage: ${response.status}`);
      }

      return markdownContent;
    } catch (error) {
      webconsole.error(`QUICK RAG | Fetch Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Core RAG Logic: Split -> Embed (Memory) -> Search
   */
  async performRag(text, query, apiKey, webconsole) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await splitter.createDocuments([text]);
    webconsole.info(`QUICK RAG | Split content into ${docs.length} chunks.`);

    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      apiKey: apiKey,
    });

    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

    webconsole.info(`QUICK RAG | Searching for: "${query}"`);
    const results = await vectorStore.similaritySearch(query, 5);

    return results.map((doc) => doc.pageContent).join("\n\n---\n\n");
  }

  async run(inputs, contents, webconsole, serverData) {
    const getValue = (name, defaultValue = null) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined && input.value !== "") return input.value;
      const content = contents.find((c) => c.name === name);
      if (content?.value !== undefined) return content.value;
      return defaultValue;
    };

    const source = getValue("Source");
    const query = getValue("Query");
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      webconsole.error("QUICK RAG | OPENAI_API_KEY is missing.");
      this.setCredit(0);
      return { Context: null, Tool: null, Credits: 0 };
    }

    if (!source) {
      webconsole.error("QUICK RAG | No Source provided.");
      return { Context: null, Tool: null, Credits: 0 };
    }

    const quickRagTool = tool(
      async ({ url, question }) => {
        try {
          const content = await this.fetchUrlContent(url, webconsole);
          if (content.length > MAX_CHARS) {
            return [
              `Error: Website content too large (${content.length} chars). Limit is ${MAX_CHARS}.`,
              0,
            ];
          }

          const context = await this.performRag(
            content,
            question,
            apiKey,
            webconsole,
          );

          const tokens = Math.ceil(content.length / 4);
          const cost = Math.ceil(tokens * (CREDITS_PER_1M_TOKENS / 1e6));
          this.setCredit(this.getCredit() + cost);

          return [context, this.getCredit()];
        } catch (e) {
          return [`Error: ${e.message}`, 0];
        }
      },
      {
        name: "quick_rag_web_search",
        description:
          "Read a website URL and find specific information within it.",
        schema: z.object({
          url: z.string().describe("The URL to read"),
          question: z.string().describe("What to find in the URL"),
        }),
      },
    );

    if (!query) {
      webconsole.info("QUICK RAG | No query provided. Returning tool.");
      return { Context: "", Tool: quickRagTool, Credits: 0 };
    }

    try {
      let contentToProcess = source;

      if (source.startsWith("http://") || source.startsWith("https://")) {
        contentToProcess = await this.fetchUrlContent(source, webconsole);
      }

      if (!contentToProcess || contentToProcess.trim().length === 0) {
        throw new Error("Source content is empty.");
      }

      if (contentToProcess.length > MAX_CHARS) {
        const err = `Input too large! Content is ${contentToProcess.length} characters. Limit is ${MAX_CHARS}. Please summarize or use a shorter source.`;
        webconsole.error(`QUICK RAG | ${err}`);
        throw new Error(err);
      }

      const relevantContext = await this.performRag(
        contentToProcess,
        query,
        apiKey,
        webconsole,
      );

      const tokens = Math.ceil(contentToProcess.length / 4);
      let currentCost = Math.ceil(tokens * (CREDITS_PER_1M_TOKENS / 1e6));

      if (currentCost < 1) currentCost = 1;

      webconsole.success(
        `QUICK RAG | Context retrieved. Processed ${tokens} tokens. Cost: ${currentCost} credits.`,
      );
      this.setCredit(currentCost);

      return {
        Context: relevantContext,
        Tool: quickRagTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error(`QUICK RAG ERROR | ${error.message}`);
      this.setCredit(0);
      return {
        Context: null,
        Tool: quickRagTool,
        Credits: 0,
      };
    }
  }
}

export default quick_rag_node;
