/*
    Format of packet data for each packet type.
*/

import type { PacketIds } from "networking/packet/packet";

export interface PacketData {
    id: number;
}

export interface IdentificationPacketData extends PacketData {
    /** Protocol version */
    protocol: number;
    /** If receiving, username. If sending, server name. */
    name: string;
    /** If receiving, verification key. If sending, MOTD. */
    keyOrMotd: string;
    /** If receiving, CPE support. If sending, whether or not the user is an operator */
    userType: number;
}

export type PingPacketData = PacketData;

export type LevelInitializePacketData = PacketData;

export interface LevelDataChunkPacketData extends PacketData {
    /** Length of chunk in bytes */
    chunkLength: number;
    /** Block of gzipped block data in xzy format with size 1024 bytes, padded with 0x00 if below */
    chunkData: Uint8Array;
    /** Percentage of block data sent */
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
    /** 1 is place 0 is destroy */
    mode: number;
    blockId: number;
}

export interface SetBlockServerPacketData extends PacketData {
    x: number;
    y: number;
    z: number;
    blockId: number;
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
