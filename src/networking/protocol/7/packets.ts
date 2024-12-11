import type { BasePacketData } from "networking/protocol/basepacket";
import { Packet, PacketIds } from "networking/protocol/basepacket";
import { assertPacket, STRING_OPTIONS } from "networking/protocol/basepacket";
import { ParserBuilder } from "utility/dataparser";
import type { Connection } from "networking/server";
import Player from "entities/player";

const PROTOCOL_VERSION = 7;

export interface IdentificationPacketData extends BasePacketData {
    protocol: number;
    name: string;
    keyOrMotd: string;
    userType: number;
}

export class IdentificationPacket7 extends Packet<IdentificationPacketData> {
    name = "Identification";
    id = PacketIds.Identification;
    size = 1 + 1 + 64 + 64 + 1;
    parser = new ParserBuilder<IdentificationPacketData>()
        .bigEndian()
        .uint8("id")
        .uint8("protocol")
        .string("name", STRING_OPTIONS)
        .string("keyOrMotd", STRING_OPTIONS)
        .uint8("userType")
        .build();
    async receiver(connection: Connection, data: Uint8Array) {
        const clientPacket = assertPacket<IdentificationPacketData>(
            connection.protocol,
            "Identification"
        );
        const parsed = this.parser.parse(data);
        const player = new Player({
            name: parsed.name,
            fancyName: parsed.name,
            register: true,
            context: connection.context,
            connection: connection,
        });
        connection.player = player;
        if (clientPacket.sender == null) {
            throw new Error("Packet sender not found");
        }
        clientPacket.sender(connection, {
            protocol: PROTOCOL_VERSION,
            name: "Stuffed Classic", // TODO: Use the config
            keyOrMotd: "A stuffed classic server", // TODO: Use the config
            userType: 0, // TODO: Roles
        });
        if (!connection.context.defaultWorld) {
            throw new Error("Default world not set");
        }
        player
            .loadWorld(connection.context.defaultWorld)
            .catch(connection.onError.bind(connection));
    }
}

export class PingPacket7 extends Packet<BasePacketData> {
    name = "Ping";
    id = PacketIds.Ping;
    size = 1;
    parser = new ParserBuilder<IdentificationPacketData>()
        .bigEndian()
        .uint8("id")
        .build();
    async receiver(connection: Connection, data: Uint8Array) {
        // Doesn't need to do anything
    }
}

export class LevelInitializePacket7 extends Packet<BasePacketData> {
    name = "LevelInitialize";
    id = PacketIds.LevelInitialize;
    size = 1;
    parser = new ParserBuilder<IdentificationPacketData>()
        .bigEndian()
        .uint8("id")
        .build();
    receiver = undefined;
}

export interface LevelDataChunkPacketData extends BasePacketData {
    chunkLength: number;
    chunkData: Uint8Array;
    percentComplete: number;
}

export class LevelDataChunkPacket7 extends Packet<LevelDataChunkPacketData> {
    name = "LevelDataChunk";
    id = PacketIds.LevelDataChunk;
    size = 1 + 2 + 1024 + 1;
    parser = new ParserBuilder<LevelDataChunkPacketData>()
        .bigEndian()
        .uint8("id")
        .int16("chunkLength")
        .raw("chunkData", 1024)
        .uint8("percentComplete")
        .build();
    receiver = undefined;
}

export interface LevelFinalizePacketData extends BasePacketData {
    x: number;
    y: number;
    z: number;
}

export class LevelFinalizePacket7 extends Packet<LevelFinalizePacketData> {
    name = "LevelFinalize";
    id = PacketIds.LevelFinalize;
    size = 1 + 2 + 2 + 2;
    parser = new ParserBuilder<LevelFinalizePacketData>()
        .bigEndian()
        .uint8("id")
        .int16("x")
        .int16("y")
        .int16("z")
        .build();
    receiver = undefined;
}

export const Packets = {
    [PacketIds.Identification]: IdentificationPacket7,
    [PacketIds.Ping]: PingPacket7,
    [PacketIds.LevelInitialize]: LevelInitializePacket7,
    [PacketIds.LevelDataChunk]: LevelDataChunkPacket7,
    [PacketIds.LevelFinalize]: LevelFinalizePacket7,
};
