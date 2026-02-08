import BaseNode from "../../core/BaseNode/node.js";

const timezones = [
    "UTC",
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Australia/Sydney",
    "Pacific/Auckland"
];

const config = {
    title: "Cron Trigger",
    category: "trigger",
    type: "cron_trigger",
    icon: {},
    desc: "Triggers a flow at a specific time with optional start delay and limits",
    credit: 0,
    inputs: [],
    outputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Timestamp of execution",
            name: "timeStamp",
            type: "Date",
        },
    ],
    fields: [
        {
            desc: "Interval in Hours (e.g., 0.5 for 30 mins, 24 for daily)",
            name: "Interval in Hours",
            type: "Number",
            value: 1,
        },
        {
            desc: "Start Date & Time (Optional). Must be within next 10 days.",
            name: "Start Time",
            type: "Date",
            value: "", // ISO String or Date object
        },
        {
            desc: "Max Executions (0 for infinite)",
            name: "Max Executions",
            type: "Number",
            value: 0,
        },
        {
            desc: "Timezone for the schedule",
            name: "Timezone",
            type: "select",
            value: "UTC",
            options: timezones,
        },
    ],
    difficulty: "easy",
    tags: ["trigger", "cron", "schedule"],
}

class cron_trigger extends BaseNode {
    constructor() {
        super(config);
    }

    /**
     * @override
     * @inheritdoc
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
                timezone: contents.find(c => c.name === "Timezone")?.value || "UTC"
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