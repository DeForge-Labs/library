import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Math Operation",
  category: "processing",
  type: "math_operation",
  icon: {},
  desc: "Performs a mathematical operation on two numbers",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "First number",
      name: "Number 1",
      type: "Number",
    },
    {
      desc: "Second number",
      name: "Number 2",
      type: "Number",
    },
  ],
  outputs: [
    {
      desc: "The result of the operation",
      name: "Result",
      type: "Number",
    },
  ],
  fields: [
    {
      desc: "First number",
      name: "Number 1",
      type: "Number",
      value: 0,
    },
    {
      desc: "Operation",
      name: "Operation",
      type: "select",
      value: "+",
      options: ["+", "-", "*", "/"],
    },
    {
      desc: "Second number",
      name: "Number 2",
      type: "Number",
      value: 0,
    },
  ],
  difficulty: "easy",
  tags: ["math", "operation"],
};

class math_operation extends BaseNode {
  constructor() {
    super(config);
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("MATH OPERATION | Executing logic");

    const Number1Filter = inputs.filter((e) => e.name === "Number 1");
    const Number1data =
      Number1Filter.length > 0 ? Number1Filter[0].value : contents[0].value || "";

    if (!Number1data) {
      webconsole.error("MATH OPERATION | Number 1 not found");
      return null;
    }

    const Number2Filter = inputs.filter((e) => e.name === "Number 2");
    const Number2data =
      Number2Filter.length > 0 ? Number2Filter[0].value : contents[1].value || "";

    if (!Number2data) {
      webconsole.error("MATH OPERATION | Number 2 not found");
      return null;
    }

    const OperationFilter = inputs.filter((e) => e.name === "Operation");
    const Operationdata =
      OperationFilter.length > 0 ? OperationFilter[0].value : contents[2].value || "";

    if (!Operationdata) {
      webconsole.error("MATH OPERATION | Operator not found");
      return null;
    }

    try {
      if (
        Number1data === null ||
        Number2data === null ||
        Operationdata === null
      ) {
        webconsole.error("MATH OPERATION | Some data is null");
        return null;
      }

      if (
        Number1data === undefined ||
        Number2data === undefined ||
        Operationdata === undefined
      ) {
        webconsole.error("MATH OPERATION | Some data is undefined");
        return null;
      }

      if (isNaN(Number1data) || isNaN(Number2data)) {
        webconsole.error("MATH OPERATION | Some data is not a number");
        return null;
      }

      if (
        Operationdata !== "+" &&
        Operationdata !== "-" &&
        Operationdata !== "*" &&
        Operationdata !== "/"
      ) {
        webconsole.error("MATH OPERATION | Invalid operation");
        return null;
      }

      let result;
      switch (Operationdata) {
        case "+":
          result = Number1data + Number2data;
          break;
        case "-":
          result = Number1data - Number2data;
          break;
        case "*":
          result = Number1data * Number2data;
          break;
        case "/":
          result = Number1data / Number2data;
          break;
      }

      webconsole.success("MATH OPERATION | Successfully performed operation");
      return result;
    } catch (error) {
      webconsole.error("MATH OPERATION | Some error occured: " + error);
      return null;
    }
  }
}

export default math_operation;
