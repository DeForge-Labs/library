import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Number Input",
  category: "input",
  type: "num_var",
  icon: {},
  desc: "Number variable",
  credit: 0,
  inputs: [],
  outputs: [
    {
      name: "Number",
      type: "Number",
      desc: "",
    },
  ],
  fields: [
    {
      name: "Number",
      type: "Number",
      desc: "",
      value: 0,
    },
  ],
  difficulty: "easy",
  tags: ["int", "float", "number"],
};

class num_var extends BaseNode {
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
      if (contents.length === 0) {
        webconsole.error("NUMBER INPUT | No input given");
        return {
          Number: 0,
          Credits: this.getCredit(),
        };
      }

      if ([NaN, undefined, null].includes(typeof contents[0].value)) {
        webconsole.error("NUMBER NODE | Invalid input given");
        return {
          Number: 0,
          Credits: this.getCredit(),
        };
      }

      webconsole.info("NUMBER INPUT | emitting output value");
      return {
        Number: contents[0].value || 0,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("NUMBER NODE | Some error occured: ", error);
      return {
        Number: 0,
        Credits: this.getCredit(),
      };
    }
  }
}

export default num_var;
