import type { Connection } from "networking/server";
import type {
    BinaryParserType as BinaryParser,
    StringOptions,
} from "utility/dataparser";
import type BaseProtocol from "networking/protocol/baseprotocol";
import type { ContextManager } from "contextmanager";
import type { BasePacketData } from "networking/protocol/packetdata";

export const STRING_OPTIONS: StringOptions = {
    encoding: "ascii",
    length: 64,
    type: "fixed",
};

export interface BasePacketOptions {
    context: ContextManager;
}

export abstract class Packet<T extends object> {
    public abstract readonly name: string;
    public abstract readonly id: number;
    public abstract readonly parser: BinaryParser<T>;
    public abstract readonly size: number;
    public readonly context: ContextManager;
    constructor({ context }: BasePacketOptions) {
        this.context = context;
    }
    async sender?(connection: Connection, data: Omit<T, "id">) {
        const newData = {
            id: this.id,
            ...data,
        } as T;
        const parsed = this.parser.encode(newData as T);
        connection.write(parsed).catch(connection.onError.bind(connection));
    }
    abstract receiver?(connection: Connection, data: Uint8Array): Promise<void>;
}
export enum PacketIds {
    identification = 0x00,
    ping = 0x01,
    levelInitialize = 0x02,
    levelDataChunk = 0x03,
    levelFinalize = 0x04,
    setBlockClient = 0x05,
    setBlockServer = 0x06,
}

export function assertPacket<T extends BasePacketData>(
    protocol: BaseProtocol | undefined,
    name: string
): Packet<T> {
    if (protocol == null) {
        throw new Error("Protocol not assigned");
    }
    const packet = protocol.getPacket(name);
    if (packet == null) {
        throw new Error(`Packet ${name} not found`);
    }
    return packet as unknown as Packet<T>;
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
