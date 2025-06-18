import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Text to Date",
  category: "processing",
  type: "text_to_date",
  icon: {},
  desc: "Converts Text(ISO Date String) to Date",
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Text to convert",
      name: "Text",
      type: "Text",
    },
    {
      desc: "Target timezone (e.g., Asia/Kolkata, America/New_York)",
      name: "Timezone",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The date of the text",
      name: "Date",
      type: "Date",
    },
  ],
  fields: [
    {
      desc: "Text to convert",
      name: "Text",
      type: "Text",
      value: "Enter ISO Date String here...",
    },
    {
      desc: "Target timezone",
      name: "Timezone",
      type: "Text",
      value: "Asia/Tokyo",
    },
  ],
  difficulty: "easy",
  tags: ["text", "date"],
};

class text_to_date extends BaseNode {
  constructor() {
    super(config);
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("TEXT TO DATE NODE | Executing logic");

    const TextFilter = inputs.filter((e) => e.name === "Text");
    const Textdata = TextFilter.length > 0 ? TextFilter[0].value : contents.filter((e) => e.name === "Text")[0].value;

    const TimezoneFilter = inputs.filter((e) => e.name === "Timezone");
    const timezone = TimezoneFilter.length > 0 ? TimezoneFilter[0].value : contents.filter((e) => e.name === "Timezone")[0].value || "UTC";

    try {
      if (Textdata === null || Textdata === undefined || timezone === null || timezone === undefined) {
        webconsole.error("TEXT TO DATE NODE | Some data is null");
        return null;
      }

      if (typeof Textdata !== "string" || typeof timezone !== "string") {
        webconsole.error("TEXT TO DATE NODE | Some data is not a string");
        return null;
      }

      const dateObj = new Date(Textdata);
      
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(dateObj);
      const partsObj = parts.reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});

      // Get milliseconds separately as formatToParts doesn't include them
      const millisecond = dateObj.getMilliseconds();

      const date = {
        year: parseInt(partsObj.year),
        month: parseInt(partsObj.month),
        day: parseInt(partsObj.day),
        hour: parseInt(partsObj.hour),
        minute: parseInt(partsObj.minute),
        second: parseInt(partsObj.second),
        millisecond: millisecond,
        timezone: timezone
      };

      webconsole.success("TEXT TO DATE NODE | Successfully converted text");
      return {
        "Date": date,
      };
    } catch (error) {
      webconsole.error("TEXT TO DATE NODE | Some error occured: " + error);
      return null;
    }
  }
}

export default text_to_date;
