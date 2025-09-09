import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

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
      desc: "Timezone of the meeting in IANA format",
      name: "timezone",
      type: "Text",
    },
    {
      desc: "Slot to book",
      name: "Date",
      type: "Date",
    },
  ],
  outputs: [
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
   * Convert date to Cal.com format with timezone
   */
  formatDateForCalcom(dateObj, timezone) {
    // Create the date string directly without Date object
    const year = dateObj.year;
    const month = dateObj.month.toString().padStart(2, "0");
    const day = dateObj.day.toString().padStart(2, "0");
    const hours = dateObj.hour.toString().padStart(2, "0");
    const minutes = dateObj.minute.toString().padStart(2, "0");
    const seconds = (dateObj.second || 0).toString().padStart(2, "0");

    // Get timezone offset for the specified timezone
    const tempDate = new Date(
      `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
    );
    const offsetMinutes =
      tempDate.getTimezoneOffset() -
      new Date(
        tempDate.toLocaleString("en-US", { timeZone: timezone })
      ).getTimezoneOffset();

    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const offsetSign = offsetMinutes <= 0 ? "+" : "-";
    const offsetString = `${offsetSign}${offsetHours
      .toString()
      .padStart(2, "0")}:${offsetMins.toString().padStart(2, "0")}`;

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}`;
  }

  /**
   * @override
   * @inheritdoc
   */
  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("CAL BOOK | Begin execution");

    // Extract inputs with validation
    const nameFilter = inputs.filter((e) => e.name === "Name");
    const name =
      nameFilter.length > 0
        ? nameFilter[0].value
        : contents.filter((e) => e.name === "Name")[0]?.value || "";

    if (!name.trim()) {
      webconsole.error("CAL BOOK | No Name found");
      return {
        Success: false,
        Credits: this.getCredit(),
        Error: true,
        "Error payload": "Name is required",
      };
    }

    const emailFilter = inputs.filter((e) => e.name === "Email");
    const email =
      emailFilter.length > 0
        ? emailFilter[0].value
        : contents.filter((e) => e.name === "Email")[0]?.value || "";

    if (!email.trim()) {
      webconsole.error("CAL BOOK | No email provided");
      return {
        Success: false,
        Credits: this.getCredit(),
        Error: true,
        "Error payload": "Email is required",
      };
    }

    const meetingLinkFilter = inputs.filter((e) => e.name === "Meeting Link");
    const meetingLink =
      meetingLinkFilter.length > 0
        ? meetingLinkFilter[0].value
        : contents.filter((e) => e.name === "Meeting Link")[0]?.value || "";

    if (!meetingLink.trim()) {
      webconsole.error("CAL BOOK | Meeting link not provided");
      return {
        Success: false,
        Credits: this.getCredit(),
        Error: true,
        "Error payload": "Meeting link is required",
      };
    }

    const timezoneFilter = inputs.filter((e) => e.name === "timezone");
    const timezone =
      timezoneFilter.length > 0
        ? timezoneFilter[0].value
        : contents.filter((e) => e.name === "timezone")[0]?.value || "";

    if (!timezone.trim()) {
      webconsole.error("CAL BOOK | No timezone provided");
      return {
        Success: false,
        Credits: this.getCredit(),
        Error: true,
        "Error payload": "Timezone is required",
      };
    }

    const dateFilter = inputs.filter((e) => e.name === "Date");
    const date =
      dateFilter.length > 0
        ? dateFilter[0].value
        : contents.filter((e) => e.name === "Date")[0]?.value || "";

    if (!date) {
      webconsole.error("CAL BOOK | No date provided");
      return {
        Success: false,
        Credits: this.getCredit(),
        Error: true,
        "Error payload": "Date is required",
      };
    }

    const durationFilter = inputs.filter((e) => e.name === "Duration");
    const duration =
      durationFilter.length > 0
        ? durationFilter[0].value
        : contents.filter((e) => e.name === "Duration")[0]?.value || "30mins";

    try {
      // Extract user and event info from meeting link
      const urlParts = meetingLink.split("/");
      const userName = urlParts[3];
      const eventTypeSlug = urlParts[4];

      if (!userName || !eventTypeSlug) {
        throw new Error("Invalid meeting link format");
      }

      // Get the Cal.com page data
      const eventIdPayload = await axios.get(meetingLink);

      // Extract event ID using your proven method
      const eventID = eventIdPayload.data
        .split("eventData")[1]
        .split("id")[1]
        .split(":")[1]
        .split(",")[0];

      webconsole.info(`CAL BOOK | Extracted eventID: ${eventID}`);

      // Calculate duration in minutes
      let durationMinutes;
      switch (duration) {
        case "30mins":
          durationMinutes = 30;
          break;
        case "45mins":
          durationMinutes = 45;
          break;
        case "1hr":
          durationMinutes = 60;
          break;
        default:
          durationMinutes = 30;
      }

      // Create start and end times with proper timezone handling
      const startSlot = this.formatDateForCalcom(date, timezone);

      // Calculate end time
      const endDate = {
        ...date,
        minute: date.minute + durationMinutes,
      };

      // Handle minute overflow
      if (endDate.minute >= 60) {
        endDate.hour += Math.floor(endDate.minute / 60);
        endDate.minute = endDate.minute % 60;
      }

      // Handle hour overflow
      if (endDate.hour >= 24) {
        endDate.day += Math.floor(endDate.hour / 24);
        endDate.hour = endDate.hour % 24;
      }

      const endSlot = this.formatDateForCalcom(endDate, timezone);

      webconsole.info(`CAL BOOK | Start: ${startSlot}, End: ${endSlot}`);

      // Prepare payload matching Cal.com format
      const payload = {
        responses: {
          name: name,
          email: email,
          location: {
            value: "integrations:daily",
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
        dub_id: null,
      };

      webconsole.info("CAL BOOK | Sending booking request...");

      const response = await axios.post(
        "https://cal.com/api/book/event",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      webconsole.success("CAL BOOK | Booking successful");
      webconsole.info(`CAL BOOK | Response: ${JSON.stringify(response.data)}`);

      return {
        Success: true,
        Credits: this.getCredit(),
        Error: false,
        "Error payload": "",
      };
    } catch (error) {
      webconsole.error(`CAL BOOK | Error: ${error.message}`);

      let errorMessage = error.message;
      if (error.response) {
        errorMessage = `HTTP ${error.response.status}: ${JSON.stringify(
          error.response.data
        )}`;
      }

      return {
        Success: false,
        Credits: this.getCredit(),
        Error: true,
        "Error payload": errorMessage,
      };
    }
  }
}

export default cal_book;
