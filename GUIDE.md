# GUIDE: Creating Your Own Node for Deforge

This guide will help you create your own node for the Deforge system. Please follow all instructions carefully to ensure compatibility and maintainability.

## 1. Extend from BaseNode

Every node **must** extend the `BaseNode` class (imported from `../../core/BaseNode/node.js`).

```js
import BaseNode from "../../core/BaseNode/node.js";

class my_node extends BaseNode {
    constructor() {
        super(config);
    }
    // ...
}
```

## 2. Node Configuration Format

Each node file **must** define a `config` object at the top, following the format below (see `BaseNode/node.js` for reference):

```js
const config = {
    title: "Node Title",
    category: "category_folder_name",
    type: "node_class_name", // should match the folder name
    icon: {
        type: "svg/jpeg/png",
        content: "base64 of the image"
    },
    desc: "Optional node description",
    inputs: [
        { name: "Name", type: "NodeType", desc: "" },
    ],
    outputs: [
        { name: "Name", type: "NodeType", desc: "" },
    ],
    fields: [
        { name: "fieldOnNode", type: "HTML input type", desc: "", value: "placeholder value" },
    ],
    difficulty: "easy/medium/hard",
    tags: ["tag1", "tag2"],
}
```

## 3. Accessing Inputs and Contents

Each node's `run` method receives `inputs` and `contents` arrays. To get a value, you should **prioritize `inputs` over `contents`**. Here is a recommended pattern:

```js
const SomeValue = (inputs.find(e => e.name === "SomeField")?.value)
    || (contents.find(e => e.name === "SomeField")?.value)
    || "default value";
```

**Example from another node:**
```js
const Link = inputs.find(e => e.name === "Link")?.value
    || contents.find(e => e.name === "Link")?.value
    || "";
```

## 4. Returning Output

Return an object with output names as keys:

```js
return { "Output Name": outputValue };
```

**Example:**
```js
return { "Video Link": uploadedUrl };
```

If your node can fail, return `null`.

## 5. Logging

Use the `webconsole` object for logging. It has three methods:
- `webconsole.success(...args)`
- `webconsole.info(...args)`
- `webconsole.error(...args)`

You can pass as many parameters as you want to these methods. Example:
```js
webconsole.info("Starting download", url);
webconsole.success("Upload complete", resultUrl);
webconsole.error("Failed to process", error.message);
```

## 6. Node Self-Containment & Dependencies

Each node is **self-contained**. You must install all required npm packages for each node **inside that node's folder** (where its `package.json` is located). For example, if your node uses `axios`, run:

```sh
cd path/to/your/node_folder
npm install axios
```

## 7. Example Node Skeleton

```js
import BaseNode from "../../core/BaseNode/node.js";
const config = { /* ...see above... */ };

class my_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        const Field = inputs.find(e => e.name === "Field")?.value
            || contents.find(e => e.name === "Field")?.value
            || "default";
        webconsole.info("Processing field", Field);
        // ... your logic ...
        return { "Output": result };
    }
}

export default my_node;
```

---

For more examples, see other nodes in the repository. Always follow this structure for compatibility with the Deforge system.

_Application to test your own nodes visually will be available soon..._