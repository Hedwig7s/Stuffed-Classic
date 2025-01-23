import type { Chatroom } from "chat/chatroom";
import ChatMessage from "chat/message";
import PlayerEntity from "entities/playerentity";
import { PacketIds } from "networking/packet/packet";
import { assertPacket } from "networking/packet/utilities";
import type { Connection } from "networking/server";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";

export interface PlayerOptions {
    connection?: Connection;
    name: string;
    fancyName?: string;
    hasEntity?: boolean;
    defaultChatroom?: Chatroom;
}

export class Player {
    public readonly connection?: Connection;
    public readonly name: string;
    public fancyName: string;
    public entity?: PlayerEntity;
    public logger: pino.Logger;
    protected _defaultChatroom?: Chatroom;
    public get defaultChatroom() {
        return this._defaultChatroom;
    }
    public set defaultChatroom(chatroom: Chatroom | undefined) {
        if (this._defaultChatroom && this.connection) {
            this._defaultChatroom.removeMember(this.connection);
        }
        this._defaultChatroom = chatroom;
        if (chatroom && this.connection) {
            chatroom.addMember(this.connection);
        }
    }
    public get protocol() {
        return this.connection?.protocol;
    }
    public async replicateEntities() {
        if (!this.connection) return;
        const world = this.entity?.world;
        if (!this.entity || !world) {
            this.logger.warn("Player is not in a world");
            return;
        }
        for (const entity of world.entities.values()) {
            if (entity !== this.entity) {
                await entity.spawnFor(this.connection);
                if (
                    entity instanceof PlayerEntity &&
                    entity.player.connection
                ) {
                    await this.entity.spawnFor(entity.player.connection);
                }
            }
        }
        this.logger.trace("Other entities replicated");
    }
    public async spawnSelf() {
        if (!this.entity || !this.connection) return;
        const packet = this.protocol?.packets[PacketIds.SpawnPlayer];
        if (!packet || !packet.send) {
            this.logger.warn(
                "Could not find SpawnPlayer packet for player entity"
            );
            return;
        }
        const { x, y, z, yaw, pitch } = this.entity.position;
        await packet.send(this.connection, {
            entityId: -1,
            name: this.fancyName,
            x,
            y,
            z,
            yaw,
            pitch,
        });
        this.logger.trace("Player spawned");
    }
    public async loadWorld() {
        if (!this.connection || !this.connection.protocol) return;
        if (!this.entity?.world) {
            this.logger.warn("Player is not in a world");
            return;
        }
        const protocol = this.connection.protocol;
        const world = this.entity.world;
        const levelInitializePacket = assertPacket(
            protocol,
            PacketIds.LevelInitialize
        );
        const levelDataPacket = assertPacket(
            protocol,
            PacketIds.LevelDataChunk
        );
        const levelFinalizePacket = assertPacket(
            protocol,
            PacketIds.LevelFinalize
        );

        await levelInitializePacket
            .send(this.connection, {})
            .catch(this.connection.onError.bind(this.connection));

        await world.pack(protocol.version, (data, size, percent) => {
            levelDataPacket
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                .send(this.connection!, {
                    chunkData: data,
                    chunkLength: size,
                    percentComplete: percent,
                })
                .catch(this.connection?.onError.bind(this.connection));
        });

        await levelFinalizePacket
            .send(this.connection, {
                worldSizeX: world.size.x,
                worldSizeY: world.size.y,
                worldSizeZ: world.size.z,
            })
            .catch(this.connection.onError.bind(this.connection));
        this.logger.trace("World loaded");
    }
    public async spawn() {
        if (!this.entity?.world || !this.connection) return;
        await this.loadWorld();
        await this.replicateEntities();
        await this.spawnSelf();
        this.logger.trace("Player entity spawned");
    }
    public async chat(message: string | ChatMessage, chatroom?: Chatroom) {
        chatroom = chatroom ?? this.defaultChatroom;
        if (!chatroom) return;
        const formattedMessage = `&f${this.fancyName}&f: {message}`;
        if (message instanceof ChatMessage)
            message.message = formattedMessage.replace(
                "{message}",
                message.message
            );
        else
            message = new ChatMessage(
                formattedMessage.replace("{message}", message)
            );
        await chatroom.sendMessage(message);
    }
    public async sendMessage(message: ChatMessage) {
        if (!this.connection) return;
        const packet = this.protocol?.packets[PacketIds.ChatMessage];
        if (!packet || !packet.send) {
            this.logger.warn("Could not find ChatMessage packet");
            return;
        }
        for (const part of message.toParts()) {
            await packet.send(this.connection, { entityId: 0, message: part });
        }
        this.logger.info(`Sent message: ${message.message}`);
    }
    public cleanup() {
        if (this.entity) {
            this.entity.cleanup();
        }
    }
    constructor(options: PlayerOptions) {
        this.connection = options.connection;
        this.name = options.name;
        this.fancyName = options.fancyName || this.name;
        this.defaultChatroom = options.defaultChatroom;
        if (options.hasEntity ?? true) {
            this.entity = new PlayerEntity({
                player: this,
                name: this.name,
                fancyName: this.fancyName,
                server: this.connection?.serviceRegistry.get("server"),
            });
        }
        this.logger = getSimpleLogger(`Player ${this.name}`);
    }
}

export default Player;
