import type { IConnection } from "networking/types"
import { Parser } from "binary-parser";
export interface Packet {
    id: number;
    name:string;
    parser: Parser.Next<any, any, any>;
    size: number;
    sender?: (connection: IConnection, data:{string:any}) => void;
    receiver?: (connection: IConnection, data:string|Uint8Array|Buffer) => void;
}
export const StringOptions:Parser.StringOptions = {
    encoding: "ascii",
    length: 64
}

export function cleanParsedData(data: Record<string,any>): Record<string,any> {
    for (let i in data) {
        if (typeof data[i] === "string") {
            let str = data[i] as string;
            data[i] = str.replace(/ *$/, "");
        }
    }
    return data;
}

export abstract class Protocol {
    protected packets: Record<number, Packet> = {};
    private static instances: Map<Function, Protocol> = new Map();

    static getInstance<T extends Protocol>(this: new () => T): T {
        if (!Protocol.instances.has(this)) {
            Protocol.instances.set(this, new this());
        }
        return Protocol.instances.get(this) as T;
    }

    protected constructor() {
        const cls = this.constructor as typeof Protocol;
        if (Protocol.instances.has(cls)) {
            throw new Error("Instance already created. Use getInstance() method.");
        }
        Protocol.instances.set(cls, this);
    }

    public getPacket(id: number): Packet | null;
    public getPacket(name: string): Packet | null;
    public getPacket(id: number | string): Packet | null {
        if (typeof id === 'number') {
            return this.packets[id];
        }
        for (let i in this.packets) {
            if (this.packets[i].name === id) {
                return this.packets[i];
            }
        }
        return null;
    }
}
export default Protocol;