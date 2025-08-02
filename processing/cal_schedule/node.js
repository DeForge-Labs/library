import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

const config = {
  title: "Get Cal.com Schedule",
  category: "processing",
  type: "cal_schedule",
  icon: {},
  desc: "Get cal.com schedule",
  credit: 100,
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
    }
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

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("CAL SCHEDULE | Begin execution");

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

    try {
      const userName = meetingLink.split("/")[3];
      const eventTypeSlug = meetingLink.split("/")[4];

      const datetime = new Date(Date.now()).toISOString();

      const nextMonthtime = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const response = await axios.get(
        `https://cal.com/api/trpc/slots/getSchedule?input={"json":{"isTeamEvent":false,"usernameList":["${userName}"],"eventTypeSlug":"${eventTypeSlug}","startTime":"${datetime}","endTime":"${nextMonthtime}","timeZone":"${timezone}","duration":null,"rescheduleUid":null,"orgSlug":null,"teamMemberEmail":null,"routedTeamMemberIds":null,"skipContactOwner":false,"_shouldServeCache":null,"routingFormResponseId":null,"email":null,"_isDryRun":false},"meta":{"values":{"duration":["undefined"],"orgSlug":["undefined"],"teamMemberEmail":["undefined"],"_shouldServeCache":["undefined"],"routingFormResponseId":["undefined"]}}}`
      );

      webconsole.success(
        "CAL SCHEDULE | Response: \n" + JSON.stringify(response.data)
      );
      return {
        "Slots": response.data,
        "Error": false,
        "Error payload": "",
      };

    } catch (error) {
      webconsole.error("CAL SCHEDULE | Error: " + error);
      return {
        "Slots": {},
        "Error": true,
        "Error payload": JSON.stringify(error),
      };
    }
  }
}

export default cal_schedule;
