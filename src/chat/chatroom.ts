import { ChatMessage } from "chat/message";
import { Broadcaster } from "networking/packet/broadcaster";
import { PacketIds } from "networking/packet/packet";
import type { ChatMessagePacketData } from "networking/packet/packetdata";
import { Connection } from "networking/server";
import type pino from "pino";
import { DestroySubscriptionManager } from "utility/destroysubscriptionmanager";
import { getSimpleLogger } from "utility/logger";

export class Chatroom {
    public name: string;
    public messages: ChatMessage[];
    public readonly members = new Map<number, Connection>();
    protected readonly destroySubscriptions =
        new DestroySubscriptionManager<number>("close");
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
    public addMember(connection: Connection) {
        this.members.set(connection.id, connection);
        this.destroySubscriptions.subscribe(
            connection.id,
            connection.emitter,
            () => {
                this.removeMember(connection);
            }
        );
    }

    public removeMember(id: number | Connection) {
        if (id instanceof Connection) id = id.id;
        const connection = this.members.get(id);
        if (!connection) return;
        this.members.delete(id);
        this.destroySubscriptions.unsubscribe(id, connection.emitter);
    }
}
