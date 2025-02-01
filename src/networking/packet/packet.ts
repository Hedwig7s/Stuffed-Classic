import type { Connection } from "networking/connection";
import type {
    IStructuredDataParser as BinaryParser,
    FixedOptions,
    StringOptions,
} from "utility/datastruct";
import type { PacketData } from "networking/packet/packetdata";

export const STRING_OPTIONS: StringOptions = {
    encoding: "ascii",
    length: 64,
    type: "fixed",
};

export const FIXED_SHORT_OPTIONS: FixedOptions = {
    size: 2,
    point: 5,
    signed: true,
};

export const FIXED_BYTE_OPTIONS: FixedOptions = {
    size: 1,
    point: 5,
    signed: true,
};

export interface Packet<T extends object> {
    readonly name: string;
    readonly id: number;
    readonly parser: BinaryParser<T>;
    readonly size: number;
    send?(connection: Connection, data: Omit<T, "id">): Promise<void>;
    receive?(connection: Connection, data: Uint8Array): Promise<void>;
}

export interface ReceivablePacket<T extends PacketData> extends Packet<T> {
    receive(connection: Connection, data: Uint8Array): Promise<void>;
}
export interface SendablePacket<T extends PacketData> extends Packet<T> {
    send(connection: Connection, data: Omit<T, "id">): Promise<void>;
}

export type BidirectionalPacket<T extends PacketData> = ReceivablePacket<T> &
    SendablePacket<T>;

export enum PacketIds {
    Identification = 0x00,
    Ping = 0x01,
    LevelInitialize = 0x02,
    LevelDataChunk = 0x03,
    LevelFinalize = 0x04,
    SetBlockClient = 0x05,
    SetBlockServer = 0x06,
    SpawnPlayer = 0x07,
    PositionAndOrientation = 0x08,
    PositionAndOrientationUpdate = 0x09,
    PositionUpdate = 0x0a,
    OrientationUpdate = 0x0b,
    DespawnPlayer = 0x0c,
    ChatMessage = 0x0d,
    DisconnectPlayer = 0x0e,
    UpdateUserType = 0x0f,
}
