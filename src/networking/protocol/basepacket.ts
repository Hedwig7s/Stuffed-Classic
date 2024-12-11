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

export abstract class Packet<T extends BasePacketData> {
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
    Identification = 0x00,
    Ping = 0x01,
    LevelInitialize = 0x02,
    LevelDataChunk = 0x03,
    LevelFinalize = 0x04,
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
