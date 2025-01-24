import {
    FIXED_BYTE_OPTIONS,
    FIXED_SHORT_OPTIONS as FIXED_SHORT_OPTIONS,
    PacketIds,
} from "networking/packet/packet";
import {
    createReceivablePacket,
    createSendablePacket,
    createBidirectionalPacket,
} from "networking/packet/factories";
import { STRING_OPTIONS } from "networking/packet/packet";
import { assertPacket } from "networking/packet/utilities";
import { StructuredParserBuilder as StructParserBuilder } from "utility/datastruct";
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
    type PositionAndOrientationUpdatePacketData,
    type PositionUpdatePacketData,
    type OrientationUpdatePacketData,
    type DespawnPlayerPacketData,
    type ChatMessagePacketData,
    type DisconnectPlayerPacketData,
    type UpdateUserTypePacketData,
} from "networking/packet/packetdata";
import EntityPosition from "datatypes/entityposition";
import { sanitizeNetworkString } from "utility/sanitizenetworkstring";
import { MD5 } from "bun";

const PROTOCOL_VERSION = 7;

export const identificationPacket7 =
    createBidirectionalPacket<IdentificationPacketData>({
        name: "Identification",
        id: PacketIds.Identification,
        parser: new StructParserBuilder<IdentificationPacketData>()
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
            const playerName = sanitizeNetworkString(decoded.name);
            const playerRegistry =
                connection.serviceRegistry.get("playerRegistry");
            const heartbeat = connection.serviceRegistry.get("heartbeat");
            const serverConfig =
                connection.serviceRegistry.get("config")?.server;
            const isNameVerificationEnabled =
                serverConfig?.data.server.verifyNames;
            const isLocalConnection = ["localhost", "127.0.0.1"].includes(
                connection.socket.remoteAddress
            ) || connection.socket.remoteAddress.startsWith("192.168.");
            const isUnverifiedLocalNamesAllowed =
                serverConfig?.data.server.allowUnverifiedLocalNames;
            const isNameVerified =
                (heartbeat?.salt &&
                    sanitizeNetworkString(decoded.keyOrMotd).toLowerCase() ===
                        new Bun.CryptoHasher("md5")
                            .update(heartbeat.salt + playerName)
                            .digest("hex")
                            .toLowerCase()) ||
                !heartbeat?.salt;

            if (
                isNameVerificationEnabled &&
                heartbeat?.salt &&
                !isNameVerified
            ) {
                if (!isUnverifiedLocalNamesAllowed || !isLocalConnection) {
                    connection.disconnectWithReason("Unverified name");
                    return;
                }
            }
            if (playerRegistry && playerRegistry.has(playerName)) {
                connection.disconnectWithReason("Duplicate player name");
                return;
            }
            const player = new Player({
                name: playerName,
                fancyName: sanitizeNetworkString(playerName),
                connection: connection,
                defaultChatroom:
                    connection.serviceRegistry.get("globalChatroom"),
            });
            connection.player = player;

            if (playerRegistry) {
                playerRegistry.register(player);
            }
            if (!clientPacket.send) {
                throw new Error("Packet sender not found");
            }
            clientPacket.send(connection, {
                protocol: PROTOCOL_VERSION,
                name: "Stuffed Classic",
                keyOrMotd: "A stuffed classic server",
                userType: 0,
            });
            const worldManager = connection.serviceRegistry.get("worldManager");
            if (!worldManager?.defaultWorld) {
                throw new Error("Default world not set");
            }
            player.entity
                ?.spawn(worldManager.defaultWorld)
                .catch(connection.onError.bind(connection));
        },
    });

export const pingPacket7 = createBidirectionalPacket<PingPacketData>({
    name: "Ping",
    id: PacketIds.Ping,
    parser: new StructParserBuilder<PingPacketData>()
        .bigEndian()
        .uint8("id")
        .build(),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async receive(connection: Connection, data: Uint8Array) {
        // No action needed
    },
});

export const levelInitializePacket7 =
    createSendablePacket<LevelInitializePacketData>({
        name: "LevelInitialize",
        id: PacketIds.LevelInitialize,
        parser: new StructParserBuilder<LevelInitializePacketData>()
            .bigEndian()
            .uint8("id")
            .build(),
    });

export const levelDataChunkPacket7 =
    createSendablePacket<LevelDataChunkPacketData>({
        name: "LevelDataChunk",
        id: PacketIds.LevelDataChunk,
        parser: new StructParserBuilder<LevelDataChunkPacketData>()
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
        parser: new StructParserBuilder<LevelFinalizePacketData>()
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
        parser: new StructParserBuilder<SetBlockClientPacketData>()
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
        parser: new StructParserBuilder<SetBlockServerPacketData>()
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
    parser: new StructParserBuilder<SpawnPlayerPacketData>()
        .bigEndian()
        .uint8("id")
        .int8("entityId")
        .string("name", STRING_OPTIONS)
        .fixed("x", FIXED_SHORT_OPTIONS)
        .fixed("y", FIXED_SHORT_OPTIONS)
        .fixed("z", FIXED_SHORT_OPTIONS)
        .uint8("yaw")
        .uint8("pitch")
        .build(),
});

export const positionAndOrientationPacket7 = createBidirectionalPacket({
    name: "PositionAndOrientation",
    id: 0x08,
    parser: new StructParserBuilder<PositionAndOrientationPacketData>()
        .bigEndian()
        .uint8("id")
        .int8("entityId")
        .fixed("x", FIXED_SHORT_OPTIONS)
        .fixed("y", FIXED_SHORT_OPTIONS)
        .fixed("z", FIXED_SHORT_OPTIONS)
        .uint8("yaw")
        .uint8("pitch")
        .build(),
    async receive(connection: Connection, data: Uint8Array) {
        const decoded = this.parser.decode(data);
        const player = connection.player;
        if (!player) return;
        const { x, y, z, yaw, pitch } = decoded;
        const position = new EntityPosition(x, y, z, yaw, pitch);
        player.entity?.move(position, true, true);
    },
});

export const positionAndOrientationUpdatePacket7 = createSendablePacket({
    name: "PositionAndOrientationUpdate",
    id: PacketIds.PositionAndOrientationUpdate,
    parser: new StructParserBuilder<PositionAndOrientationUpdatePacketData>()
        .bigEndian()
        .uint8("id")
        .int8("entityId")
        .fixed("x", FIXED_BYTE_OPTIONS)
        .fixed("y", FIXED_BYTE_OPTIONS)
        .fixed("z", FIXED_BYTE_OPTIONS)
        .uint8("yaw")
        .uint8("pitch")
        .build(),
});

export const positionUpdatePacket7 = createSendablePacket({
    name: "PositionUpdate",
    id: PacketIds.PositionUpdate,
    parser: new StructParserBuilder<PositionUpdatePacketData>()
        .bigEndian()
        .uint8("id")
        .int8("entityId")
        .fixed("x", FIXED_BYTE_OPTIONS)
        .fixed("y", FIXED_BYTE_OPTIONS)
        .fixed("z", FIXED_BYTE_OPTIONS)
        .build(),
});

export const orientationUpdatePacket7 = createSendablePacket({
    name: "OrientationUpdate",
    id: PacketIds.OrientationUpdate,
    parser: new StructParserBuilder<OrientationUpdatePacketData>()
        .bigEndian()
        .uint8("id")
        .int8("entityId")
        .uint8("yaw")
        .uint8("pitch")
        .build(),
});

export const despawnPlayerPacket7 = createSendablePacket({
    name: "DespawnPlayer",
    id: PacketIds.DespawnPlayer,
    parser: new StructParserBuilder<DespawnPlayerPacketData>()
        .bigEndian()
        .uint8("id")
        .int8("entityId")
        .build(),
});

export const chatMessagePacket7 = createBidirectionalPacket({
    name: "ChatMessage",
    id: PacketIds.ChatMessage,
    parser: new StructParserBuilder<ChatMessagePacketData>()
        .bigEndian()
        .uint8("id")
        .int8("entityId")
        .string("message", STRING_OPTIONS)
        .build(),
    async receive(connection: Connection, data: Uint8Array) {
        const decoded = this.parser.decode(data);
        connection.player?.chat(sanitizeNetworkString(decoded.message));
    },
});

export const disconnectPlayerPacket7 = createSendablePacket({
    name: "DisconnectPlayer",
    id: 0x0e,
    parser: new StructParserBuilder<DisconnectPlayerPacketData>()
        .bigEndian()
        .uint8("id")
        .string("reason", STRING_OPTIONS)
        .build(),
});

export const updateUserTypePacket7 = createSendablePacket({
    name: "UpdateUserType",
    id: 0x0f,
    parser: new StructParserBuilder<UpdateUserTypePacketData>()
        .bigEndian()
        .uint8("id")
        .uint8("userType")
        .build(),
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
    [PacketIds.PositionAndOrientationUpdate]:
        positionAndOrientationUpdatePacket7,
    [PacketIds.PositionUpdate]: positionUpdatePacket7,
    [PacketIds.OrientationUpdate]: orientationUpdatePacket7,
    [PacketIds.DespawnPlayer]: despawnPlayerPacket7,
    [PacketIds.ChatMessage]: chatMessagePacket7,
    [PacketIds.DisconnectPlayer]: disconnectPlayerPacket7,
    [PacketIds.UpdateUserType]: updateUserTypePacket7,
};

export default PACKETS;
