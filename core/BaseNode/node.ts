const sampleConfig = {
    title: "Title",
    category: "category folder name",
    type: "node class name, should be same as the folder name of the node",
    icon: {
        type: "svg/jpeg/png",
        content: "base64 of the image"
    },
    desc: "Optinal node description",
    credit: 0, // Amount credit this node should cost
    inputs: [
        {
            name: "Name",
            type: "NodeType",
            desc: "",
        },
    ],
    outputs: [
        {
            name: "Name",
            type: "NodeType",
            desc: "",
        }
    ],
    fields: [
        {
            name: "fieldOnNode",
            type: "HTML input type",
            desc: "",
            value: "placeholder value, not necessarily string",
        }
    ],
    difficulty: "easy/medium/hard",
    tags: ['smaller', 'tag', 'names'],
}

/**
 * Defines the structure of the webconsole object passed in the serverData object
 */
export interface IWebConsole {
    /**
     * method to log blue colored info messages in the execution logs
     * @param content Any and all possible content to be represented in string format
     */
    info(...content: any[]): void;

    /**
     * method to log green colored success mesages in the execution logs
     * @param content Any and all possible content to be represented in string format
     */
    success(...content: any[]): void;

    /**
     * method to log red colored error mesages in the execution logs
     * @param content Any and all possible content to be represented in string format
     */
    error(...content: any[]): void;
};

/**
 * A standard response from the redisUtil in serverData
 */
export interface RedisResponse {
    success: boolean;
    message: string;
};

/**
 * The response for getkey method which includes an additional value
 */
export interface RedisGetResponse extends RedisResponse {
    value?: any;
};

/**
 * Defines the structure of the redisUtil object in serverData
 */
export interface IRedisUtil {
    /**
     * Method to set a key-value pair in redis. The key must be in 'deforge:scope:name' format
     * @param key The key to set in redis
     * @param value The value to store against the key
     */
    setKey(key: string, value: any): Promise<RedisResponse>;

    /**
     * Method to delete a particular key from redis.
     * @param key The key to delete from redis
     */
    deleteKey(key: string): Promise<RedisResponse>;

    /**
     * Method to retrieve a value given a key from redis
     * @param key The key to retreive
     */
    getKey(key: string): Promise<RedisGetResponse>;
};

/**
 * Defines the structure of the refreshUtil in serverData
 */
export interface IRefreshUtil {
    /**
     * Method to update the new set of twitter tokens in the database
     * @param token new set of token obtained using the refresh token
     */
    handleTwitterToken(token: any): void;
};

/**
 * Defines the structure of the widget payload
 */
export interface IWidget {
    /**
     * The unique ID of the particular chat session
     */
    queryId: string;
    /**
     * The message sent by the user
     */
    message: string;
}

/**
 * Defines the structure of the chatbot payload
 */
export interface IChatbot {
    /**
     * The unique ID of the particular chat session
     */
    queryId: string;
    /**
     * The message sent by the user
     */
    message: string;
}

/**
 * Defines the structure of the serverData object
 */
export interface IServerData {
    /**
     * workflow ID of the executing workflow this node is a part of
     */
    workflowId: string;
    /**
     * An unique chat ID if the node is a part of a chat based workflow
     */
    chatId: string;
    /**
     * List of environment variables stored in this workflow
     */
    envList: Record<string, any>;
    /**
     * List of social account Oauth tokens connected to this workflow
     */
    socialList: Record<string, any>;
    /**
     * An utility object that allows you to perform operations on the server's redis instance allowing you to store and manipulate data
     */
    redisUtil: IRedisUtil;
    /**
     * An utility object that allows you to store oauth token in database.
     * It is to be used to update tokens after refreshing them
     */
    refreshUtil: IRefreshUtil;

    /**
     * The message object received from telegram
     * 
     * @remarks
     * This object will only be included if the workflow includes a telegram trigger
     * 
     * The full specification for this Message object can be found at {@link https://core.telegram.org/bots/api#message | Telegram Bot API}
     */
    tgPayload?: any;
    /**
     * The message object received from slack
     * 
     * @remarks
     * This object will only be included if the workflow includes a slack trigger
     * 
     * The full specification for this object can be found at {@link https://api.slack.com/apis/events-api#events-JSON | Slack API}
     */
    slackPayload?: any;
    /**
     * The message payload received from our chat widget
     * 
     * @remarks
     * This object will only be included if the workflow includes a Widget Trigger
     */
    widgetPayload?: IWidget;
    /**
     * The message payload received from our chat application
     * 
     * @remarks
     * This object will only be include if the workflow includes a Chat Bot Trigger
     */
    chatbotPayload?: IWidget;
    /**
     * The emailID of the user who received an email
     * 
     * @remarks
     * This object will only be included if the workflow includes the Gmail Trigger
     */
    email?: string;
    /**
     * The new history ID received form the Gmail API
     * 
     * @remarks
     * This object will only be included if the workflow includes the Gmail Trigger
     */
    newHistoryId?: string;
    /**
     * The old history ID received form the Gmail API
     * 
     * @remarks
     * This object will only be included if the workflow includes the Gmail Trigger
     */
    oldHistoryId?: string;
};

// Node configuration interfaces
interface Icon {
    type?: "svg" | "png" | "jpg" | "jpeg";
    content?: string;
};

interface Port {
    name: string;
    type: string;
    desc: string;
};

interface Field {
    name: string;
    type: "Text" | "TextArea" | "Number" | "Slider" | "CheckBox" | "select" | "env" | "social";
    desc: string;
    value: any;
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
};

/**
 * Defines the structure for the node configuration
 */
export interface NodeConfig {
    title: string;
    category: string;
    type: string;
    icon: Icon;
    desc: string;
    credit: number;
    inputs: Port[];
    outputs: Port[];
    fields: Field[];
    difficulty: string;
    tags: string[];
}

/**
 * Defines the structure of the inputs for a node
 */
export interface Inputs {
    /**
     * Name of the node
     */
    name: string;
    /**
     * The value of the input
     */
    value: any;
}

/**
 * Defines the structure of the contents / fields for a node
 */
export interface Contents {
    /**
     * Name of the node
     */
    name: string;
    /**
     * The value of the input
     */
    value: any;
}

/**
 * The Base Node class.
 * All nodes must extend this class
 */
export default abstract class BaseNode {

    title: string;
    category: string;
    type: string;
    icon: Icon;
    desc: string;
    credit: number;
    inputs: Port[];
    outputs: Port[];
    fields: Field[];
    difficulty: string;
    tags: string[];

    /**
     * Initialize a node
     * @param {NodeConfig} configJSON configuration of the node
     */
    constructor(configJSON: NodeConfig) {
        this.title = configJSON.title;
        this.category = configJSON.category;
        this.type = configJSON.type;
        this.icon = configJSON.icon;
        this.desc = configJSON.desc;
        this.credit = configJSON.credit;
        this.inputs = configJSON.inputs;
        this.outputs = configJSON.outputs;

        this.tags = configJSON.tags;
        this.fields = configJSON.fields;
        this.difficulty = configJSON.difficulty;
    }

    /**
     * The main method that runs all nodes.
     * Need to be overidden.
     * @param {Inputs[]} inputs The inputs to the node
     * @param {Contents[]} contents The field data of the nodes
     * @param {IWebConsole} webconsole The console object for logging to the execution logs on the app
     * @param {IServerData} serverData contains useful information from the server
     *
     * @returns The result of the node execution
     */
    abstract run(
        inputs: Inputs[],
        contents: Contents[],
        webconsole: IWebConsole,
        serverData: IServerData,
    ): Promise<Record<string, any> | any | null>;

    /**
     * Get the config for a node
     * 
     * @returns The config for the node
     */
    getConfig(): NodeConfig {
        return {
            title: this.title,
            category: this.category,
            type: this.type,
            icon: this.icon,
            desc: this.desc,
            credit: this.credit,
            inputs: this.inputs,
            outputs: this.outputs,
            tags: this.tags,
            fields: this.fields,
            difficulty: this.difficulty,
        }
    }

    /**
     * Returns the current value of the credit being cost
     * @returns The current credit cost
     */
    getCredit(): number {
        return this.credit;
    }

    /**
     * Sets the credit cost for the node
     * @param {number} value The new credit cost
     */
    setCredit(value: number): void {
        if (typeof value === "number") {
            this.credit = value;
        }
    }

    /**
     * Estimates the credit usage of the node
     * 
     * Can be overriden to add custom logic
     * 
     * @param {Inputs[]} inputs The inputs to the node
     * @param {Contents[]} contents The contents of the node
     * @param {IServerData} serverData contains useful information from the server
     * 
     * @returns The estimated credit usage
     */
    estimateUsage(inputs: Inputs[], contents: Contents[], serverData: IServerData): number {
        return this.credit;
    }
}