import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { fromZonedTime } from "date-fns-tz";
import { addMinutes } from "date-fns";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Book Cal.com Meeting",
  category: "processing",
  type: "cal_book",
  icon: {},
  desc: "Book cal.com meeting",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Name of the user",
      name: "Name",
      type: "Text",
    },
    {
      desc: "Email of the user",
      name: "Email",
      type: "Text",
    },
    {
      desc: "Cal.com Public Link",
      name: "Meeting Link",
      type: "Text",
    },
    {
      desc: "Timezone of the meeting in IANA format (e.g., Europe/London)",
      name: "timezone",
      type: "Text",
    },
    {
      desc: "Slot to book (Date object or string representation of a specific time)",
      name: "Date",
      type: "Date",
    },
    {
      desc: "Duration of the meeting (e.g., 30mins, 45mins, 1hr)",
      name: "Duration",
      type: "Text", // Changed type to Text for consistency with string options
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      desc: "The flow of the workflow if booking is successful",
      name: "Success",
      type: "Flow",
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
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Name of the user",
      name: "Name",
      type: "Text",
      value: "Name...",
    },
    {
      desc: "Email of the user",
      name: "Email",
      type: "Text",
      value: "Email...",
    },
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
    {
      desc: "Slot to book",
      name: "Date",
      type: "Date",
    },
    {
      desc: "Duration of the meeting",
      name: "Duration",
      type: "select",
      value: "30mins",
      options: ["30mins", "45mins", "1hr"],
    },
  ],
  difficulty: "easy",
  tags: ["cal.com", "book", "meeting"],
};

class cal_book extends BaseNode {
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
   * Helper function to convert the date object from the node/tool into a Date object
   * @param {Date | { year: number, month: number, day: number, hour: number, minute: number, second?: number, millisecond?: number }} dateInput
   * @param {string} timezone
   * @returns {{ startSlot: string, endSlot: string }}
   */
  getUtcSlots(dateInput, duration, timezone) {
    let startDateInUserTz;

    if (dateInput instanceof Date) {
      startDateInUserTz = dateInput;
    } else if (typeof dateInput === "string" || typeof dateInput === "number") {
      // Assume ISO string or timestamp if passed as string/number (e.g., from tool)
      startDateInUserTz = new Date(dateInput);
    } else if (typeof dateInput === "object" && dateInput !== null) {
      // Handle the node's specific Date object format
      startDateInUserTz = new Date(
        dateInput.year,
        dateInput.month - 1,
        dateInput.day,
        dateInput.hour,
        dateInput.minute,
        dateInput.second || 0,
        dateInput.millisecond || 0
      );
    } else {
      throw new Error("Invalid date input format");
    }

    const startUtc = fromZonedTime(startDateInUserTz, timezone);

    let durationInMinutes;
    if (duration === "45mins") {
      durationInMinutes = 45;
    } else if (duration === "1hr") {
      durationInMinutes = 60;
    } else {
      durationInMinutes = 30; // Default to 30mins
    }

    const endUtc = addMinutes(startUtc, durationInMinutes);
    return {
      startSlot: startUtc.toISOString(),
      endSlot: endUtc.toISOString(),
    };
  }

  /**
   * 3. Core function to handle Cal.com booking logic
   */
  async executeBookMeeting(
    name,
    email,
    meetingLink,
    timezone,
    dateInput,
    duration,
    webconsole
  ) {
    if (!name.trim()) throw new Error("Name is required");
    if (!email.trim()) throw new Error("Email is required");
    if (!meetingLink.trim()) throw new Error("Meeting link is required");
    if (!timezone.trim()) throw new Error("Timezone is required");
    if (!dateInput) throw new Error("Date slot is required");
    if (!duration.trim()) throw new Error("Duration is required");

    // 1. Get Event ID
    const userName = meetingLink.split("/")[3];
    const eventTypeSlug = meetingLink.split("/")[4];

    let eventID;
    try {
      const eventIdPayload = await axios.get(meetingLink);
      // This is highly fragile, assuming the Cal.com page structure.
      // In a real application, you'd use a stable API.
      const eventIDMatch = eventIdPayload.data.match(/eventData.*?id":(\d+)/);
      if (!eventIDMatch || eventIDMatch.length < 2) {
        throw new Error("Could not parse event ID from meeting link page.");
      }
      eventID = eventIDMatch[1];
    } catch (e) {
      throw new Error(
        `Failed to retrieve event ID from meeting link: ${e.message}`
      );
    }

    // 2. Format Dates
    const { startSlot, endSlot } = this.getUtcSlots(
      dateInput,
      duration,
      timezone
    );

    webconsole.info(
      `CAL BOOK | Attempting to book slot: ${startSlot} to ${endSlot} in ${timezone}`
    );

    // 3. Prepare Payload
    const payload = {
      responses: {
        name: name,
        email: email,
        location: {
          value: "integrations:daily", // Assuming default location setup
          optionValue: "",
        },
        guests: [],
      },
      user: userName,
      start: startSlot,
      end: endSlot,
      eventTypeId: Number(eventID),
      eventTypeSlug: eventTypeSlug,
      timeZone: timezone,
      language: "en",
      metadata: {},
      hasHashedBookingLink: false,
      routedTeamMemberIds: null,
      skipContactOwner: false,
      _isDryRun: false,
    };

    // 4. Post Booking
    try {
      await axios.post("https://cal.com/api/book/event", payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      return { success: true, message: "Booking successful" };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      webconsole.error(
        "CAL BOOK | API Error Data: " +
          JSON.stringify(error.response?.data || error.message)
      );
      throw new Error(`Cal.com booking failed: ${errorMsg}`);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("CAL BOOK | Begin execution");

    const name = this.getValue(inputs, contents, "Name", "");
    const email = this.getValue(inputs, contents, "Email", "");
    const meetingLink = this.getValue(inputs, contents, "Meeting Link", "");
    const timezone = this.getValue(inputs, contents, "timezone", "");
    const dateInput = this.getValue(inputs, contents, "Date", null);
    const duration = this.getValue(inputs, contents, "Duration", "30mins");

    // 4. Create the Tool
    const calBookTool = tool(
      async (
        {
          name: toolName,
          email: toolEmail,
          meetingLink: toolLink,
          timezone: toolTimezone,
          date: toolDate,
          duration: toolDuration,
        },
        toolConfig
      ) => {
        webconsole.info("CAL BOOK TOOL | Invoking tool");

        try {
          const result = await this.executeBookMeeting(
            toolName,
            toolEmail,
            toolLink,
            toolTimezone,
            toolDate,
            toolDuration,
            webconsole
          );

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          webconsole.error(`CAL BOOK TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              success: false,
              error: error.message,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "calBookMeeting",
        description:
          "Book a specific time slot on a Cal.com public meeting link. Provide the user's name, email, the public meeting URL, the IANA timezone (e.g., Europe/London), the desired start date/time, and the duration.",
        schema: z.object({
          name: z.string().describe("The name of the user booking the meeting"),
          email: z
            .string()
            .email()
            .describe("The email address of the user booking the meeting"),
          meetingLink: z
            .string()
            .url()
            .describe(
              "The full Cal.com public link for the event type (e.g., https://cal.com/user/event-type)"
            ),
          timezone: z
            .string()
            .describe(
              "The IANA timezone of the meeting slot (e.g., Europe/London, America/New_York)"
            ),
          date: z
            .string()
            .describe(
              "The specific start date and time to book, preferably in ISO 8601 format (e.g., 2025-10-25T10:00:00) in the specified timezone."
            ),
          duration: z
            .enum(["30mins", "45mins", "1hr"])
            .default("30mins")
            .describe("Duration of the meeting slot"),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (
      !name ||
      !email ||
      !meetingLink ||
      !timezone ||
      !dateInput ||
      !duration
    ) {
      webconsole.info(
        "CAL BOOK | Missing required fields for direct execution, returning tool only"
      );
      this.setCredit(0);
      return {
        Success: false,
        Error: false,
        "Error payload": "",
        Tool: calBookTool,
      };
    }

    // 6. Execute the booking logic
    try {
      await this.executeBookMeeting(
        name,
        email,
        meetingLink,
        timezone,
        dateInput,
        duration,
        webconsole
      );

      return {
        Success: true,
        Credits: this.getCredit(),
        Error: false,
        "Error payload": "",
        Tool: calBookTool,
      };
    } catch (error) {
      webconsole.error("CAL BOOK | Error: " + error.message);
      return {
        Success: false,
        Credits: this.getCredit(),
        Error: true,
        "Error payload": error.message,
        Tool: calBookTool,
      };
    }
  }
}

export default cal_book;
