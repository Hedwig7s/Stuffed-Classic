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

export function createBasicPacket<T extends PacketData>(
    obj: PartialPacketSize<T>
): Packet<T> {
    return {
        ...obj,
        size: obj.size ?? assertParserSize(obj.parser),
    } as Packet<T>;
}

export function createReceivablePacket<T extends PacketData>(
    obj: PartialReceivablePacket<T>
): ReceivablePacket<T> {
    return {
        ...createBasicPacket(obj),
        receive: obj.receive,
    };
}

async function basicSender<T extends PacketData>(
    this: SendablePacket<T>,
    connection: Connection,
    data: Omit<T, "id">
): Promise<void> {
    const newData = { ...data, id: this.id } as T;
    const encoded = this.parser.encode(newData);
    await connection.write(encoded);
}

export function createSendablePacket<T extends PacketData>(
    obj: PartialSendablePacket<T>
): SendablePacket<T> {
    const newObj = { ...createBasicPacket(obj) };
    newObj.send = obj.send ?? basicSender.bind(newObj as SendablePacket<any>);
    return newObj as SendablePacket<T>;
}

export function createBidirectionalPacket<T extends PacketData>(
    obj: PartialReceivablePacket<T> & PartialSendablePacket<T>
): BidirectionalPacket<T> {
    return {
        ...createReceivablePacket(obj),
        ...createSendablePacket(obj),
    } as BidirectionalPacket<T>;
}
