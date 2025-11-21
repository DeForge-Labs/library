const sampleConfig = {
    title: "Title",
    category: "category folder name",
    type: "node class name, should be same as the folder name of the node",
    icon: {
        type: "svg/jpeg/png",
        content: "base64 of the image"
    },
    desc: "Optinal node description",
    credit: 0, // Amount credit this node should cost
    inputs: [
        {
            name: "Name",
            type: "NodeType",
            desc: "",
        },
    ],
    outputs: [
        {
            name: "Name",
            type: "NodeType",
            desc: "",
        }
    ],
    fields: [
        {
            name: "fieldOnNode",
            type: "HTML input type",
            desc: "",
            value: "placeholder value, not necessarily string",
        }
    ],
    difficulty: "easy/medium/hard",
    tags: ['smaller', 'tag', 'names'],
};
;
;
;
;
;
;
;
;
;
/**
 * The Base Node class.
 * All nodes must extend this class
 */
export default class BaseNode {
    /**
     * Initialize a node
     * @param {NodeConfig} configJSON configuration of the node
     */
    constructor(configJSON) {
        this.title = configJSON.title;
        this.category = configJSON.category;
        this.type = configJSON.type;
        this.icon = configJSON.icon;
        this.desc = configJSON.desc;
        this.credit = configJSON.credit;
        this.inputs = configJSON.inputs;
        this.outputs = configJSON.outputs;
        this.tags = configJSON.tags;
        this.fields = configJSON.fields;
        this.difficulty = configJSON.difficulty;
        this.stats = {};
    }
    /**
     * Get the config for a node
     *
     * @returns The config for the node
     */
    getConfig() {
        return {
            title: this.title,
            category: this.category,
            type: this.type,
            icon: this.icon,
            desc: this.desc,
            credit: this.credit,
            inputs: this.inputs,
            outputs: this.outputs,
            tags: this.tags,
            fields: this.fields,
            difficulty: this.difficulty,
        };
    }
    /**
     * Returns the current value of the credit being cost
     * @returns The current credit cost
     */
    getCredit() {
        return this.credit;
    }
    /**
     * Sets the credit cost for the node
     * @param {number} value The new credit cost
     */
    setCredit(value) {
        if (typeof value === "number") {
            this.credit = value;
        }
    }
    /**
     * Returns the stats of the node
     * @returns The stats of the node
     */
    getStats() {
        return this.stats;
    }
    /**
     * Sets the stats of the node
     * @param key The key of the stat
     * @param value The value of the stat
     */
    setStats(key, value) {
        this.stats[key] = value;
    }
    /**
     * Estimates the credit usage of the node
     *
     * Can be overriden to add custom logic
     *
     * @param {Inputs[]} inputs The inputs to the node
     * @param {Contents[]} contents The contents of the node
     * @param {IServerData} serverData contains useful information from the server
     *
     * @returns The estimated credit usage
     */
    estimateUsage(inputs, contents, serverData) {
        return this.credit;
    }
    /**
     * Destroy method to be implemented to end db connections
     * @returns
     */
    destroy() {
        return;
    }
}
