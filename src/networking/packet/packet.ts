import type { Connection } from "networking/server";
import type {
    BinaryParserType as BinaryParser,
    FixedOptions,
    StringOptions,
} from "utility/dataparser";
import type BaseProtocol from "networking/protocol/protocol";
import type { ContextManager } from "contextmanager";
import type { BasePacketData } from "networking/packet/packetdata";

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

export interface BasePacketOptions {
    context: ContextManager;
}

export abstract class Packet<T extends object> {
    public abstract readonly name: string;
    public abstract readonly id: number;
    public abstract readonly parser: BinaryParser<any>;
    public abstract readonly size: number;
    public readonly context: ContextManager;
    constructor({ context }: BasePacketOptions) {
        this.context = context;
    }
    async send?(connection: Connection, data: Omit<T, "id">) {
        const newData = {
            id: this.id,
            ...data,
        } as T;
        const parsed = this.parser.encode(newData);
        connection.write(parsed).catch(connection.onError.bind(connection));
    }
    abstract receive?(connection: Connection, data: Uint8Array): Promise<void>;
}

export interface ReceivablePacket<T extends BasePacketData> extends Packet<T> {
    receive(connection: Connection, data: Uint8Array): Promise<void>;
}
export interface SendablePacket<T extends BasePacketData> extends Packet<T> {
    send(connection: Connection, data: Omit<T, "id">): Promise<void>;
}

export enum PacketIds {
    Identification = 0x00,
    Ping = 0x01,
    LevelInitialize = 0x02,
    LevelDataChunk = 0x03,
    LevelFinalize = 0x04,
    SetBlockClient = 0x05,
    SetBlockServer = 0x06,
    SpawnPlayer = 0x07,
}

export function assertPacket<K extends keyof BaseProtocol["packets"]>(
    protocol: BaseProtocol | undefined,
    name: K
) {
    if (protocol == null) {
        throw new Error("Protocol not assigned");
    }
    const packet = protocol.packets[name];
    if (packet == null) {
        throw new Error(`Packet ${name} not found`);
    }
    return packet;
}

export function assertParserSize(parser?: BinaryParser<any>): number {
    if (!parser) {
        throw new Error("No parser");
    }
    if (parser.size === undefined) {
        throw new Error("No parser size");
    }
    return parser.size;
}
