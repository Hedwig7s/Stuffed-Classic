import {
    FIXED_SHORT_OPTIONS as FIXED_SHORT_OPTIONS,
    PacketIds,
    type Packet,
} from "networking/packet/packet";
import {
    createReceivablePacket,
    createSendablePacket,
    createBidirectionalPacket,
} from "networking/packet/factories";
import { STRING_OPTIONS } from "networking/packet/packet";
import { assertPacket } from "networking/packet/utilities";
import { ParserBuilder } from "utility/dataparser";
import type { Connection } from "networking/server";
import Player from "player/player";
import Vector3 from "datatypes/vector3";
import { BlockIds } from "data/blocks";
import {
    type PositionAndOrientationPacketData,
    type IdentificationPacketData,
    type LevelDataChunkPacketData,
    type LevelFinalizePacketData,
    type LevelInitializePacketData,
    type PingPacketData,
    type SetBlockClientPacketData,
    type SetBlockServerPacketData,
    type SpawnPlayerPacketData,
} from "networking/packet/packetdata";
import EntityPosition from "datatypes/entityposition";

const PROTOCOL_VERSION = 7;

export const identificationPacket7 =
    createBidirectionalPacket<IdentificationPacketData>({
        name: "Identification",
        id: PacketIds.Identification,
        parser: new ParserBuilder<IdentificationPacketData>()
            .bigEndian()
            .uint8("id")
            .uint8("protocol")
            .string("name", STRING_OPTIONS)
            .string("keyOrMotd", STRING_OPTIONS)
            .uint8("userType")
            .build(),
        async receive(connection: Connection, data: Uint8Array) {
            const clientPacket = assertPacket(
                connection.protocol,
                PacketIds.Identification
            );
            const decoded = this.parser.decode(data);
            const player = new Player({
                name: decoded.name,
                fancyName: decoded.name,
                connection: connection,
            });
            connection.player = player;
            if (!clientPacket.send) {
                throw new Error("Packet sender not found");
            }
            clientPacket.send(connection, {
                protocol: PROTOCOL_VERSION,
                name: "Stuffed Classic",
                keyOrMotd: "A stuffed classic server",
                userType: 0,
            });
            if (!connection.worldManager.defaultWorld) {
                throw new Error("Default world not set");
            }
            player.entity
                ?.spawn(connection.worldManager.defaultWorld)
                .catch(connection.onError.bind(connection));
        },
    });

export const pingPacket7 = createBidirectionalPacket<PingPacketData>({
    name: "Ping",
    id: PacketIds.Ping,
    parser: new ParserBuilder<PingPacketData>().bigEndian().uint8("id").build(),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async receive(connection: Connection, data: Uint8Array) {
        // No action needed
    },
});

export const levelInitializePacket7 =
    createSendablePacket<LevelInitializePacketData>({
        name: "LevelInitialize",
        id: PacketIds.LevelInitialize,
        parser: new ParserBuilder<LevelInitializePacketData>()
            .bigEndian()
            .uint8("id")
            .build(),
    });

export const levelDataChunkPacket7 =
    createSendablePacket<LevelDataChunkPacketData>({
        name: "LevelDataChunk",
        id: PacketIds.LevelDataChunk,
        parser: new ParserBuilder<LevelDataChunkPacketData>()
            .bigEndian()
            .uint8("id")
            .int16("chunkLength")
            .raw("chunkData", 1024)
            .uint8("percentComplete")
            .build(),
    });

export const levelFinalizePacket7 =
    createSendablePacket<LevelFinalizePacketData>({
        name: "LevelFinalize",
        id: PacketIds.LevelFinalize,
        parser: new ParserBuilder<LevelFinalizePacketData>()
            .bigEndian()
            .uint8("id")
            .int16("worldSizeX")
            .int16("worldSizeY")
            .int16("worldSizeZ")
            .build(),
    });

export const setBlockClientPacket7 =
    createReceivablePacket<SetBlockClientPacketData>({
        name: "SetBlockClient",
        id: PacketIds.SetBlockClient,
        parser: new ParserBuilder<SetBlockClientPacketData>()
            .bigEndian()
            .uint8("id")
            .int16("x")
            .int16("y")
            .int16("z")
            .uint8("mode")
            .uint8("blockType")
            .build(),
        async receive(connection: Connection, data: Uint8Array) {
            const decoded = this.parser.decode(data);
            const player = connection.player;
            if (!player) return;
            const world = player.entity?.world;
            if (!world) return;
            if (!BlockIds[decoded.blockType]) {
                connection.logger.warn(
                    `Illegal block id: ${decoded.blockType}`
                );
                return;
            }
            world.setBlock(
                new Vector3(decoded.x, decoded.y, decoded.z),
                decoded.mode === 1 ? decoded.blockType : BlockIds.air
            );
        },
    });

export const setBlockServerPacket7 =
    createSendablePacket<SetBlockServerPacketData>({
        name: "SetBlockClient",
        id: PacketIds.SetBlockServer,
        parser: new ParserBuilder<SetBlockServerPacketData>()
            .bigEndian()
            .uint8("id")
            .int16("x")
            .int16("y")
            .int16("z")
            .uint8("blockType")
            .build(),
    });

export const spawnPlayerPacket7 = createSendablePacket<SpawnPlayerPacketData>({
    name: "SpawnPlayer",
    id: PacketIds.SpawnPlayer,
    parser: new ParserBuilder<SpawnPlayerPacketData>()
        .bigEndian()
        .uint8("id")
        .int8("entityId")
        .string("name", STRING_OPTIONS)
        .fixed("x", FIXED_SHORT_OPTIONS)
        .fixed("y", FIXED_SHORT_OPTIONS)
        .fixed("z", FIXED_SHORT_OPTIONS)
        .fixed("yaw", FIXED_SHORT_OPTIONS)
        .fixed("pitch", FIXED_SHORT_OPTIONS)
        .build(),
});

export const positionAndOrientationPacket7 = createBidirectionalPacket({
    name: "PositionAndOrientation",
    id: 0x08,
    parser: new ParserBuilder<PositionAndOrientationPacketData>()
        .bigEndian()
        .uint8("id")
        .int8("entityId")
        .fixed("x", FIXED_SHORT_OPTIONS)
        .fixed("y", FIXED_SHORT_OPTIONS)
        .fixed("z", FIXED_SHORT_OPTIONS)
        .fixed("yaw", FIXED_SHORT_OPTIONS)
        .fixed("pitch", FIXED_SHORT_OPTIONS)
        .build(),
    async receive(connection: Connection, data: Uint8Array) {
        const decoded = this.parser.decode(data);
        const player = connection.player;
        if (!player) return;
        const { x, y, z, yaw, pitch } = decoded;
        const position = new EntityPosition(x, y, z, yaw, pitch);
        player.entity?.move(position);
    },
});
export const PACKETS = {
    [PacketIds.Identification]: identificationPacket7,
    [PacketIds.Ping]: pingPacket7,
    [PacketIds.LevelInitialize]: levelInitializePacket7,
    [PacketIds.LevelDataChunk]: levelDataChunkPacket7,
    [PacketIds.LevelFinalize]: levelFinalizePacket7,
    [PacketIds.SetBlockClient]: setBlockClientPacket7,
    [PacketIds.SetBlockServer]: setBlockServerPacket7,
    [PacketIds.SpawnPlayer]: spawnPlayerPacket7,
    [PacketIds.PositionAndOrientation]: positionAndOrientationPacket7,
};
