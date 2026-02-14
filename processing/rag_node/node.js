import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";

dotenv.config();

const config = {
  title: "Knowledge Base",
  category: "processing",
  type: "rag_node",
  icon: {},
  desc: "Load your pre-processed Knowledge Base to use it in LLMs",
  credit: 0,
  inputs: [],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "RAG Database",
      name: "Rag Database",
      type: "Rag",
    },
  ],
  fields: [
    {
      desc: "The file to use as knowledge base",
      name: "File",
      type: "KnowledgeBase",
      value: null,
    },
  ],
  difficulty: "easy",
  tags: ["api", "llm", "knowledge-base", "rag"],
};

class rag_node extends BaseNode {
  constructor() {
    super(config);
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
    try {
      webconsole.info("RAG NODE | Starting execution");

      if (!serverData?.workflowId) {
        webconsole.error("RAG NODE | No workflowId in serverData");
        this.setCredit(0);
        return {
          "Rag Database": null,
          Credits: this.getCredit(),
        };
      }

      const fileContent = contents.find((e) => e.name === "File");
      const vectorTable = fileContent?.value?.vectorTable;

      if (!vectorTable) {
        webconsole.error(
          "RAG NODE | No Knowledge Base file provided or selected file is still processing.",
        );
        this.setCredit(0);
        return {
          "Rag Database": null,
          Credits: this.getCredit(),
        };
      }

      webconsole.success(
        `RAG NODE | Successfully loaded RAG Database: ${vectorTable}`,
      );
      return {
        "Rag Database": vectorTable,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error(`RAG NODE | Error occurred: ${error.message}`);
      console.error("RAG NODE | Full error:", error);
      this.setCredit(0);
      return {
        "Rag Database": null,
        Credits: this.getCredit(),
      };
    }
  }

  // Clean up method
  async destroy() {
    console.log("RAG NODE | Cleaned up");
  }
}

export default rag_node;
