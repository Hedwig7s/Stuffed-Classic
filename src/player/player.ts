/*
    Represents a player instance in the server meant to store information and instances related to the player
*/
import type { Chatroom } from "chat/chatroom";
import ChatMessage from "chat/message";
import PlayerEntity from "entities/playerentity";
import { PacketIds } from "networking/packet/packet";
import { assertPacket } from "networking/packet/utilities";
import type { Connection } from "networking/connection";
import type pino from "pino";
import type TypedEventEmitter from "typed-emitter";
import EventEmitter from "events";
import { getSimpleLogger } from "utility/logger";
import type { ServiceRegistry } from "utility/serviceregistry";
import type { ServiceMap } from "servercontext";
import ColorCodes from "chat/colorcodes";

export interface PlayerOptions {
    connection?: Connection;
    name: string;
    fancyName?: string;
    hasEntity?: boolean;
    defaultChatroom?: Chatroom;
    serviceRegistry?: ServiceRegistry<ServiceMap>;
    defaultInterceptors?: {
        chat?: boolean;
    };
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type PlayerEvents = {
    destroy: () => void;
};

export interface Interceptor<T extends (...args: any[]) => any> {
    func: T;
    priority: number;
}

export class Player {
    public readonly connection?: Connection;
    public readonly name: string;
    public readonly emitter =
        new EventEmitter() as TypedEventEmitter<PlayerEvents>;
    public fancyName: string;
    public entity?: PlayerEntity;
    public logger: pino.Logger;
    public destroyed = false;
    public serviceRegistry?: ServiceRegistry<ServiceMap>;
    public interceptors = {
        chat: {} as Record<
            string,
            Interceptor<
                (
                    player: Player,
                    message: string | ChatMessage
                ) => Promise<boolean>
            >
        >,
    };
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
        const interceptors = Object.values(this.interceptors.chat).sort(
            (a, b) => a.priority - b.priority
        );
        for (const interceptor of interceptors) {
            if (await interceptor.func(this, message)) return;
        }
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
    public async sendMessage(message: string | ChatMessage) {
        if (typeof message === "string") message = new ChatMessage(message);
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
    public disconnect(reason = "Disconnected", timeout = 1000) {
        this.connection?.disconnectWithReason(reason, timeout);
    }
    public destroy() {
        this.destroyed = true;
        this.emitter.emit("destroy");
        if (this.entity && !this.entity.destroyed) this.entity.destroy();
    }
    constructor(options: PlayerOptions) {
        this.connection = options.connection;
        this.name = options.name;
        this.fancyName = options.fancyName || this.name;
        this.defaultChatroom = options.defaultChatroom;
        this.serviceRegistry =
            options.serviceRegistry || this.connection?.serviceRegistry;
        if (options.hasEntity ?? true) {
            this.entity = new PlayerEntity({
                player: this,
                name: this.name,
                fancyName: this.fancyName,
                server: this.serviceRegistry?.get("server"),
            });
            this.serviceRegistry?.get("entityRegistry")?.register(this.entity);
            const destroyListener = () => {
                this.entity?.emitter.off("destroy", destroyListener);
                this.destroy();
            };
            this.entity.emitter.on("destroy", destroyListener);
        }
        this.logger = getSimpleLogger(`Player ${this.name}`);
        if (!options.defaultInterceptors || options.defaultInterceptors.chat) {
            this.interceptors.chat["commands"] = {
                priority: 0,
                func: async (player, message) => {
                    if (message instanceof ChatMessage)
                        message = message.message;
                    if (message.startsWith("/")) {
                        const commandRegistry =
                            this.serviceRegistry?.get("commandRegistry");
                        if (!commandRegistry) {
                            this.sendMessage(
                                `${ColorCodes.Red}Couldn't find commands!`
                            );
                            return false;
                        }
                        commandRegistry.handleMessage(this, message);
                        return true;
                    }
                    return false;
                },
            };
        }
    }
}

export default Player;
