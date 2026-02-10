import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "JSON Input",
  category: "input",
  type: "map_var",
  icon: {},
  desc: "JSON variable",
  credit: 0,
  inputs: [
    {
      desc: "Input JSON",
      name: "Input",
      type: "JSON",
    },
  ],
  outputs: [
    {
      name: "Output",
      type: "JSON",
      desc: "Output JSON",
    },
  ],
  fields: [
    {
      name: "Input",
      type: "Map",
      desc: "Input JSON",
    },
  ],
  difficulty: "medium",
  tags: ["map", "variable"],
};

class map_var extends BaseNode {
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
      const inputFilter = inputs.filter((e) => e.name === "Input");
      const input =
        inputFilter.length > 0
          ? inputFilter[0].value
          : contents.filter((e) => e.name === "Input")[0].value || {};

      return {
        Output: input,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("Map Var Node | " + error.message);
      return null;
    }
  }
}

export default map_var;
