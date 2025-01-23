import { ChatMessage } from "chat/message";
import { Broadcaster } from "networking/packet/broadcaster";
import { PacketIds } from "networking/packet/packet";
import type { ChatMessagePacketData } from "networking/packet/packetdata";
import { Connection } from "networking/server";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";

export class Chatroom {
    public name: string;
    public messages: ChatMessage[];
    public readonly members = new Map<number, WeakRef<Connection>>();
    public readonly logger: pino.Logger;
    public constructor(name: string) {
        this.name = name;
        this.messages = [];
        this.logger = getSimpleLogger(`Chatroom ${name}`);
    }
    public async sendMessage(message: ChatMessage) {
        this.messages.push(message);
        this.logger.info(`Message: ${message.message}`);
        const broadcaster = new Broadcaster<ChatMessagePacketData>({
            packetId: PacketIds.ChatMessage,
            connections: this.members,
        });
        for (const part of message.toParts()) {
            await broadcaster.broadcast({ entityId: 0, message: part });
        }
    }
    public addMember(connection: Connection | WeakRef<Connection>) {
        if (connection instanceof WeakRef) {
            const conn = connection.deref();
            if (!conn) throw new Error("Connection is dead");
            this.members.set(conn.id, connection);
            return;
        }
        this.members.set(connection.id, new WeakRef(connection));
    }

    public removeMember(id: number | Connection) {
        if (id instanceof Connection) id = id.id;
        this.members.delete(id);
    }
}
