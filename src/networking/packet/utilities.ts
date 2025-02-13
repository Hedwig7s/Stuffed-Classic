/*
    Couple utility functions for packets
*/
import type { Protocol } from "networking/protocol/protocol";
import type { StructuredDataParser as BinaryParser } from "utility/datastruct";

/** Types of packets */
type PacketTypes = "Sendable" | "Receivable" | "Bidirectional" | "None";

/**
 * Asserts that a packet exists and is of the correct type
 * @param protocol The protocol to check against
 * @param id The id of the packet as defined in the the protocol interface
 * @param type The type of packet to check for
 * @returns The packet if it exists
 * @throws If the packet does not exist or is not of the correct type
 */
export function assertPacket<K extends keyof Protocol["packets"]>(
    protocol: Protocol | undefined,
    id: K,
    type: PacketTypes = "None"
) {
    if (protocol == null) {
        throw new Error("Protocol not assigned");
    }
    const packet = protocol.packets[id];
    if (packet == null) {
        throw new Error(`Packet ${id.toString()} not found`);
    }
    if (["Sendable", "Bidirectional"].includes(type) && packet.send == null) {
        throw new Error(`Packet ${id.toString()} is not sendable`);
    }
    if (["Receivable", "Bidirectional"].includes(type) && packet.receive == null) {
        throw new Error(`Packet ${id.toString()} is not receivable`);
    }

    return packet;
}

/**
 * Asserts that a parser exists and has a size
 * @param parser The parser to check
 * @returns The size of the parser
 * @throws If the parser does not exist or does not have a size
 */
export function assertParserSize(parser?: BinaryParser<any>): number {
    if (!parser) {
        throw new Error("No parser");
    }
    if (parser.size === undefined) {
        throw new Error("No parser size");
    }
    return parser.size;
}