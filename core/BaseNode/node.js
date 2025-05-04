const sampleConfig = {
    title: "Title",
    category: "category folder name",
    type: "node class name, should be same as the folder name of the node",
    icon: {
        type: "svg/jpeg/png",
        content: "base64 of the image"
    },
    desc: "Optinal node description",
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
    difficulty: "low/medium/high",
    tags: ['smaller', 'tag', 'names'],
}

class Node {
    /**
     * Initialize a node
     * @param {JSON} configJSON configuration of the node
     */
    constructor(configJSON) {
        this.title = configJSON.title;
        this.category = configJSON.category;
        this.type = configJSON.type;
        this.icon = configJSON.icon;
        this.desc = configJSON.desc;
        this.inputs = configJSON.input;
        this.outputs = configJSON.outputs;

        this.tags = configJSON.tags;
        this.fields = configJSON.fields;
        this.difficulty = configJSON.difficulty;
    }

    /**
     * The main method that runs all nodes.
     * Need to be overidden.
     * @param {JSON} inputs The inputs to the node
     */
    run(inputs, contents) {
        
    }

    /**
     * Get the config for a node
     */
    getConfig() {
        const config = {
            title: this.title,
            category: this.category,
            type: this.type,
            icon: this.icon,
            desc: this.desc,
            inputs: this.inputs,
            outputs: this.outputs,
            tags: this.tags,
            fields: this.fields,
            difficulty: this.difficulty,
        }

        return config;
    }
}

export default Node;