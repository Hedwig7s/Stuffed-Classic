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
}

export class Player {
    public readonly connection?: Connection;
    public readonly name: string;
    public fancyName: string;
    public entity?: PlayerEntity;
    public logger: pino.Logger;
    public get protocol() {
        return this.connection?.protocol;
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
    }
    constructor(options: PlayerOptions) {
        this.connection = options.connection;
        this.name = options.name;
        this.fancyName = options.fancyName || this.name;
        if (options.hasEntity ?? true) {
            this.entity = new PlayerEntity({
                player: this,
                name: this.name,
                fancyName: this.fancyName,
            });
        }
        this.logger = getSimpleLogger(`Player ${this.name}`);
    }
}

export default Player;
