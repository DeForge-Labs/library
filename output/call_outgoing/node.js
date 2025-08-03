import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Call Outgoing",
    category: "output",
    type: "call_outgoing",
    icon: {},
    desc: "Make an outgoing call to a given number",
    credit: 100,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Phrase to say on call",
            name: "Message",
            type: "Text",
        },
        {
            desc: "Number to call",
            name: "Number",
            type: "Text",
        },
    ],
    outputs: [],
    fields: [
        {
            desc: "Phrase to say on call",
            name: "Message",
            type: "TextArea",
            value: "text here ...",
        },
        {
            desc: "Number to call",
            name: "Number",
            type: "Text",
            value: "+91 99999 88888"
        },
    ],
    difficulty: "easy",
    tags: ["output", "call"],
}

class call_outgoing extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("OUTGOING CALL NODE | Started execution");
        webconsole.info("OUTGOING CALL NODE | Making the call");
        webconsole.success("OUTGOING CALL NODE | Call successfully concluded");
        
        return null;
    }
}

export default call_outgoing;