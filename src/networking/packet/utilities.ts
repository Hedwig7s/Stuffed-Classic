import type Protocol from "networking/protocol/protocol";
import type { BinaryParserType as BinaryParser } from "utility/dataparser";

type PacketTypes = "Sendable" | "Receivable" | "Bidirectional" | "None";
export function assertPacket<K extends keyof Protocol["packets"]>(
    protocol: Protocol | undefined,
    name: K,
    type: PacketTypes = "None"
) {
    if (protocol == null) {
        throw new Error("Protocol not assigned");
    }
    const packet = protocol.packets[name];
    if (packet == null) {
        throw new Error(`Packet ${name} not found`);
    }
    if (type in ["Sendable", "Bidirectional"] && packet.send == null) {
        throw new Error(`Packet ${name} is not sendable`);
    }
    if (type in ["Receivable", "Bidirectional"] && packet.receive == null) {
        throw new Error(`Packet ${name} is not receivable`);
    }

    return packet;
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