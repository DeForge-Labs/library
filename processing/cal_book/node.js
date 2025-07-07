import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

const config = {
  title: "Book Cal.com Meeting",
  category: "processing",
  type: "cal_book",
  icon: {},
  desc: "Book cal.com meeting",
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
    }
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

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("CAL BOOK | Begin execution");

    const nameFilter = inputs.filter((e) => e.name === "Name");
    const name =
      nameFilter.length > 0
        ? nameFilter[0].value
        : contents.filter((e) => e.name === "Name")[0].value
        || "";

    if (!name.trim()) {
      webconsole.error("CAL BOOK | No Name found");
      return null;
    }

    const emailFilter = inputs.filter((e) => e.name === "Email");
    const email =
      emailFilter.length > 0
        ? emailFilter[0].value
        : contents.filter((e) => e.name === "Email")[0].value
        | "";

    if (!email.trim()) {
      webconsole.error("CAL BOOK | No email provided");
      return null;
    }

    const meetingLinkFilter = inputs.filter((e) => e.name === "Meeting Link");
    const meetingLink =
      meetingLinkFilter.length > 0
        ? meetingLinkFilter[0].value
        : contents.filter((e) => e.name === "Meeting Link")[0].value
        || "";

    if (!meetingLink.trim()) {
      webconsole.error("CAL BOOK | Meeting link not provided");
      return null;
    }

    const timezoneFilter = inputs.filter((e) => e.name === "timezone");
    const timezone =
      timezoneFilter.length > 0
        ? timezoneFilter[0].value
        : contents.filter((e) => e.name === "timezone")[0].value
        || "";

    if (!timezone.trim()) {
      webconsole.error("CAL BOOK | No timezone provided");
      return null;
    }

    const dateFilter = inputs.filter((e) => e.name === "Date");
    const date =
      dateFilter.length > 0
        ? dateFilter[0].value
        : contents.filter((e) => e.name === "Date")[0].value || "";

    if (!date) {
      webconsole.error("CAL BOOK | No date provided");
      return null;
    }

    const durationFilter = inputs.filter((e) => e.name === "Duration");
    const duration =
      durationFilter.length > 0
        ? durationFilter[0].value
        : contents.filter((e) => e.name === "Duration")[0].value
        || "30mins";

    if (!duration.trim()) {
      webconsole.error("CAL BOOK | Duration not selected");
      return null;
    }

    try {
      const eventIdPayload = await axios.get(meetingLink);

      const userName = meetingLink.split("/")[3];
      const eventTypeSlug = meetingLink.split("/")[4];

      const eventID = eventIdPayload.data
        .split("eventData")[1]
        .split("id")[1]
        .split(":")[1]
        .split(",")[0];

      const startSlot = new Date(
        date.year,
        date.month - 1, // JS months are 0-indexed
        date.day,
        date.hour,
        date.minute,
        date.second,
        date.millisecond
      ).toISOString();

      let endSlot;

      if (duration === "30mins") {
        endSlot = new Date(
          date.year,
          date.month - 1, // JS months are 0-indexed
          date.day,
          date.hour,
          date.minute + 30,
          date.second,
          date.millisecond
        ).toISOString();
      } else if (duration === "45mins") {
        endSlot = new Date(
          date.year,
          date.month - 1, // JS months are 0-indexed
          date.day,
          date.hour,
          date.minute + 45,
          date.second,
          date.millisecond
        ).toISOString();
      } else {
        endSlot = new Date(
          date.year,
          date.month - 1, // JS months are 0-indexed
          date.day,
          date.hour,
          date.minute + 60,
          date.second,
          date.millisecond
        ).toISOString();
      }

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
      };

      await axios.post("https://cal.com/api/book/event", payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      webconsole.success("CAL BOOK | Booking successful");
      return {
        "Success": true,
        "Error": false,
        "Error payload": "",
      };

    } catch (error) {
      webconsole.error("CAL BOOK | Error: " + error);
      return {
        "Success": false,
        "Error": true,
        "Error payload": JSON.stringify(error),
      };
    }
  }
}

export default cal_book;
