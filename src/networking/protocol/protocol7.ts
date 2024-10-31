import { Protocol, STRING_OPTIONS, cleanParsedData, assertPacket, simpleEncoder } from 'networking/protocol/protocol';
import type { Packet } from 'networking/protocol/protocol';
import { Parser } from 'utility/dataparser';
import type { Connection } from 'networking/server';

interface Protocol7PacketData {
    identification: {
        id: number,
        protocol: number,
        username: string,
        verificationKey: string,
        userType: number
    }
}

export class Protocol7 extends Protocol {
    protected packets: Record<number, Packet> = {
        [0x00]: {
            id: 0x00,
            name: "Identification",
            parser: new Parser<Protocol7PacketData["identification"]>()
                .bigEndian()
                .uint8('id')
                .uint8('protocol')
                .string('username', STRING_OPTIONS)
                .string('verificationKey', STRING_OPTIONS)
                .uint8('userType'),
            size: 1 + 1 + 64 + 64 + 1,
            receiver: (connection:Connection, data:string|Uint8Array|Buffer) => {
                const buffer = data instanceof Buffer ? data : Buffer.from(data);
                const packet = assertPacket(this, 0x00);
                const parsed = cleanParsedData(packet.parser.parse(new Uint8Array(buffer)));
                console.log(parsed);
            },
            sender: (connection:Connection, data:Protocol7PacketData["identification"]) => {
                const encoded = simpleEncoder(this, data, 0x00);
                connection.write(encoded.buffer);
            }
        }
    };
}
export default Protocol7;