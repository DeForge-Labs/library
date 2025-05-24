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
    const Textdata =
      TextFilter.length > 0 ? TextFilter[0].value : contents[0].value;

    try {
      if (Textdata === null || Textdata === undefined) {
        webconsole.error("TEXT TO DATE NODE | Some data is null");
        return null;
      }

      if (typeof Textdata !== "string") {
        webconsole.error("TEXT TO DATE NODE | Some data is not a string");
        return null;
      }

      const dateObj = new Date(Textdata);
      const date = {
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
        day: dateObj.getDate(),
        hour: dateObj.getHours(),
        minute: dateObj.getMinutes(),
        second: dateObj.getSeconds(),
        millisecond: dateObj.getMilliseconds(),
      };
      webconsole.success("TEXT TO DATE NODE | Successfully converted text");
      return date;
    } catch (error) {
      webconsole.error("TEXT TO DATE NODE | Some error occured: " + error);
      return null;
    }
  }
}

export default text_to_date;
