import { BaseProtocol, parsePackets } from "networking/protocol/protocol";
import { PACKETS } from "./packets";
import {
    Packet,
    PacketIds,
    type BasePacketOptions,
} from "networking/packet/packet";
import type { ContextManager } from "contextmanager";

export class Protocol7 extends BaseProtocol {
    public readonly version = 7;
    public readonly packets;
    public checkIdentifier(identifier: Uint8Array): boolean {
        return identifier[1] === this.version;
    }
    constructor(context: ContextManager) {
        super(context);
        this.packets = parsePackets(
            PACKETS as Record<
                PacketIds,
                new (options: BasePacketOptions) => Packet<any>
            >,
            context
        );
    }
}
