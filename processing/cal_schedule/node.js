import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools"; // 1. Import tool
import { z } from "zod"; // 2. Import zod

const config = {
  title: "Get Cal.com Schedule",
  category: "processing",
  type: "cal_schedule",
  icon: {},
  desc: "Get cal.com schedule",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Cal.com Public Link",
      name: "Meeting Link",
      type: "Text",
    },
    {
      desc: "Timezone of the meeting in IANA format",
      name: "timezone",
      type: "Text",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      desc: "Slots of the meeting",
      name: "Slots",
      type: "JSON",
    },
    {
      desc: "The flow of the workflow if error occurs",
      name: "Error",
      type: "Flow",
    },
    {
      desc: "Error details",
      name: "Error payload",
      type: "Text",
    },
    {
      desc: "The tool version of this node, to be used by LLMs", // 2. Add Tool output
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Cal.com Public Link",
      name: "Meeting Link",
      type: "Text",
      value: "Meeting Link...",
    },
    {
      desc: "The timezone of the meeting in IANA format",
      name: "timezone",
      type: "Text",
      value: "Europe/London",
    },
  ],
  difficulty: "easy",
  tags: ["cal.com", "schedule", "meeting"],
};

class cal_schedule extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * Helper function to get value from inputs or contents
   */
  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  /**
   * 3. Core function to handle Cal.com schedule fetching logic
   */
  async executeGetSchedule(meetingLink, timezone, webconsole) {
    if (!meetingLink.trim()) {
      throw new Error("Meeting link not provided");
    }

    if (!timezone.trim()) {
      throw new Error("Timezone not provided");
    }

    try {
      const parts = meetingLink.split("/");
      if (parts.length < 5) {
        throw new Error("Invalid Cal.com meeting link format.");
      }

      const userName = parts[3];
      const eventTypeSlug = parts[4];

      const datetime = new Date(Date.now()).toISOString();

      // Fetch schedule for the next 30 days
      const nextMonthtime = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      webconsole.info(
        `CAL SCHEDULE | Fetching slots for ${userName}/${eventTypeSlug} in ${timezone} from ${datetime} to ${nextMonthtime}`
      );

      // Constructing the complex tRPC query URL
      const inputJson = {
        isTeamEvent: false,
        usernameList: [userName],
        eventTypeSlug: eventTypeSlug,
        startTime: datetime,
        endTime: nextMonthtime,
        timeZone: timezone,
        duration: null,
        rescheduleUid: null,
        orgSlug: null,
        teamMemberEmail: null,
        routedTeamMemberIds: null,
        skipContactOwner: false,
        _shouldServeCache: null,
        routingFormResponseId: null,
        email: null,
        _isDryRun: false,
      };

      const metaValues = {
        duration: ["undefined"],
        orgSlug: ["undefined"],
        teamMemberEmail: ["undefined"],
        _shouldServeCache: ["undefined"],
        routingFormResponseId: ["undefined"],
      };

      const inputParam = encodeURIComponent(
        JSON.stringify({ json: inputJson, meta: { values: metaValues } })
      );

      const apiUrl = `https://cal.com/api/trpc/slots/getSchedule?input=${inputParam}`;

      const response = await axios.get(apiUrl);

      webconsole.success("CAL SCHEDULE | Schedule fetched successfully");
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      webconsole.error("CAL SCHEDULE | Error during fetch: " + errorMsg);
      throw new Error(`Failed to get Cal.com schedule: ${errorMsg}`);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("CAL SCHEDULE | Begin execution");

    const meetingLink = this.getValue(inputs, contents, "Meeting Link", "");
    const timezone = this.getValue(inputs, contents, "timezone", "");

    // 4. Create the Tool
    const calGetScheduleTool = tool(
      async ({ meetingLink: toolLink, timezone: toolTimezone }, toolConfig) => {
        webconsole.info("CAL GET SCHEDULE TOOL | Invoking tool");

        try {
          const slots = await this.executeGetSchedule(
            toolLink,
            toolTimezone,
            webconsole
          );

          // Return the actual slots data from the tRPC response
          // The structure is typically { result: { data: { json: { slots: [...] } } } }
          const outputSlots = slots?.result?.data?.json?.slots || [];

          return [JSON.stringify(outputSlots), this.getCredit()];
        } catch (error) {
          webconsole.error(`CAL GET SCHEDULE TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              slots: [],
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "calGetSchedule",
        description:
          "Retrieve available booking slots for a Cal.com public meeting link for the next 30 days. Requires the public meeting URL and the desired IANA timezone.",
        schema: z.object({
          meetingLink: z
            .string()
            .url()
            .describe(
              "The full Cal.com public link for the event type (e.g., https://cal.com/user/event-type)"
            ),
          timezone: z
            .string()
            .describe(
              "The IANA timezone to fetch the slots in (e.g., Europe/London, America/New_York)"
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (!meetingLink || !timezone) {
      webconsole.info(
        "CAL SCHEDULE | Missing required fields for direct execution, returning tool only"
      );
      this.setCredit(0);
      return {
        Slots: null,
        Error: false,
        "Error payload": "",
        Tool: calGetScheduleTool,
      };
    }

    // 6. Execute the schedule fetching logic
    try {
      const responseData = await this.executeGetSchedule(
        meetingLink,
        timezone,
        webconsole
      );

      // Extract the slots from the complex tRPC response structure for the node output
      const outputSlots = responseData?.result?.data?.json?.slots || {};

      return {
        Slots: outputSlots,
        Credits: this.getCredit(),
        Error: false,
        "Error payload": "",
        Tool: calGetScheduleTool,
      };
    } catch (error) {
      webconsole.error("CAL SCHEDULE | Error: " + error.message);
      return {
        Slots: {},
        Credits: this.getCredit(),
        Error: true,
        "Error payload": error.message,
        Tool: calGetScheduleTool,
      };
    }
  }
}

export default cal_schedule;
