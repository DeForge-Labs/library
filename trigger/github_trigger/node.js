import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "GitHub Trigger",
  category: "trigger",
  type: "github_trigger",
  icon: {},
  desc: "Triggers the flow when a specified GitHub event occurs in a repository",
  credit: 0,
  inputs: [],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The type of GitHub event (e.g., issues, pull_request, push)",
      name: "Event Type",
      type: "Text",
    },
    {
      desc: "The specific action (e.g., opened, closed, created) if applicable",
      name: "Action",
      type: "Text",
    },
    {
      desc: "The repository name (e.g., octocat/Hello-World)",
      name: "Repository",
      type: "Text",
    },
    {
      desc: "The username of the person who triggered the event",
      name: "Sender",
      type: "Text",
    },
    {
      desc: "The full JSON payload from GitHub",
      name: "Payload",
      type: "JSON",
    },
  ],
  fields: [
    {
      desc: "Repository to listen to (e.g., owner/repo)",
      name: "Repository",
      type: "Text",
      value: "",
    },
    {
      name: "Event Type",
      type: "select",
      desc: "The GitHub event that will trigger this flow",
      value: "push",
      options: [
        "*",
        "push",
        "pull_request",
        "issues",
        "issue_comment",
        "star",
        "fork",
        "release",
      ],
    },
    {
      desc: "Connect to your GitHub account",
      name: "GitHub",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["trigger", "github", "webhook", "repo"],
};

class github_trigger extends BaseNode {
  constructor() {
    super(config);
  }

  async run(inputs, contents, webconsole, serverData) {
    try {
      webconsole.info("GITHUB TRIGGER | Started execution");

      const payload = serverData.githubPayload;

      if (!payload) {
        webconsole.error("GITHUB TRIGGER | Invalid or missing GitHub payload");
        return null;
      }

      const eventType = payload.eventType || "unknown";

      const selectedEventType =
        contents.find((c) => c.name === "Event Type")?.value || "*";

      if (selectedEventType !== "*" && eventType !== selectedEventType) {
        webconsole.warn(
          `GITHUB TRIGGER | Ignored event: ${eventType}. Listening for: ${selectedEventType}`,
        );
        return null;
      }

      const action = payload.action || "";
      const repository = payload.repository?.full_name || "";
      const sender = payload.sender?.login || "";

      webconsole.success(
        `GITHUB TRIGGER | Event '${eventType}' received from ${repository}, continuing flow`,
      );

      return {
        Flow: true,
        "Event Type": eventType,
        Action: action,
        Repository: repository,
        Sender: sender,
        Payload: payload,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("GITHUB TRIGGER | Some error occured: " + error.message);
      return null;
    }
  }
}

export default github_trigger;
