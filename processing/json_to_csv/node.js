import BaseNode from "../../core/BaseNode/node.js";
import Papa from "papaparse";

const config = {
  title: "JSON to CSV",
  category: "processing",
  type: "json_to_csv",
  icon: {},
  desc: "Converts JSON to CSV",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "JSON to convert",
      name: "JSON",
      type: "JSON",
    },
  ],
  outputs: [
    {
      desc: "The CSV parsed from JSON",
      name: "Text",
      type: "Text",
    },
  ],
  fields: [
    {
      desc: "JSON to convert",
      name: "JSON",
      type: "Map",
    },
  ],
  difficulty: "easy",
  tags: ["csv", "json"],
};

class json_to_csv extends BaseNode {
  constructor() {
    super(config);
  }

  async run(inputs, contents, webconsole, serverData) {
    const JSONFilter = inputs.filter((e) => e.name === "JSON");
    const JSONdata =
      JSONFilter.length > 0 ? JSONFilter[0].value : contents[0].value || {};

    try {
      if (JSONdata === null || JSONdata === undefined) {
        webconsole.error("JSON TO CSV NODE | Some data is null");
        return null;
      }

      if (typeof JSONdata !== "object") {
        webconsole.error("JSON TO CSV NODE | Some data is not a object");
        return null;
      }

      const csv = Papa.unparse(JSONdata);
      webconsole.success("JSON TO CSV NODE | Successfully converted JSON");
      return csv;
    } catch (error) {
      webconsole.error("JSON TO CSV NODE | Some error occured: " + error);
      return null;
    }
  }
}

export default json_to_csv;
