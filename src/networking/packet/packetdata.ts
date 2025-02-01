/*
    Format of packet data for each packet type.
*/

import type { PacketIds } from "networking/packet/packet";

export interface PacketData {
    id: number;
}

export interface IdentificationPacketData extends PacketData {
    protocol: number;
    name: string;
    keyOrMotd: string;
    userType: number;
}

export type PingPacketData = PacketData;

export type LevelInitializePacketData = PacketData;

export interface LevelDataChunkPacketData extends PacketData {
    chunkLength: number;
    chunkData: Uint8Array;
    percentComplete: number;
}

export interface LevelFinalizePacketData extends PacketData {
    worldSizeX: number;
    worldSizeY: number;
    worldSizeZ: number;
}

export interface SetBlockClientPacketData extends PacketData {
    x: number;
    y: number;
    z: number;
    mode: number;
    blockType: number;
}

export interface SetBlockServerPacketData extends PacketData {
    x: number;
    y: number;
    z: number;
    blockType: number;
}

export interface SpawnPlayerPacketData extends PacketData {
    entityId: number;
    name: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
}

export interface PositionAndOrientationPacketData extends PacketData {
    entityId: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
}

export interface PositionAndOrientationUpdatePacketData extends PacketData {
    entityId: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
}

export interface PositionUpdatePacketData extends PacketData {
    entityId: number;
    x: number;
    y: number;
    z: number;
}

export interface OrientationUpdatePacketData extends PacketData {
    entityId: number;
    yaw: number;
    pitch: number;
}

export interface DespawnPlayerPacketData extends PacketData {
    entityId: number;
}

export interface ChatMessagePacketData extends PacketData {
    entityId: number;
    message: string;
}

export interface DisconnectPlayerPacketData extends PacketData {
    reason: string;
}

export interface UpdateUserTypePacketData extends PacketData {
    userType: number;
}

export interface IdToPacketDataMap {
    [PacketIds.Identification]: IdentificationPacketData;
    [PacketIds.Ping]: PingPacketData;
    [PacketIds.LevelInitialize]: LevelInitializePacketData;
    [PacketIds.LevelDataChunk]: LevelDataChunkPacketData;
    [PacketIds.LevelFinalize]: LevelFinalizePacketData;
    [PacketIds.SetBlockClient]: SetBlockClientPacketData;
    [PacketIds.SetBlockServer]: SetBlockServerPacketData;
    [PacketIds.SpawnPlayer]: SpawnPlayerPacketData;
    [PacketIds.PositionAndOrientation]: PositionAndOrientationPacketData;
    [PacketIds.PositionAndOrientationUpdate]: PositionAndOrientationUpdatePacketData;
    [PacketIds.PositionUpdate]: PositionUpdatePacketData;
    [PacketIds.OrientationUpdate]: OrientationUpdatePacketData;
    [PacketIds.DespawnPlayer]: DespawnPlayerPacketData;
    [PacketIds.ChatMessage]: ChatMessagePacketData;
    [PacketIds.DisconnectPlayer]: DisconnectPlayerPacketData;
    [PacketIds.UpdateUserType]: UpdateUserTypePacketData;
}
