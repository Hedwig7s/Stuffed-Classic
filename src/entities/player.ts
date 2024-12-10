import type { Connection } from "networking/server";
import { Entity } from "./entity";
import type { EntityOptions } from "./entity";
import EntityPosition from "datatypes/entityposition";
import type { World } from "data/worlds/world";
import { assertPacket } from "networking/protocol/basepacket";

export interface PlayerOptions extends EntityOptions {
    fancyName: string;
    connection?: Connection;
}

export class Player extends Entity {
    fancyName: string;
    connection?: Connection;

    constructor(options: PlayerOptions) {
        super(options);
        const { fancyName, register } = options;
        this.fancyName = fancyName;
        this.connection = options.connection;
        if (register ?? true) {
            this.context.playerRegistry.register(this);
        }
    }
    async loadWorld(world: World) {
        if (!this.connection?.protocol) {
            throw new Error("Player has no connection");
        }
        const initializePacket = assertPacket(
            this.connection.protocol,
            "LevelInitialize"
        );
        const dataPacket = assertPacket(
            this.connection.protocol,
            "LevelDataChunk"
        );
        const finalizePacket = assertPacket(
            this.connection.protocol,
            "LevelFinalize"
        );
        if (
            !initializePacket.sender ||
            !dataPacket.sender ||
            !finalizePacket.sender
        ) {
            throw new Error("Packet sender not found");
        }
        await initializePacket
            .sender(this.connection, {})
            .catch(this.connection.onError.bind(this.connection));
        await world.pack(
            this.connection.protocol.version,
            (data, size, percent) => {
                dataPacket.sender!(this.connection!, {
                    // The ! is fine as the sender and connection are checked above
                    chunkLength: size,
                    chunkData: data,
                    percentComplete: percent,
                }).catch(this.connection!.onError.bind(this.connection!));
            }
        );
        await finalizePacket
            .sender(this.connection, {
                x: world.size.x,
                y: world.size.y,
                z: world.size.z,
            })
            .catch(this.connection.onError.bind(this.connection));
        super.loadWorld(world);
    }
    move(position: EntityPosition) {
        super.move(position);
    }
    destroy() {
        super.destroy();
    }
}

export default Player;
