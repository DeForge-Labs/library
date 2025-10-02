import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "API Trigger",
  category: "trigger",
  type: "api_trigger",
  icon: {},
  desc: "Triggers the flow when an HTTP request is received at a unique webhook URL.",
  credit: 0,
  inputs: [],
  outputs: [
    {
      name: "Flow",
      type: "Flow",
      desc: "The Flow to trigger upon receiving a request.",
    },
    {
      name: "Body",
      type: "JSON",
      desc: "The JSON payload sent in the request body.",
    },
    {
      name: "Headers",
      type: "JSON",
      desc: "The HTTP headers from the incoming request.",
    },
    {
      name: "Query",
      type: "JSON",
      desc: "The URL query parameters from the request.",
    },
    {
      name: "Metadata",
      type: "JSON",
      desc: "Metadata about the request, like IP address and timestamp.",
    },
  ],
  fields: [
    {
      name: "method",
      type: "select",
      desc: "The HTTP request method that will trigger this flow.",
      value: "GET",
      options: ["GET", "POST", "PUT", "DELETE"],
    },
  ],
  difficulty: "easy",
  tags: ["trigger", "api", "webhook", "http"],
};

class api_trigger extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * @override
   * @inheritdoc
   * * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs
   * @param {import("../../core/BaseNode/node.js").Contents[]} contents
   * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole
   * @param {import("../../core/BaseNode/node.js").IServerData} serverData
   */
  async run(inputs, contents, webconsole, serverData) {
    try {
      webconsole.info("API TRIGGER NODE | Started execution");

      const payload = serverData.apiPayload || {};

      const body = payload.body || {};
      const headers = payload.headers || {};
      const query = payload.query || {};
      const metadata = payload.metadata || {};

      webconsole.success(
        "API TRIGGER NODE | Request received, continuing flow"
      );

      return {
        Flow: true,
        Body: body,
        Headers: headers,
        Query: query,
        Metadata: metadata,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error(
        `API TRIGGER NODE | An error occurred: ${error.message}`
      );
      return null;
    }
  }
}

export default api_trigger;
