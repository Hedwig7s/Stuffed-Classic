/**
 * Wrapper around a message to format it and verify it for sending through chat
 */
export class ChatMessage {
    public message: string;
    public overflowPrefix: string;
    public maxMessageLength: number;
    /**
     * Create a new ChatMessage
     * @param message The message to wrap
     * @param overflowPrefix The prefix to add to overflowed messages
     * @param maxMessageLength The maximum length of a message before it is split
     */
    public constructor(
        message: string,
        overflowPrefix = "> ",
        maxMessageLength = 64
    ) {
        this.message = message;
        this.overflowPrefix = overflowPrefix;
        this.maxMessageLength = maxMessageLength;
    }

    /**
     * Split the message into parts that are less than or equal to the max message length
     * Also sanitizes the message for the client
     * @returns The parts of the message
     */
    public toParts(): string[] {
        const cleanMessage = (message: string) => {
            message = message.replace(/&$/, "");
            return message;
        };
        if (this.message.length <= this.maxMessageLength) {
            return [cleanMessage(this.message)];
        }
        const parts: string[] = [];
        let color = "";
        let part: string[] = [];
        let length = 0;
        let colorAccountedFor = true;
        const pushPart = () => parts.push(cleanMessage(part.join("")));
        for (const char of this.message) {
            if (char === "&") {
                colorAccountedFor = false;
                color = char;
                continue;
            } else if (color === "&") {
                color += char;
                continue;
            }
            if (char === "\n") {
                pushPart();
                part = [color];
                colorAccountedFor = true;
                length = color.length;
                continue;
            }
            if (!colorAccountedFor && length + 3 <= this.maxMessageLength) {
                part.push(color);
                length += color.length;
                colorAccountedFor = true;
            }
            part.push(char);
            length++;
            if (length >= this.maxMessageLength) {
                pushPart();
                part = [this.overflowPrefix, color];
                colorAccountedFor = true;
                length = this.overflowPrefix.length + color.length;
                if (length > this.maxMessageLength)
                    throw new Error("Overflow prefix too long");
            }
        }
        parts.push(cleanMessage(part.join("")));
        return parts;
    }
    public toString(): string {
        return this.message;
    }
}

export default ChatMessage;
