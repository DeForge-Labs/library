import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "JSON To Array",
  category: "processing",
  type: "json_to_array",
  icon: {},
  desc: "Aggregates multiple JSON objects into a single JSON Array.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Multiple JSON objects to aggregate",
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
      let inputObjs = inputObjsFilter?.value || [];

      // Ensure we are working with an array
      if (!Array.isArray(inputObjs)) {
          // If the system passed a single object instead of an array, wrap it
          if (inputObjs && typeof inputObjs === 'object') {
              inputObjs = [inputObjs];
          } else {
              inputObjs = [];
          }
      }

      webconsole.success(`JSON TO ARRAY NODE | Aggregated ${inputObjs.length} items`);

      return {
        array: inputObjs,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("JSON TO ARRAY NODE | Some error occured: ", error);
      return null;
    }
  }
}

export default json_to_json_array;