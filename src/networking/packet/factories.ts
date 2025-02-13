import type {
    BidirectionalPacket,
    Packet,
    ReceivablePacket,
    SendablePacket,
} from "networking/packet/packet";
import { assertParserSize } from "networking/packet/utilities";
import type { PacketData } from "networking/packet/packetdata";
import type { Connection } from "networking/connection";

type PartialPacketSize<T extends PacketData> = Omit<Packet<T>, "size"> &
    Partial<Pick<Packet<T>, "size">>;

type PartialSendablePacket<T extends PacketData> = Omit<
    SendablePacket<T>,
    "size" | "send"
> &
    Partial<Pick<SendablePacket<T>, "size" | "send">>;

type PartialReceivablePacket<T extends PacketData> = Omit<
    ReceivablePacket<T>,
    "size"
> &
    Partial<Pick<ReceivablePacket<T>, "size">>;

/**
 * Create a basic packet without a sender or receiver with the given data
 * @param obj The data for the packet
 * @template T The type of the packet data
 */
export function createBasicPacket<T extends PacketData>(
    obj: PartialPacketSize<T>
): Packet<T> {
    return {
        ...obj,
        size: obj.size ?? assertParserSize(obj.parser),
    } as Packet<T>;
}

/**
 * Create a receivable packet with the given data
 * @param obj The data for the packet
 * @template T The type of the packet data
 */
export function createReceivablePacket<T extends PacketData>(
    obj: PartialReceivablePacket<T>
): ReceivablePacket<T> {
    return {
        ...createBasicPacket(obj),
        receive: obj.receive,
    };
}

/**
 * Basic sender for packets
 * @param this The packet to send
 * @param connection The connection to send the packet to
 * @param data The data to send
 * @template T The type of the packet data
 */
async function basicSender<T extends PacketData>(
    this: SendablePacket<T>,
    connection: Connection,
    data: Omit<T, "id">
): Promise<void> {
    const newData = { ...data, id: this.id } as T;
    const encoded = this.parser.encode(newData);
    await connection.write(encoded);
}

/**
 * Create a sendable packet with the given data
 * @param obj The data for the packet
 * @template T The type of the packet data
 */
export function createSendablePacket<T extends PacketData>(
    obj: PartialSendablePacket<T>
): SendablePacket<T> {
    const newObj = { ...createBasicPacket(obj) };
    newObj.send = obj.send ?? basicSender.bind(newObj as SendablePacket<any>);
    return newObj as SendablePacket<T>;
}

/**
 * Create a bidirectional packet with the given data
 * @param obj The data for the packet
 * @template T The type of the packet data
 */
export function createBidirectionalPacket<T extends PacketData>(
    obj: PartialReceivablePacket<T> & PartialSendablePacket<T>
): BidirectionalPacket<T> {
    return {
        ...createReceivablePacket(obj),
        ...createSendablePacket(obj),
    } as BidirectionalPacket<T>;
}
