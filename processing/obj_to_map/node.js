import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Objects To Map",
    category: "processing",
    type: "obj_to_map",
    icon: {
        type: "",
        content: "",
    },
    desc: "Convert object to map",
    inputs: [
        {
            desc: "Objects to convert",
            name: "objects",
            type: "JSON[]",
        },
    ],
    outputs: [
        {
            desc: "The map of the objects",
            name: "map",
            type: "JSON",
        },
    ],
    fields: [
        {
            desc: "Objects to convert",
            name: "objects",
            type: "JSON[]",
            value: "[]",
        },
    ],
    difficulty: "medium",
    tags: ["object", "map"],
}

class obj_to_map extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole) {
        
        let pairMap = {};

        for (const obj of inputs) {
            const key = Object.keys(obj.value)[0];
            const value = Object.values(obj.value)[0];

            pairMap[key] = value;
        }

        return pairMap;
    }
}

export default obj_to_map;