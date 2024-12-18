import type { Connection } from "networking/server";
import { Entity } from "./entity";
import type { EntityOptions } from "./entity";
import EntityPosition from "datatypes/entityposition";
import type { World } from "data/worlds/world";
import { assertPacket, PacketIds } from "networking/packet/basepacket";
import { Broadcaster } from "networking/packet/broadcaster";
import type { SpawnPlayerPacketData } from "networking/packet/packetdata";
import { criterias, modifiers } from "networking/packet/broadcasterutil";

export interface PlayerOptions extends EntityOptions {
    connection?: Connection;
}

export class Player extends Entity {
    connection?: Connection;
    broadcasters: {
        [PacketIds.SpawnPlayer]: Broadcaster<SpawnPlayerPacketData>;
    };
    constructor(options: PlayerOptions) {
        super(options);
        const { register } = options;
        this.connection = options.connection;
        this.broadcasters = {
            [PacketIds.SpawnPlayer]: new Broadcaster<SpawnPlayerPacketData>({
                packetId: PacketIds.SpawnPlayer,
                context: this.context,
                criteria: criterias.sameWorld(this),
                modifier: modifiers.selfId<SpawnPlayerPacketData>(this),
            }),
        };
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
    spawn() {
        super.spawn();
        if (!this.world || this.worldEntityId === -1) {
            throw new Error("Player has no world");
        }
        const { x, y, z, yaw, pitch } = this.position;
        this.broadcasters[PacketIds.SpawnPlayer].broadcast({
            entityId: this.worldEntityId,
            name: this.fancyName,
            x,
            y,
            z,
            yaw,
            pitch,
        });
        if (!this.connection?.protocol) return;
        const spawnPacket = assertPacket(
            this.connection.protocol,
            PacketIds.SpawnPlayer
        );
        for (const player of this.world.entities.values()) {
            if (player === this) continue;

            if (!spawnPacket.sender) continue;
            if (!player.world) continue;
            if (player.worldEntityId === -1) continue;
            const { x, y, z, yaw, pitch } = player.position;
            spawnPacket
                .sender(this.connection, {
                    entityId: player.worldEntityId,
                    name: player.fancyName,
                    x,
                    y,
                    z,
                    yaw,
                    pitch,
                })
                .catch(this.connection.onError.bind(this.connection));
        }
    }
    move(position: EntityPosition) {
        super.move(position);
    }
    destroy() {
        super.destroy();
    }
}

export default Player;
