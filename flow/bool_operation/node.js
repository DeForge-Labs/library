import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Boolean Operation",
    category: "flow",
    type: "bool_operation",
    icon: {},
    desc: "Performs a logical operation based on a condition",
    inputs: [
        {
            desc: "First input",
            name: "Input 1",
            type: "Boolean",
        },
        {
            desc: "Second input",
            name: "Input 2",
            type: "Boolean",
        },
    ],
    outputs: [
        {
            desc: "The Flow of the Condition if true",
            name: "True",
            type: "Flow",
        },
        {
            desc: "The Flow of the Condition if false",
            name: "False",
            type: "Flow",
        },
        {
            desc: "Result",
            name: "Result",
            type: "Boolean",
        },
    ],
    fields: [
        {
            desc: "Logic (NOT operation only works on input 1)",
            name: "Logic",
            type: "select",
            value: "AND",
            options: ["AND", "OR", "NOT"],
        },
    ],
    difficulty: "easy",
    tags: ["logic", "and", "or", "not"],
}

class if_condition extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
        webconsole.info("IF NODE | Begin execution");

        const input1Filter = inputs.filter((e) => e.name === "Input 1");
        if (input1Filter.length === 0) {
            webconsole.error("LOGICAL OPERATION NODE | Input 1 required but not given");
            return null;
        }
        const input1 = input1Filter[0].value;

        const input2Filter = inputs.filter((e) => e.name === "Input 2");
        if (input2Filter.length === 0) {
            webconsole.error("LOGICAL OPERATION NODE | Input 2 required but not given");
            return null;
        }
        const input2 = input2Filter[0].value;

        const operation = contents[0].value;
        let res = true;
        switch (operation) {
            case "AND":
                res = input1 && input2
                break;
            case "OR":
                res = input1 || input2
                break;
            case "NOT":
                res = !input1
                break;
            default:
                break;
        }

        webconsole.success("LOGICAL OPERATION NODE | Emmitting result");
        return { True: res, False: !res, Result: res };
    }
}

export default if_condition;