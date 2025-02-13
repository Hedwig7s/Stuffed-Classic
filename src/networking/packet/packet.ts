import type { Connection } from "networking/connection";
import type {
    StructuredDataParser as BinaryParser,
    FixedOptions,
    StringOptions,
} from "utility/datastruct";
import type { PacketData } from "networking/packet/packetdata";

/**
 * Default options for string fields in packets
 */
export const STRING_OPTIONS: StringOptions = {
    encoding: "ascii",
    length: 64,
    type: "fixed",
};

/**
 * Default options for fixed point short fields in packets
 */
export const FIXED_SHORT_OPTIONS: FixedOptions = {
    size: 2,
    point: 5,
    signed: true,
};

/**
 * Default options for fixed point byte fields in packets
 */
export const FIXED_BYTE_OPTIONS: FixedOptions = {
    size: 1,
    point: 5,
    signed: true,
};

/**
 * A packet that could be sent or received over the network
 */
export interface Packet<T extends object> {
    /** The name of the packet. Metadata */
    readonly name: string;
    /** The id prefixed to the packet when sent */
    readonly id: number;
    /** The parser for the packet data */
    readonly parser: BinaryParser<any>;
    /** The size of the packet in bytes */
    readonly size: number;
    /**
     * Send the packet to a connection
     * @param connection The connection to send the packet to
     * @param data The data to send
     * @returns A promise that resolves when the packet is sent
     */
    send?(connection: Connection, data: Omit<T, "id">): Promise<void>;
    /**
     * Receive the packet from a connection
     * @param connection The connection to receive the packet from
     * @param data The data to receive
     * @returns A promise that resolves when the packet is received
     */
    receive?(connection: Connection, data: Uint8Array): Promise<void>;
}

/**
 * A packet that can be received over the network
 */
export interface ReceivablePacket<T extends PacketData> extends Packet<T> {
    receive(connection: Connection, data: Uint8Array): Promise<void>;
}
/**
 * A packet that can be sent over the network
 */
export interface SendablePacket<T extends PacketData> extends Packet<T> {
    send(connection: Connection, data: Omit<T, "id">): Promise<void>;
}

/**
 * A packet that can be sent and received over the network
 */
export type BidirectionalPacket<T extends PacketData> = ReceivablePacket<T> &
    SendablePacket<T>;

/** All packet ids as seen in protocol 7 */
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
