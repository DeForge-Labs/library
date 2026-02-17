import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "JSON To Array",
  category: "processing",
  type: "json_to_array",
  icon: {},
  desc: "Aggregates JSON objects into a JSON Array, supports nesting for 2D arrays.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "JSON object or array to wrap",
      name: "jsons",
      type: "JSON[]",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The resulting array of JSON objects",
      name: "array",
      type: "JSON",
    },
  ],
  fields: [
    {
      desc: "JSON objects",
      name: "jsons",
      type: "JSON[]",
      value: "[]",
    },
  ],
  difficulty: "easy",
  tags: ["json", "array", "aggregator"],
};

class json_to_json_array extends BaseNode {
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
    try {
      webconsole.info("JSON TO ARRAY NODE | Gathering inputs");

      const inputObjsFilter = inputs.find((e) => e.name === "jsons");
      let inputData = inputObjsFilter?.value;

      if (inputData === undefined || inputData === null) {
        inputData = contents.find((e) => e.name === "jsons")?.value || [];
        return {
          array: [inputData],
          Credits: this.getCredit(),
        };
      }

      let finalArray = [];

      const isMultipleConnections = Array.isArray(inputObjsFilter.uuid);

      if (isMultipleConnections) {
        finalArray = Array.isArray(inputData) ? inputData : [inputData];
        webconsole.success(
          `JSON TO ARRAY NODE | Processed multiple connections into 1D array`,
        );
      } else {
        finalArray = [inputData];
        webconsole.success(
          `JSON TO ARRAY NODE | Wrapped single connection into nested array`,
        );
      }

      return {
        array: finalArray,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("JSON TO ARRAY NODE | Some error occured: ", error);
      return null;
    }
  }
}

export default json_to_json_array;
