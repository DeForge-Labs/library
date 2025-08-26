import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Date to Number",
  category: "processing",
  type: "date_to_number",
  icon: {},
  desc: "Converts date to number",
  credit: 0,
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
};

class date_to_number extends BaseNode {
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
    webconsole.info("DATE TO NUM NODE | Executing logic");

    const DateFilter = inputs.filter((e) => e.name === "Date");
    const Datedata =
      DateFilter.length > 0 ? DateFilter[0].value : contents[0].value || "";

    if (!Datedata) {
      webconsole.error("DATE TO NUM NODE | No date provided");
      return null;
    }

    try {
      if (Datedata === null || Datedata === undefined) {
        webconsole.error("DATE TO NUM NODE | Date is null");
        return null;
      }

      if (
        !Datedata.year ||
        !Datedata.month ||
        !Datedata.day ||
        !Datedata.hour ||
        !Datedata.minute ||
        !Datedata.second ||
        !Datedata.millisecond
      ) {
        webconsole.error("DATE TO NUM NODE | Date is invalid");
        return null;
      }

      const data = new Date(
        Datedata.year,
        Datedata.month - 1, // JS months are 0-indexed
        Datedata.day,
        Datedata.hour,
        Datedata.minute,
        Datedata.second,
        Datedata.millisecond
      ).getTime();
      webconsole.success("DATE TO NUM NODE | successfully converted date");

      return {
        "Number": data,
        "Credits": this.getCredit(),
      }
    } catch (error) {
      webconsole.error("DATE TO NUM NODE | Some error occured: " + error);
      return null;
    }
  }
}

export default date_to_number;
