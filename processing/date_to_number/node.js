import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Date to Number",
    category: "processing",
    type: "date_to_number",
    icon: {},
    desc: "Converts date to number",
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Date to convert",
            name: "Date",
            type: "Date",
        },
    ],
    outputs: [
        {
            desc: "The number of the date",
            name: "Number",
            type: "Number",
        },
    ],
    fields: [
        {
            desc: "Date to convert",
            name: "Date",
            type: "Date",
            value: "Enter date here...",
        },
    ],
    difficulty: "easy",
    tags: ["date", "number"],
}

class date_to_number extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
        webconsole.info("DATE TO NUM NODE | Executing logic");

        const DateFilter = inputs.filter((e) => e.name === "Date");
        const Datedata = DateFilter.length > 0 ? DateFilter[0].value : contents[0].value;

        try {
            const data = new Date(Datedata).getTime();
            webconsole.success("DATE TO NUM NODE | successfully converted date");

            return data;
        } catch (error) {
            webconsole.error("DATE TO NUM NODE | Some error occured: " + error);
            return null;
        }
    }
}

export default date_to_number;