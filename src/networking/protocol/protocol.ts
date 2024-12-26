import type { ContextManager } from "contextmanager";
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
    SetBlockClientPacketData,
    SetBlockServerPacketData,
    SpawnPlayerPacketData,
} from "../packet/packetdata";

export abstract class BaseProtocol {
    public abstract readonly version: number;
    public abstract packets: Partial<{
        [PacketIds.Identification]: BidirectionalPacket<IdentificationPacketData>;
        [PacketIds.Ping]: BidirectionalPacket<PingPacketData>;
        [PacketIds.LevelInitialize]: SendablePacket<LevelInitializePacketData>;
        [PacketIds.LevelDataChunk]: SendablePacket<LevelDataChunkPacketData>;
        [PacketIds.LevelFinalize]: SendablePacket<LevelFinalizePacketData>;
        [PacketIds.SetBlockClient]: ReceivablePacket<SetBlockClientPacketData>;
        [PacketIds.SetBlockServer]: SendablePacket<SetBlockServerPacketData>;
        [PacketIds.SpawnPlayer]: SendablePacket<SpawnPlayerPacketData>;
    }>;
    constructor(public readonly context: ContextManager) {}
    public abstract checkIdentifier(identifier: Uint8Array): boolean;
}
export default BaseProtocol;
