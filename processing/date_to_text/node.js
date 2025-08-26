import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Date to Text",
  category: "processing",
  type: "date_to_text",
  icon: {},
  desc: "Converts date to text",
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
    {
      desc: "The locale for the date (like en-US, de-DE)",
      name: "Locale",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The text representation of the date",
      name: "Text",
      type: "Text",
    },
  ],
  fields: [
    {
      desc: "Date to convert",
      name: "Date",
      type: "Date",
      value: "Enter date here...",
    },
    {
      desc: "The locale for the date (like en-US, de-DE)",
      name: "Locale",
      type: "Text",
      value: "en-US",
    },
  ],
  difficulty: "easy",
  tags: ["date", "text"],
};

class date_to_text extends BaseNode {
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
    webconsole.info("DATE TO TEXT NODE | Executing logic");

    const DateFilter = inputs.filter((e) => e.name === "Date");
    const Datedata =
      DateFilter.length > 0 ? DateFilter[0].value : contents.find((e) => e.name === "Date")?.value;

    const LocaleFilter = inputs.filter((e) => e.name === "Locale");
    const Locale = LocaleFilter.length > 0 ? LocaleFilter[0].value : contents.find((e) => e.name === "Locale")?.value || "en-US";

    if (!Datedata) {
      webconsole.error("DATE TO TEXT NODE | No date provided");
      return null;
    }

    try {
      if (Datedata === null || Datedata === undefined) {
        webconsole.error("DATE TO TEXT NODE | Date is null");
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
        webconsole.error("DATE TO TEXT NODE | Date is invalid");
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
      ).toLocaleString(Locale);
      webconsole.success("DATE TO TEXT NODE | successfully converted date");

      return data;
    } catch (error) {

      if (error instanceof RangeError) {
        const data = new Date(
          Datedata.year,
          Datedata.month - 1, // JS months are 0-indexed
          Datedata.day,
          Datedata.hour,
          Datedata.minute,
          Datedata.second,
          Datedata.millisecond
        ).toLocaleString("en-US");
        webconsole.success("DATE TO TEXT NODE | successfully converted date fallback to en-US");

        return {
          "Text": data,
          "Credits": this.getCredit(),
        }
      }
      else {
        webconsole.error("DATE TO TEXT NODE | Some error occured: " + error);
        return null;
      }
    }
  }
}

export default date_to_text;
