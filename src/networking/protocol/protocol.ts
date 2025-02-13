/*
    Structure for a protocol
*/
import {
    PacketIds,
    type BidirectionalPacket,
    type SendablePacket,
    type ReceivablePacket,
} from "networking/packet/packet";
import type {
    ChatMessagePacketData,
    DespawnPlayerPacketData,
    DisconnectPlayerPacketData,
    IdentificationPacketData,
    LevelDataChunkPacketData,
    LevelFinalizePacketData,
    LevelInitializePacketData,
    OrientationUpdatePacketData,
    PingPacketData,
    PositionAndOrientationPacketData,
    PositionAndOrientationUpdatePacketData,
    PositionUpdatePacketData,
    SetBlockClientPacketData,
    SetBlockServerPacketData,
    SpawnPlayerPacketData,
    UpdateUserTypePacketData,
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
        [PacketIds.PositionAndOrientationUpdate]: SendablePacket<PositionAndOrientationUpdatePacketData>;
        [PacketIds.PositionUpdate]: SendablePacket<PositionUpdatePacketData>;
        [PacketIds.OrientationUpdate]: SendablePacket<OrientationUpdatePacketData>;
        [PacketIds.DespawnPlayer]: SendablePacket<DespawnPlayerPacketData>;
        [PacketIds.ChatMessage]: BidirectionalPacket<ChatMessagePacketData>;
        [PacketIds.DisconnectPlayer]: SendablePacket<DisconnectPlayerPacketData>;
        [PacketIds.UpdateUserType]: SendablePacket<UpdateUserTypePacketData>;
    };
    /**
     * Check if the identifier is valid for this protocol
     * @param identifier The identifier to check
     * @returns True if the identifier is valid
     */
    checkIdentifier(identifier: Uint8Array): boolean;
}
