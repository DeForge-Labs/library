import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Object Input",
    category: "input",
    type: "obj_var",
    icon: {},
    desc: "Object variable",
    credit: 100,
    inputs: [
        {
            desc: "The key of the object",
            name: "key",
            type: "Text",
        },
        {
            desc: "The value of the object",
            name: "value",
            type: "Text",
        },
    ],
    outputs: [
        {
            desc: "The object of the variable",
            name: "Object",
            type: "JSON",
        },
    ],
    fields: [
        {
            desc: "The key of the object",
            name: "key",
            type: "Text",
            value: "key...",
        },
        {
            desc: "The value of the object",
            name: "value",
            type: "Text",
            value: "value...",
        },
    ],
    difficulty: "medium",
    tags: ["object", "variable"],
}

class obj_var extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
        try {
            const keyFilter = inputs.filter((e) => e.name === "key");
            const key = keyFilter.length > 0 ? keyFilter[0].value : contents.filter((e) => e.name === "key")[0].value || "";

            const valueFilter = inputs.filter((e) => e.name === "value");
            const value = valueFilter.length > 0 ? valueFilter[0].value : contents.filter((e) => e.name === "value")[0].value || "";

            if (!key || !value) {
                webconsole.error("OBJECT NODE | Key or Value missing");
                return null;
            }

            webconsole.success("OBJECT NODE | Emmitting JSON");
            return {
                [key]: value
            };
        } catch (error) {
            webconsole.error("OBJECT NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default obj_var;