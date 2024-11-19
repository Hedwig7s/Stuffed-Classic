import { Packet, BaseProtocol } from "networking/protocol/baseprotocol";
import { BinaryParser } from "utility/dataparser";
import type { Connection } from "networking/server";

export class Protocol7 extends BaseProtocol {
    public readonly version = 7;
    public readonly packets = {
        
    };
    public checkIdentifier(identifier: Uint8Array): boolean {
        return identifier[0] === 0x07;
    }
}