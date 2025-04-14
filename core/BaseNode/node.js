const sampleConfig = {
    title: "Title",
    category: "category folder name",
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
    fields: {
        fieldOnNode: {
            type: "HTML input type",
            desc: "",
            value: "placeholder value, not necessarily string",
        }
    },
    tags: ['smaller', 'tag', 'names'],
}

class Node {
    /**
     * Initialize a node
     * @param {JSON} configJSON configuration of the node
     */
    constructor(configJSON) {
        this.title = configJSON.title;
        this.inputs = configJSON.input;
        this.outputs = configJSON.outputs;

        this.tags = configJSON.tags;
        this.fields = configJSON.fields;
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
            inputs: this.inputs,
            outputs: this.outputs,
            tags: this.tags,
            fields: this.fields,
        }

        return config;
    }
}

export default Node;