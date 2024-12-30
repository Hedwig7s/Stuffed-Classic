import {
    PacketIds,
    type BidirectionalPacket,
    type SendablePacket,
    type ReceivablePacket,
} from "networking/packet/packet";
import type {
    IdentificationPacketData,
    LevelDataChunkPacketData,
    LevelFinalizePacketData,
    LevelInitializePacketData,
    PingPacketData,
    PositionAndOrientationPacketData,
    SetBlockClientPacketData,
    SetBlockServerPacketData,
    SpawnPlayerPacketData,
} from "networking/packet/packetdata";

export interface Protocol {
    readonly version: number;
    readonly packets: {
        [PacketIds.Identification]: BidirectionalPacket<IdentificationPacketData>;
        [PacketIds.Ping]: BidirectionalPacket<PingPacketData>;
        [PacketIds.LevelInitialize]: SendablePacket<LevelInitializePacketData>;
        [PacketIds.LevelDataChunk]: SendablePacket<LevelDataChunkPacketData>;
        [PacketIds.LevelFinalize]: SendablePacket<LevelFinalizePacketData>;
        [PacketIds.SetBlockClient]: ReceivablePacket<SetBlockClientPacketData>;
        [PacketIds.SetBlockServer]: SendablePacket<SetBlockServerPacketData>;
        [PacketIds.SpawnPlayer]: SendablePacket<SpawnPlayerPacketData>;
        [PacketIds.PositionAndOrientation]: BidirectionalPacket<PositionAndOrientationPacketData>;
    };

    checkIdentifier(identifier: Uint8Array): boolean;
}
