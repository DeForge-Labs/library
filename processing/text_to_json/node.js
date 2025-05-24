import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Text to JSON",
  category: "processing",
  type: "text_to_json",
  icon: {},
  desc: "Converts text to JSON",
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Text to convert",
      name: "Text",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The JSON of the text",
      name: "JSON",
      type: "JSON",
    },
  ],
  fields: [
    {
      desc: "Text to convert",
      name: "Text",
      type: "Text",
      value: "Enter text here...",
    },
  ],
  difficulty: "easy",
  tags: ["text", "json"],
};

class text_to_json extends BaseNode {
  constructor() {
    super(config);
  }

  async run(inputs, contents, webconsole, serverData) {
    const TextFilter = inputs.filter((e) => e.name === "Text");
    const Textdata =
      TextFilter.length > 0 ? TextFilter[0].value : contents[0].value;

    try {
      if (Textdata === null || Textdata === undefined) {
        webconsole.error("TEXT TO JSON NODE | Some data is null");
        return null;
      }

      if (typeof Textdata !== "string") {
        webconsole.error("TEXT TO JSON NODE | Some data is not a string");
        return null;
      }

      const regex = /^\s*({.*})/ms;
      const match = Textdata.match(regex);
      if (match) {
        const data = JSON.parse(match[1]);
        webconsole.success("TEXT TO JSON NODE | Successfully converted text");
        return data;
      }
      webconsole.error("TEXT TO JSON NODE | Some error occured");
      return null;
    } catch (error) {
      webconsole.error("TEXT TO JSON NODE | Some error occured: " + error);
      return null;
    }
  }
}

export default text_to_json;
