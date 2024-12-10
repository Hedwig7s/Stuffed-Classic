import { BaseProtocol } from "networking/protocol/baseprotocol";
import { Packets } from "./packets";
import {
    Packet,
    PacketIds,
    type BasePacketData,
} from "networking/protocol/basepacket";
import type { ContextManager } from "contextmanager";

export class Protocol7 extends BaseProtocol {
    public readonly version = 7;
    public readonly packets = Object.fromEntries(
        Object.entries(Packets).map(([id, packet]) => [id, new packet()])
    ) as Record<PacketIds, Packet<any>>;
    public checkIdentifier(identifier: Uint8Array): boolean {
        return identifier[1] === this.version;
    }
}
