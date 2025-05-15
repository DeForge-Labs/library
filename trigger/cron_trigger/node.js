import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Cron Trigger",
    category: "trigger",
    type: "cron_trigger",
    icon: {},
    desc: "Triggers a flow at a specific time",
    inputs: [],
    outputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "timeStamp",
            name: "timeStamp",
            type: "Date",
        },
    ],
    fields: [
        {
            desc: "Interval in Hours",
            name: "Interval in Hours",
            type: "Number",
            value: 0,
        },
    ],
    difficulty: "easy",
    tags: ["trigger", "cron"],
}

class cron_trigger extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
    }
}

export default cron_trigger;