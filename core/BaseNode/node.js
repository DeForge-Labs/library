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
    run(inputs) {
        
    }
}

export default Node;