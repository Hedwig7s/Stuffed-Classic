import type { Connection } from "networking/server";
import type { BinaryParser, StringOptions } from "utility/dataparser";

export const STRING_OPTIONS:StringOptions = {
    encoding: "ascii",
    length: 64,
    type: "fixed"
};

export interface Packet<T extends object> { // For the optional properties
    sender?: (connection: Connection, data:T) => void;
    receiver?: (connection: Connection, data:Uint8Array) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export abstract class Packet<T extends object> {
    public abstract readonly name: string;
    public abstract readonly id: number;
    public abstract readonly receiverParser: BinaryParser<T>;
    public abstract readonly senderParser: BinaryParser<T>;
    public abstract readonly size: number;
}

export type PacketIds =
      0x00
/*    | 0x01
    | 0x02
    | 0x03
    | 0x04
    | 0x05
    | 0x06
    | 0x07
    | 0x08
    | 0x09
    | 0x0A
    | 0x0B
    | 0x0C
    | 0x0D
    | 0x0E
    | 0x0F
*/
export abstract class BaseProtocol {
    public abstract readonly version: number;
    public abstract readonly packets: Record<PacketIds, Packet<object>>;
    protected nameCache = new Map<string, Packet<object>>();
    public getPacket(name: string | PacketIds): Packet<object> | null {
        if (typeof name === 'string') {
            if (this.nameCache.has(name)) {
                return this.nameCache.get(name) ?? null;
            }
            for (const packet of Object.values(this.packets)) {
                if (packet.name === name) {
                    this.nameCache.set(name, packet);
                    return packet;
                }
            }
        } else if (typeof name === 'number') {
            return this.packets[name] ?? null;
        }
        return null;
    };
    public abstract checkIdentifier(identifier: Uint8Array): boolean;
}
export default BaseProtocol;