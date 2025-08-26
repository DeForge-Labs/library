import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Objects To Map",
    category: "processing",
    type: "obj_to_map",
    icon: {},
    desc: "Convert object to map",
    credit: 0,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
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
            webconsole.info("OBJECT TO MAP NODE | Gathering objects");
            let pairMap = {};

            const inputObjsFilter = inputs.find((e) => e.name === "objects");
            const inputObjs = inputObjsFilter?.value || [];

            for (const obj of inputObjs) {
                const key = Object.keys(obj.value)[0];
                const value = Object.values(obj.value)[0];

                pairMap[key] = value;
            }

            webconsole.success(`OBJECT TO MAP NODE | Successfully converted  data`)

            return {
                "map": pairMap,
                "Credits": this.getCredit(),
            };
        } catch (error) {
            webconsole.error("OBJECT TO MAP NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default obj_to_map;