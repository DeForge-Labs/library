import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Cron Trigger",
    category: "trigger",
    type: "cron_trigger",
    icon: {},
    desc: "Triggers a flow at a specific time",
    credit: 0,
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
            webconsole.success("CRON TRIGGER NODE | Executing job");

            const invokeTimestamp = serverData.invokeTime || Date.now();
            const dateObj = new Date(invokeTimestamp);

            const date = {
                year: dateObj.getFullYear(),
                month: dateObj.getMonth() + 1,
                day: dateObj.getDate(),
                hour: dateObj.getHours(),
                minute: dateObj.getMinutes(),
                second: dateObj.getSeconds(),
                millisecond: dateObj.getMilliseconds(),
            };

            return {
                "Flow": true,
                "timeStamp": date,
                "Credits": this.getCredit(),
            };
        } catch (error) {
            webconsole.error("CRON TRIGGER NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default cron_trigger;