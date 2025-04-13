class Node {
    /**
     * Initialize a node
     * @param {JSON} configJSON 
     */
    constructor(configJSON) {
        this.title = configJSON.title;
        this.inputs = configJSON.input;
        this.outputs = configJSON.outputs;

        this.conn_color = configJSON.conn_color;

        this.content = configJSON.content;
    }

    /**
     * The main method that runs all nodes.
     * Need to be overidden.
     */
    run(inputs) {
        
    }
}

export default Node;