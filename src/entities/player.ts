import type { Connection } from "networking/server";
import { Entity } from "./entity";
import type { EntityOptions } from "./entity";
import EntityPosition from "datatypes/entityposition";
import type { World } from "data/worlds/world";
import { assertPacket, PacketIds } from "networking/protocol/basepacket";

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
            PacketIds.LevelInitialize
        );
        const dataPacket = assertPacket(
            this.connection.protocol,
            PacketIds.LevelDataChunk
        );
        const finalizePacket = assertPacket(
            this.connection.protocol,
            PacketIds.LevelFinalize
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
                // The ! is fine as the sender and connection are checked above
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                dataPacket.sender!(this.connection!, {
                    chunkLength: size,
                    chunkData: data,
                    percentComplete: percent,
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                }).catch(this.connection?.onError.bind(this.connection!));
            }
        );
        await finalizePacket
            .sender(this.connection, {
                worldSizeX: world.size.x,
                worldSizeY: world.size.y,
                worldSizeZ: world.size.z,
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
