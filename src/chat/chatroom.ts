/*
    Chatroom class for managing sending chat messages to all members of a chatroom
*/

import { ChatMessage } from "chat/message";
import { Broadcaster } from "networking/packet/broadcaster";
import { PacketIds } from "networking/packet/packet";
import type { ChatMessagePacketData } from "networking/packet/packetdata";
import { Connection } from "networking/connection";
import type pino from "pino";
import { DestroySubscriptionManager } from "utility/destroysubscriptionmanager";
import { getSimpleLogger } from "utility/logger";

/**
 * A chatroom for managing sending chat messages to all members of a chatroom
 */
export class Chatroom {
    public name: string;
    public messages: ChatMessage[];
    public readonly members = new Map<number, Connection>();
    protected readonly destroySubscriptions =
        new DestroySubscriptionManager<number>("close");
    public readonly logger: pino.Logger;
    /** 
     * Create a new chatroom
     * @param name The name of the chatroom. Mainly used for logging
     */
    public constructor(name: string) {
        this.name = name;
        this.messages = [];
        this.logger = getSimpleLogger(`Chatroom ${name}`);
    }
    /**
     * Send a message to all members of the chatroom
     * @param message The message to send
     */
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
    /**
     * Add a member to the chatroom
     * @param connection The connection to add
     */
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
    /**
     * Remove a member from the chatroom
     * @param id The id of the connection to remove
     */
    public removeMember(id: number | Connection) {
        if (id instanceof Connection) id = id.id;
        const connection = this.members.get(id);
        if (!connection) return;
        this.members.delete(id);
        this.destroySubscriptions.unsubscribe(id, connection.emitter);
    }
}
