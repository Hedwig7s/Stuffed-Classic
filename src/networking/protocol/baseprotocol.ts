import type { ContextManager } from "contextmanager";
import type {
    PacketIds,
    Packet,
    BasePacketOptions,
} from "networking/protocol/basepacket";

export function parsePackets(
    packets: Record<PacketIds, new (options: BasePacketOptions) => Packet<any>>,
    context: ContextManager
) {
    return Object.fromEntries(
        Object.entries(packets).map(([id, packet]) => [
            id,
            new packet({ context }),
        ])
    ) as Record<PacketIds, Packet<any>>;
}

export abstract class BaseProtocol {
    public abstract readonly version: number;
    public abstract packets: Record<PacketIds, Packet<any>>;
    constructor(public readonly context: ContextManager) {}
    protected nameCache = new Map<string, Packet<any>>();
    public getPacket(name: string | PacketIds): Packet<any> | undefined {
        if (typeof name === "string") {
            if (this.nameCache.has(name)) {
                return this.nameCache.get(name);
            }
            for (const packet of Object.values(this.packets)) {
                if (packet.name === name) {
                    this.nameCache.set(name, packet);
                    return packet;
                }
            }
        } else if (typeof name === "number") {
            return this.packets[name];
        }
        return;
    }
    public abstract checkIdentifier(identifier: Uint8Array): boolean;
}
export default BaseProtocol;
