import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
const config = {
  title: "Math Operation",
  category: "processing",
  type: "math_operation",
  icon: {},
  desc: "Performs a mathematical operation on two numbers: addition, subtraction, multiplication, or division.",
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
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
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
  tags: ["math", "operation", "calculate"],
};

class math_operation extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * Helper function to get value from inputs or contents
   */
  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  /**
   * 3. Core function to handle math operation logic
   */
  executeMathOperation(num1, num2, operation, webconsole) {
    // Ensure inputs are numbers
    const Number1data = Number(num1);
    const Number2data = Number(num2);
    const Operationdata = String(operation);

    if (isNaN(Number1data) || isNaN(Number2data)) {
      throw new Error("One or both inputs are not valid numbers.");
    }

    if (!["+", "-", "*", "/"].includes(Operationdata)) {
      throw new Error("Invalid operation. Must be '+', '-', '*', or '/'.");
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
        if (Number2data === 0) {
          throw new Error("Division by zero is not allowed.");
        }
        result = Number1data / Number2data;
        break;
      default:
        // Should be caught by the check above, but for completeness
        throw new Error("Invalid operation specified.");
    }

    webconsole.success(`MATH OPERATION | Result: ${result}`);
    return result;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("MATH OPERATION | Executing logic");

    const Number1data = this.getValue(inputs, contents, "Number 1");
    const Number2data = this.getValue(inputs, contents, "Number 2");
    const Operationdata = this.getValue(inputs, contents, "Operation", "+");

    // 4. Create the Tool
    const mathOperationTool = tool(
      async ({ number1, number2, operation }, toolConfig) => {
        webconsole.info("MATH OPERATION TOOL | Invoking tool");

        try {
          const result = this.executeMathOperation(
            number1,
            number2,
            operation,
            webconsole
          );

          return [JSON.stringify({ result: result }), this.getCredit()];
        } catch (error) {
          webconsole.error(`MATH OPERATION TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              result: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "mathCalculator",
        description:
          "Performs a basic arithmetic operation (+, -, *, /) on two numbers. Use this for simple calculations.",
        schema: z.object({
          number1: z.number().describe("The first number for the operation."),
          number2: z.number().describe("The second number for the operation."),
          operation: z
            .enum(["+", "-", "*", "/"])
            .describe("The mathematical operation to perform."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (Number1data === null || Number2data === null || !Operationdata) {
      webconsole.info(
        "MATH OPERATION | Missing required fields, returning tool only"
      );
      this.setCredit(0);
      return {
        Result: null,
        Tool: mathOperationTool,
      };
    }

    // 6. Execute the operation logic
    try {
      const result = this.executeMathOperation(
        Number1data,
        Number2data,
        Operationdata,
        webconsole
      );

      return {
        Result: result,
        Credits: this.getCredit(),
        Tool: mathOperationTool,
      };
    } catch (error) {
      webconsole.error("MATH OPERATION | Some error occured: " + error.message);
      return {
        Result: null,
        Credits: this.getCredit(),
        Tool: mathOperationTool,
      };
    }
  }
}

export default math_operation;
