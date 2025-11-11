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
 * Response structure for S3 file upload operations
 */
export interface S3UploadResponse {
    success: boolean;
    fileURL?: string;
    message?: string;
}

/**
 * Response structure for S3 file URL retrieval operations
 */
export interface S3FileURLResponse {
    success: boolean;
    fileURL: string | null;
    message: string;
}

/**
 * Response structure for S3 file list operations
 */
export interface S3FileListResponse {
    success: boolean;
    files: Array<{
        fileName: string;
        fileKey: string;
        bucket: string;
    }>;
    message: string;
}

/**
 * Response structure for S3 file operations (delete, rename)
 */
export interface S3OperationResponse {
    success: boolean;
    message: string;
}

/**
 * Defines the structure of the s3Util in serverData
 */
export interface IS3Util {
    /**
     * Method to upload a file to S3
     * @param fileName The name of the file
     * @param body The file content (Buffer or ReadableStream)
     * @param contentType The MIME type of the file
     * @param doExpire Whether the file entry should have an expiration date (defaults to true, expires in 7 days)
     * @param bucket The name of the S3 bucket (defaults to "public_main")
     * @param userId Optional user ID to associate the file with a specific user
     * @returns Promise with upload result including success status, file URL, and message
     */
    addFile(
        fileName: string,
        body: ReadableStream,
        contentType: string,
        doExpire?: boolean,
        bucket?: string,
        userId?: string | null
    ): Promise<S3UploadResponse>;

    /**
     * Method to retrieve a file from S3
     * @param key The key of the file to retrieve
     * @param bucket The name of the S3 bucket (defaults to "public_main")
     * @returns The file content as a ReadableStream, or undefined if the file does not exist
     */
    getFile(key: string, bucket?: string): Promise<ReadableStream | undefined>;

    /**
     * Method to retrieve the URL of a file from S3
     * @param key The key of the file to retrieve
     * @param bucket The name of the S3 bucket (defaults to "public_main")
     * @param userId Optional user ID for private bucket access validation
     * @returns Promise with file URL response including success status, URL, and message
     */
    getFileURL(key: string, bucket?: string, userId?: string | null): Promise<S3FileURLResponse>;

    /**
     * Method to delete a file from S3 and its record from the database
     * @param key The key of the file to delete
     * @param bucket The name of the S3 bucket (defaults to "public_main")
     * @param userId Optional user ID for ownership validation
     * @returns Promise with operation result including success status and message
     */
    deleteFile(key: string, bucket?: string, userId?: string | null): Promise<S3OperationResponse>;

    /**
     * Method to retrieve a list of files uploaded by a specific user
     * @param userId The ID of the user
     * @returns Promise with list of files including fileName, fileKey, and bucket
     */
    getFileListByUser(userId: string): Promise<S3FileListResponse>;

    /**
     * Method to rename a file in S3 (updates the database record, not the S3 key)
     * @param oldKey The current key of the file
     * @param newFileName The new file name
     * @param bucket The name of the S3 bucket (defaults to "public_main")
     * @param userId Optional user ID for ownership validation
     * @returns Promise with operation result including success status and message
     */
    renameFile(
        oldKey: string,
        newFileName: string,
        bucket?: string,
        userId?: string | null
    ): Promise<S3OperationResponse>;
}

/**
 * Defines the structure of the API metadata
 */
export interface IAPIMetadata {
    ip: string;
    method: string;
    url: string;
    protocol: string;
    originalUrl: string;
    baseUrl: string;
    timestamp: number;
}

/**
 * Defines the structure of the API payload
 */
export interface IAPI {

    /**
     * Body of the API request
     */
    body: Record<string, any>;
    /**
     * Headers of the API request
     */
    headers: Record<string, any>;
    /**
     * Query parameters of the API request
     */
    query: Record<string, any>;
    /**
     * Metadata of the API request
     */
    metadata: IAPIMetadata;
}

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
    Message: string;
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
     * An utility object that allows you to perform operations on the server's S3 instance allowing you to store and manipulate files
     */
    s3Util: IS3Util;

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
    chatbotPayload?: IChatbot;
    /**
     * The API payload received from an API Trigger
     * 
     * @remarks
     * This object will only be included if the workflow includes an API Trigger
     */
    apiPayload?: IAPI;
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
    stats: Record<string, any>;

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

        this.stats = {};
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
     * Returns the stats of the node
     * @returns The stats of the node
     */
    getStats(): Record<string, any> {
        return this.stats;
    }

    /**
     * Sets the stats of the node
     * @param key The key of the stat
     * @param value The value of the stat
     */
    setStats(key: string, value: any): void {
        this.stats[key] = value;
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