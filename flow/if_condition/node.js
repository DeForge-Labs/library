import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "If Condition",
    category: "flow",
    type: "if_condition",
    icon: {},
    desc: "Performs a conditional operation based on a condition",
    inputs: [
        {
            desc: "First input",
            name: "Input 1",
            type: "Any",
        },
        {
            desc: "Second input",
            name: "Input 2",
            type: "Any",
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
    ],
    fields: [
        {
            desc: "Condition",
            name: "Condition",
            type: "select",
            value: "==",
            options: ["==", "!=", ">", "<", ">=", "<="],
        },
    ],
    difficulty: "easy",
    tags: ["condition", "if"],
}

class if_condition extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
        webconsole.info("IF NODE | Begin execution");

        const input1Filter = inputs.filter((e) => e.name === "Input 1");
        if (input1Filter.length === 0) {
            webconsole.error("IF NODE | Input 1 required but not given");
            return null;
        }
        const input1 = input1Filter[0].value;

        const input2Filter = inputs.filter((e) => e.name === "Input 1");
        if (input2Filter.length === 0) {
            webconsole.error("IF NODE | Input 2 required but not given");
            return null;
        }
        const input2 = input2Filter[0].value;

        const operation = contents[0].value;
        let res = true;
        switch (operation) {
            case "==":
                res = input1 == input2
                break;
            case "!=":
                res = input1 != input2
                break;
            case ">":
                res = input1 > input2;
                break;
            case "<":
                res = input1 < input2;
                break;
            case ">=":
                res = input1 >= input2;
                break;
            case " <=":
                res = input1 <= input2;
                break;        
            default:
                break;
        }

        return { True: res, False: !res };
    }
}

export default if_condition;