import type { BasePacketData, BasePacketOptions } from "networking/protocol/basepacket";
import {
    Packet,
    PacketIds,
    assertParserSize,
} from "networking/protocol/basepacket";
import { assertPacket, STRING_OPTIONS } from "networking/protocol/basepacket";
import {
    ParserBuilder,
    type BinaryParserType as BinaryParser,
} from "utility/dataparser";
import type { Connection } from "networking/server";
import Player from "entities/player";
import Vector3 from "datatypes/vector3";
import { BlockIds } from "data/blocks";
import type { ContextManager } from "contextmanager";

const PROTOCOL_VERSION = 7;

export interface IdentificationPacketData extends BasePacketData {
    protocol: number;
    name: string;
    keyOrMotd: string;
    userType: number;
}

export class IdentificationPacket7 extends Packet<IdentificationPacketData> {
    public readonly name = "Identification";
    public readonly id = PacketIds.identification;
    public readonly size: number;
    public readonly parser: BinaryParser<IdentificationPacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<IdentificationPacketData>()
            .bigEndian()
            .uint8("id")
            .uint8("protocol")
            .string("name", STRING_OPTIONS)
            .string("keyOrMotd", STRING_OPTIONS)
            .uint8("userType")
            .build();
        this.size = assertParserSize(this.parser);
    }

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
    public readonly name = "Ping";
    public readonly id = PacketIds.ping;
    public readonly size: number;
    public readonly parser: BinaryParser<BasePacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<BasePacketData>()
            .bigEndian()
            .uint8("id")
            .build();
        this.size = assertParserSize(this.parser);
    }

    async receiver(connection: Connection, data: Uint8Array) {
        // Doesn't need to do anything
    }
}

export class LevelInitializePacket7 extends Packet<BasePacketData> {
    public readonly name = "LevelInitialize";
    public readonly id = PacketIds.levelInitialize;
    public readonly size: number;
    public readonly parser: BinaryParser<BasePacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<BasePacketData>()
            .bigEndian()
            .uint8("id")
            .build();
        this.size = assertParserSize(this.parser);
    }

    receiver = undefined;
}

export interface LevelDataChunkPacketData extends BasePacketData {
    chunkLength: number;
    chunkData: Uint8Array;
    percentComplete: number;
}

export class LevelDataChunkPacket7 extends Packet<LevelDataChunkPacketData> {
    public readonly name = "LevelDataChunk";
    public readonly id = PacketIds.levelDataChunk;
    public readonly size: number;
    public readonly parser: BinaryParser<LevelDataChunkPacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<LevelDataChunkPacketData>()
            .bigEndian()
            .uint8("id")
            .int16("chunkLength")
            .raw("chunkData", 1024)
            .uint8("percentComplete")
            .build();
        this.size = assertParserSize(this.parser);
    }

    receiver = undefined;
}

export interface LevelFinalizePacketData extends BasePacketData {
    worldSizeX: number;
    worldSizeY: number;
    worldSizeZ: number;
}

export class LevelFinalizePacket7 extends Packet<LevelFinalizePacketData> {
    public readonly name = "LevelFinalize";
    public readonly id = PacketIds.levelFinalize;
    public readonly size: number;
    public readonly parser: BinaryParser<LevelFinalizePacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<LevelFinalizePacketData>()
            .bigEndian()
            .uint8("id")
            .int16("worldSizeX")
            .int16("worldSizeY")
            .int16("worldSizeZ")
            .build();
        this.size = assertParserSize(this.parser);
    }

    receiver = undefined;
}

export interface SetBlockClientPacketData extends BasePacketData {
    x: number;
    y: number;
    z: number;
    mode: number;
    blockType: number;
}

export class SetBlockClientPacket7 extends Packet<SetBlockClientPacketData> {
    public readonly name = "SetBlockClient";
    public readonly id = PacketIds.setBlockClient;
    public readonly size: number;
    public readonly parser: BinaryParser<SetBlockClientPacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<SetBlockClientPacketData>()
            .bigEndian()
            .uint8("id")
            .int16("x")
            .int16("y")
            .int16("z")
            .uint8("mode")
            .uint8("blockType")
            .build();
        this.size = assertParserSize(this.parser);
    }
    sender = undefined;
    async receiver(connection: Connection, data: Uint8Array) {
        const parsed = this.parser.parse(data);
        const player = connection.player;
        if (!player) return;
        const world = player.world;
        if (!world) return;
        if (!BlockIds[parsed.blockType]) {
            connection.logger.warn(`Illegal block id: ${parsed.blockType}`);
            return;
        }
        world.setBlock(
            new Vector3(parsed.x, parsed.y, parsed.z),
            parsed.mode === 1 ? parsed.blockType : BlockIds.air
        );
    }
}

export interface SetBlockServerPacketData extends BasePacketData {
    x: number;
    y: number;
    z: number;
    blockType: number;
}

export class SetBlockServerPacket7 extends Packet<SetBlockServerPacketData> {
    public readonly name = "SetBlockClient";
    public readonly id = PacketIds.setBlockServer;
    public readonly size: number;
    public readonly parser: BinaryParser<SetBlockServerPacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<SetBlockServerPacketData>()
            .bigEndian()
            .uint8("id")
            .int16("x")
            .int16("y")
            .int16("z")
            .uint8("blockType")
            .build();
        this.size = assertParserSize(this.parser);
    }

    receiver = undefined;
}

export const Packets = {
    [PacketIds.identification]: IdentificationPacket7,
    [PacketIds.ping]: PingPacket7,
    [PacketIds.levelInitialize]: LevelInitializePacket7,
    [PacketIds.levelDataChunk]: LevelDataChunkPacket7,
    [PacketIds.levelFinalize]: LevelFinalizePacket7,
    [PacketIds.setBlockClient]: SetBlockClientPacket7,
    [PacketIds.setBlockServer]: SetBlockServerPacket7,
};
