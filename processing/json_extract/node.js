import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Extract JSON",
  category: "processing",
  type: "json_extract",
  icon: {},
  desc: "Gets the Value from JSON and Provided key as input",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "JSON to parse",
      name: "Object",
      type: "JSON",
    },
    {
      desc: "Key to extract",
      name: "Key",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The value of the key",
      name: "Value",
      type: "Text",
    },
  ],
  fields: [
    {
      desc: "JSON to parse",
      name: "Object",
      type: "Map",
      value: "Enter JSON here...",
    },
    {
      desc: "Key to extract",
      name: "Key",
      type: "Text",
      value: "key",
    },
  ],
  difficulty: "easy",
  tags: ["json", "extract"],
};

class json_extract extends BaseNode {
  constructor() {
    super(config);
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
    webconsole.info("JSON EXTRACT | Executing node");

    const JSONFilter = inputs.filter((e) => e.name === "Object");
    const JSONdata =
      JSONFilter.length > 0
        ? JSONFilter[0].value
        : contents.filter((e) => e.name === "Object")[0].value || {};

    const keyFilter = inputs.filter((e) => e.name === "Key");
    const key =
      keyFilter.length > 0
        ? keyFilter[0].value
        : contents.filter((e) => e.name === "Key")[0].value || "";

    if (Object.keys(JSONdata).includes(key)) {
      const value = JSONdata[key];
      webconsole.success("JSON EXTRACT | Extracted data, emitting");

      return {
        Value:
          typeof value === "object" ? JSON.stringify(value) : String(value),
        Credits: this.getCredit(),
      };
    } else {
      webconsole.error("JSON EXTRACT | Extracted failed, no such key");
      return null;
    }
  }
}

export default json_extract;
