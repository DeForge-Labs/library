import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Output Text",
  category: "output",
  type: "output_text",
  icon: {},
  desc: "Outputs text to the user",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Text to output",
      name: "Text",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
  ],
  fields: [
    {
      desc: "Text to output",
      name: "Text",
      type: "TextArea",
      value: "Enter text here...",
    },
  ],
  difficulty: "easy",
  tags: ["output", "text"],
};

class output_text extends BaseNode {
  constructor() {
    super(config);
  }

  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  /**
   * @override
   * @inheritdoc
   *
   * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs
   * @param {import("../../core/BaseNode/node.js").Contents[]} contents
   * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole
   * @param {import("../../core/BaseNode/node.js").IServerData} serverData
   */
  async run(inputs, contents, webconsole, serverData) {
    try {
      const StringOutput = this.getValue(inputs, contents, "Text", "");

      webconsole.info("TEXT OUTPUT | Emmitting Text output: ", StringOutput);

      return {
        Text: StringOutput,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("TEXT OUTPUT | Some error occured: ", error);
      return null;
    }
  }
}

export default output_text;
