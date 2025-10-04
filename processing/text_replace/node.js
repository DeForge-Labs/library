import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Text Replace",
  category: "processing",
  type: "text_replace",
  icon: {},
  desc: "Replaces text in a string",
  credit: 0,
  inputs: [
    {
      name: "Flow",
      type: "Flow",
      desc: "The flow of the workflow",
    },
    {
      name: "Text",
      type: "Text",
      desc: "The text on which replacement will be done.",
    },
    {
      name: "Text to replace",
      type: "Text",
      desc: "The text to replace.",
    },
    {
      name: "Text to replace with",
      type: "Text",
      desc: "The text to replace with.",
    },
  ],
  outputs: [
    {
      name: "Text",
      type: "Text",
      desc: "The text to replace.",
    },
  ],
  fields: [
    {
      name: "Text",
      type: "Text",
      desc: "The text on which replacement will be done.",
      value: "Enter text here...",
    },
    {
      name: "Text to replace",
      type: "Text",
      desc: "The text to replace.",
      value: "Enter text here...",
    },
    {
      name: "Text to replace with",
      type: "Text",
      desc: "The text to replace with.",
      value: "Enter text here...",
    },
  ],
  difficulty: "easy",
  tags: ["text", "replace", "processing"],
};

class text_replace extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * @override
   * @inheritDoc
   * @param {import('../../core/BaseNode/node.js').Inputs[]} inputs
   * @param {import('../../core/BaseNode/node.js').Contents[]} contents
   * @param {import('../../core/BaseNode/node.js').IServerData} serverData
   */
  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  /**
   * @override
   * @inheritDoc
   * @param {import('../../core/BaseNode/node.js').Inputs[]} inputs
   * @param {import('../../core/BaseNode/node.js').Contents[]} contents
   * @param {import('../../core/BaseNode/node.js').IWebConsole} webconsole
   * @param {import('../../core/BaseNode/node.js').IServerData} serverData
   */
  async run(inputs, contents, webconsole, serverData) {
    try {
      const textFilter = inputs.filter((e) => e.name === "Text");
      const text =
        textFilter.length > 0
          ? textFilter[0].value
          : contents.filter((e) => e.name === "Text")[0].value || "";

      const textToReplaceFilter = inputs.filter(
        (e) => e.name === "Text to replace"
      );
      const textToReplace =
        textToReplaceFilter.length > 0
          ? textToReplaceFilter[0].value
          : contents.filter((e) => e.name === "Text to replace")[0].value || "";

      const textToReplaceWithFilter = inputs.filter(
        (e) => e.name === "Text to replace with"
      );
      const textToReplaceWith =
        textToReplaceWithFilter.length > 0
          ? textToReplaceWithFilter[0].value
          : contents.filter((e) => e.name === "Text to replace with")[0]
              .value || "";

      if (!text || !textToReplace) {
        webconsole.error("TEXT REPLACE NODE | Text or Text to replace missing");
        return null;
      }

      const replacedText = text.replace(
        textToReplace,
        textToReplaceWith ? textToReplaceWith : ""
      );
      webconsole.success("TEXT REPLACE NODE | Replaced text");
      return {
        Text: replacedText,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("TEXT REPLACE NODE | Some error occured: ", error);
      return null;
    }
  }
}

export default text_replace;
