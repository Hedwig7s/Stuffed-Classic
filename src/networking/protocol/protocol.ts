import type { Connection } from "networking/server";
import { Parser } from "utility/dataparser";
import type { StringOptions } from "utility/dataparser";
import type { Context } from "context";
export interface Packet {
    id: number;
    name:string;
    parser: Parser<any>;
    size: number;
    sender?: (connection: Connection, data:any) => void;
    receiver?: (connection: Connection, data:string|Uint8Array|Buffer) => void;
}
export const STRING_OPTIONS:StringOptions = {
    encoding: "ascii",
    length: 64,
    type: "fixed"
};

export function cleanParsedData(data: Record<string,any>): Record<string,any> {
    const newData: Record<string,any> = {};
    for (const i in data) {
        let value = data[i];
        if (typeof value === "string") {
            const str = value as string;
            value = str.replace(/ *$/, "");
        }
        newData[i] = value;
    }
    return newData;
}
export function assertPacket(protocol:Protocol,packetId:number): Packet {
    const packet = protocol.getPacket(packetId);
    if (!packet) {
        throw new Error('Packet not found');
    }
    return packet;
}
export function simpleEncoder(protocol:Protocol, data:any, packetId:number): Buffer {
    const packet = assertPacket(protocol, packetId);
    const encoded = packet.parser.encode(data);
    return Buffer.from(encoded);
}

export abstract class Protocol {
    protected packets: Record<number, Packet> = {};
    constructor(protected context: Context) {}

    public getPacket(id: number | string): Packet | null {
        if (typeof id === 'number') {
            return this.packets[id];
        }
        for (const i in this.packets) {
            if (this.packets[i].name === id) {
                return this.packets[i];
            }
        }
        return null;
    }
}
export default Protocol;