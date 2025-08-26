import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "JSON to Text",
  category: "processing",
  type: "json_to_text",
  icon: {},
  desc: "Converts JSON to text",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "JSON to convert",
      name: "JSON",
      type: "JSON",
    },
  ],
  outputs: [
    {
      desc: "The text of the JSON",
      name: "Text",
      type: "Text",
    },
  ],
  fields: [
    {
      desc: "JSON to convert",
      name: "JSON",
      type: "Map",
    },
  ],
  difficulty: "easy",
  tags: ["text", "json"],
};

class json_to_text extends BaseNode {
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
    const JSONFilter = inputs.filter((e) => e.name === "JSON");
    const JSONdata =
      JSONFilter.length > 0 ? JSONFilter[0].value : contents[0].value || {};

    try {
      if (JSONdata === null || JSONdata === undefined) {
        webconsole.error("JSON TO TEXT NODE | Some data is null");
        return null;
      }

      if (typeof JSONdata !== "object") {
        webconsole.error("JSON TO TEXT NODE | Some data is not a object");
        return null;
      }

      const text = JSON.stringify(JSONdata);
      webconsole.success("JSON TO TEXT NODE | Successfully converted JSON");
      return {
        "Text": text,
        "Credits": this.getCredit(),
      }
    } catch (error) {
      webconsole.error("JSON TO TEXT NODE | Some error occured: " + error);
      return null;
    }
  }
}

export default json_to_text;
