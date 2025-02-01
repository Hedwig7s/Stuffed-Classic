/*
    Wrapper around a message to format it and verify it for sending through chat
*/

export class ChatMessage {
    public message: string;
    public overflowPrefix: string;
    public maxMessageLength: number;
    public constructor(
        message: string,
        overflowPrefix = "> ",
        maxMessageLength = 64
    ) {
        this.message = message;
        this.overflowPrefix = overflowPrefix;
        this.maxMessageLength = maxMessageLength;
    }

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
