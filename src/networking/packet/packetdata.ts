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
