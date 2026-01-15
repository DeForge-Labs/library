import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "For Loop",
    category: "flow",
    type: "for_loop",
    icon: {},
    desc: "Executes nodes inside the loop for a specified number of iterations",
    credit: 0,
    inputs: [
        {
            desc: "The flow to activate this loop",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Number of iterations to run",
            name: "Iterations",
            type: "Number",
        },
        {
            desc: "Starting index (default 0)",
            name: "Start Index",
            type: "Number",
        },
        {
            desc: "Increment value for each iteration (default 1)",
            name: "Increment",
            type: "Number",
        },
    ],
    outputs: [
        {
            desc: "Flow for nodes inside the loop (executes each iteration)",
            name: "Loop Flow",
            type: "Flow",
        },
        {
            desc: "Flow for nodes after the loop completes",
            name: "End Flow",
            type: "Flow",
        },
        {
            desc: "Current iteration index",
            name: "Current Index",
            type: "Number",
        },
        {
            desc: "True if this is the last iteration",
            name: "Is Last",
            type: "Boolean",
        },
    ],
    fields: [
        {
            desc: "Number of iterations to run",
            name: "Iterations",
            type: "Number",
            value: 5,
            min: 1,
            max: 10000,
        },
        {
            desc: "Starting index",
            name: "Start Index",
            type: "Number",
            value: 0,
        },
        {
            desc: "Increment value for each iteration",
            name: "Increment",
            type: "Number",
            value: 1,
            min: 1,
            max: 1000,
        },
    ],
    difficulty: "medium",
    tags: ["control", "loop", "iteration", "for"],
}

class for_loop extends BaseNode {
    constructor() {
        super(config);
    }

    /**
     * The actual loop execution is handled by the workflow engine.
     * This run method is called once by the engine to get initial configuration,
     * but the engine handles the actual loop iteration logic.
     * 
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
            webconsole.info("FOR LOOP | Initializing loop node");
            
            // Get iteration settings from inputs or contents
            const getInputValue = (name) => {
                const input = inputs.find(i => i.name === name);
                return input?.value;
            };
            
            const getContentValue = (name, defaultValue) => {
                const content = contents.find(c => c.name === name);
                return content?.value ?? defaultValue;
            };
            
            const iterations = parseInt(
                getInputValue('Iterations') ?? 
                getContentValue('Iterations', 5)
            );
            
            const startIndex = parseInt(
                getInputValue('Start Index') ?? 
                getContentValue('Start Index', 0)
            );
            
            const increment = parseInt(
                getInputValue('Increment') ?? 
                getContentValue('Increment', 1)
            );
            
            // Validation
            if (iterations < 1) {
                webconsole.error("FOR LOOP | Iterations must be at least 1");
                return null;
            }
            
            if (iterations > 10000) {
                webconsole.info("FOR LOOP | Large iteration count (>10000), this may take a while");
            }
            
            if (increment < 1) {
                webconsole.error("FOR LOOP | Increment must be at least 1");
                return null;
            }
            
            webconsole.info(`FOR LOOP | Configured: ${iterations} iterations, start: ${startIndex}, increment: ${increment}`);
            
            // Return initial loop state
            // The workflow engine will handle the actual iteration logic
            // and will update these values during each iteration
            return {
                "__loopConfig": {
                    type: "for_loop",
                    iterations,
                    startIndex,
                    increment,
                },
                "Loop Flow": true,
                "End Flow": false,
                "Current Index": startIndex,
                "Is Last": iterations === 1,
                "Credits": this.getCredit(),
            };
        } catch (error) {
            webconsole.error("FOR LOOP | Error: ", error);
            return null;
        }
    }
}

export default for_loop;
