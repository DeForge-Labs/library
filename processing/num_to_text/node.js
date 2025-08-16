import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Number to Text",
  category: "processing",
  type: "num_to_text",
  icon: {},
  desc: "Converts Number to text",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Number to convert",
      name: "Number",
      type: "Number",
    },
  ],
  outputs: [
    {
      desc: "The number in text format",
      name: "Text",
      type: "Text",
    },
  ],
  fields: [
    {
      desc: "Number to convert",
      name: "Number",
      type: "Number",
    },
  ],
  difficulty: "easy",
  tags: ["text", "num"],
};

class num_to_text extends BaseNode {
  constructor() {
    super(config);
  }

  async run(inputs, contents, webconsole, serverData) {
    const NumFilter = inputs.filter((e) => e.name === "Number");
    const NumData =
      NumFilter.length > 0 ? NumFilter[0].value : contents[0].value || "";

    try {
      if (NumData === null || NumData === undefined || NumData === NaN) {
        webconsole.error("NUMBER TO TEXT NODE | Some data is null");
        return null;
      }

      if (typeof NumData !== "number") {
        webconsole.error("NUMBER TO TEXT NODE | Data is not a number");
        return null;
      }

      const text = NumData.toString();
      webconsole.success("NUMBER TO TEXT NODE | Successfully converted Number");
      return text;
    } catch (error) {
      webconsole.error("NUMBER TO TEXT NODE | Some error occured: " + error);
      return null;
    }
  }
}

export default num_to_text;
