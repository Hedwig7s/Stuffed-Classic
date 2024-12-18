import type { ContextManager } from "contextmanager";
import {
    type Packet,
    type BasePacketOptions,
    PacketIds,
} from "networking/protocol/basepacket";
import type {
    IdentificationPacketData,
    LevelDataChunkPacketData,
    LevelFinalizePacketData,
    LevelInitializePacketData,
    PingPacketData,
    SetBlockClientPacketData,
    SetBlockServerPacketData,
    SpawnPlayerPacketData,
} from "./packetdata";

export function parsePackets(
    packets: Record<PacketIds, new (options: BasePacketOptions) => Packet<any>>,
    context: ContextManager
) {
    return Object.fromEntries(
        Object.entries(packets).map(([id, packet]) => [
            id,
            new packet({ context }),
        ])
    ) as Record<PacketIds, Packet<any>>;
}

export abstract class BaseProtocol {
    public abstract readonly version: number;
    public abstract packets: Partial<{
        [PacketIds.Identification]: Packet<IdentificationPacketData>;
        [PacketIds.Ping]: Packet<PingPacketData>;
        [PacketIds.LevelInitialize]: Packet<LevelInitializePacketData>;
        [PacketIds.LevelDataChunk]: Packet<LevelDataChunkPacketData>;
        [PacketIds.LevelFinalize]: Packet<LevelFinalizePacketData>;
        [PacketIds.SetBlockClient]: Packet<SetBlockClientPacketData>;
        [PacketIds.SetBlockServer]: Packet<SetBlockServerPacketData>;
        [PacketIds.SpawnPlayer]: Packet<SpawnPlayerPacketData>;
    }>;
    constructor(public readonly context: ContextManager) {}
    public abstract checkIdentifier(identifier: Uint8Array): boolean;
}
export default BaseProtocol;
