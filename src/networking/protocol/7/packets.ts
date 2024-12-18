import type { BasePacketOptions } from "networking/protocol/basepacket";
import {
    FIXED_STRING_OPTIONS as FIXED_OPTIONS,
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
import type {
    IdentificationPacketData,
    LevelDataChunkPacketData,
    LevelFinalizePacketData,
    LevelInitializePacketData,
    PingPacketData,
    SetBlockClientPacketData,
    SetBlockServerPacketData,
    SpawnPlayerPacketData,
} from "networking/protocol/packetdata";

const PROTOCOL_VERSION = 7;

export class IdentificationPacket7 extends Packet<IdentificationPacketData> {
    public readonly name = "Identification";
    public readonly id = PacketIds.Identification;
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
        const clientPacket = assertPacket(
            connection.protocol,
            PacketIds.Identification
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

export class PingPacket7 extends Packet<PingPacketData> {
    public readonly name = "Ping";
    public readonly id = PacketIds.Ping;
    public readonly size: number;
    public readonly parser: BinaryParser<PingPacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<PingPacketData>()
            .bigEndian()
            .uint8("id")
            .build();
        this.size = assertParserSize(this.parser);
    }

    async receiver(connection: Connection, data: Uint8Array) {
        // Doesn't need to do anything
    }
}

export class LevelInitializePacket7 extends Packet<LevelInitializePacketData> {
    public readonly name = "LevelInitialize";
    public readonly id = PacketIds.LevelInitialize;
    public readonly size: number;
    public readonly parser: BinaryParser<LevelInitializePacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<LevelInitializePacketData>()
            .bigEndian()
            .uint8("id")
            .build();
        this.size = assertParserSize(this.parser);
    }

    receiver = undefined;
}

export class LevelDataChunkPacket7 extends Packet<LevelDataChunkPacketData> {
    public readonly name = "LevelDataChunk";
    public readonly id = PacketIds.LevelDataChunk;
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

export class LevelFinalizePacket7 extends Packet<LevelFinalizePacketData> {
    public readonly name = "LevelFinalize";
    public readonly id = PacketIds.LevelFinalize;
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

export class SetBlockClientPacket7 extends Packet<SetBlockClientPacketData> {
    public readonly name = "SetBlockClient";
    public readonly id = PacketIds.SetBlockClient;
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

export class SetBlockServerPacket7 extends Packet<SetBlockServerPacketData> {
    public readonly name = "SetBlockClient";
    public readonly id = PacketIds.SetBlockServer;
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

export class SpawnPlayer extends Packet<SpawnPlayerPacketData> {
    public readonly name = "SpawnPlayer";
    public readonly id = PacketIds.SpawnPlayer;
    public readonly size: number;
    public readonly parser: BinaryParser<SpawnPlayerPacketData>;

    constructor(options: BasePacketOptions) {
        super(options);
        this.parser = new ParserBuilder<SpawnPlayerPacketData>()
            .bigEndian()
            .uint8("id")
            .int8("entityId")
            .string("name", STRING_OPTIONS)
            .fixed("x", FIXED_OPTIONS)
            .fixed("y", FIXED_OPTIONS)
            .fixed("z", FIXED_OPTIONS)
            .fixed("yaw", FIXED_OPTIONS)
            .fixed("pitch", FIXED_OPTIONS)
            .build();
        this.size = assertParserSize(this.parser);
    }
    receiver = undefined;
}

export const PACKETS = {
    [PacketIds.Identification]: IdentificationPacket7,
    [PacketIds.Ping]: PingPacket7,
    [PacketIds.LevelInitialize]: LevelInitializePacket7,
    [PacketIds.LevelDataChunk]: LevelDataChunkPacket7,
    [PacketIds.LevelFinalize]: LevelFinalizePacket7,
    [PacketIds.SetBlockClient]: SetBlockClientPacket7,
    [PacketIds.SetBlockServer]: SetBlockServerPacket7,
};
