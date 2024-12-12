import type { Connection } from "networking/server";
import type {
    BinaryParserType as BinaryParser,
    StringOptions,
} from "utility/dataparser";
import type BaseProtocol from "networking/protocol/baseprotocol";

export const STRING_OPTIONS: StringOptions = {
    encoding: "ascii",
    length: 64,
    type: "fixed",
};

export interface BasePacketData {
    id: number;
}

export abstract class Packet<T extends object> {
    abstract name: string;
    abstract id: number;
    abstract parser: BinaryParser<T>;
    abstract size: number;
    async sender?(connection: Connection, data: Omit<T, "id">) {
        const newData = {
            id: this.id,
            ...data,
        };
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
