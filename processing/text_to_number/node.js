import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Text to Number",
  category: "processing",
  type: "text_to_number",
  icon: {},
  desc: "Converts the given text to number",
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
      desc: "The text to convert to number",
    },
  ],
  outputs: [
    {
      name: "Number",
      type: "Number",
      desc: "The number converted from text",
    },
  ],
  fields: [
    {
      name: "Text",
      type: "Text",
      desc: "The text to convert to number",
      value: "Enter text here...",
    },
  ],
  difficulty: "easy",
  tags: ["text", "number", "processing"],
};

class text_to_number extends BaseNode {
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

      const number = Number(text);

      if (isNaN(number)) {
        webconsole.error("TEXT TO NUMBER NODE | Text is not a number");
        return null;
      }

      webconsole.success("TEXT TO NUMBER NODE | Converted text to number");
      return {
        Number: number,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("TEXT TO NUMBER NODE | Some error occured: ", error);
      return null;
    }
  }
}

export default text_to_number;
