export interface BasePacketData {
    id: number;
}

export interface IdentificationPacketData extends BasePacketData {
    protocol: number;
    name: string;
    keyOrMotd: string;
    userType: number;
}

export type PingPacketData = BasePacketData;

export type LevelInitializePacketData = BasePacketData;

export interface LevelDataChunkPacketData extends BasePacketData {
    chunkLength: number;
    chunkData: Uint8Array;
    percentComplete: number;
}

export interface LevelFinalizePacketData extends BasePacketData {
    worldSizeX: number;
    worldSizeY: number;
    worldSizeZ: number;
}

export interface SetBlockClientPacketData extends BasePacketData {
    x: number;
    y: number;
    z: number;
    mode: number;
    blockType: number;
}

export interface SetBlockServerPacketData extends BasePacketData {
    x: number;
    y: number;
    z: number;
    blockType: number;
}
