import { Protocol, StringOptions, cleanParsedData } from 'networking/protocol/protocol';
import { Parser } from 'binary-parser';
import type Packet from 'networking/protocol/protocol';
import type { IConnection } from 'networking/types';
import { connect } from 'bun';

export class Protocol7 extends Protocol {
    protected packets = {
        [0x00]: {
            id: 0x00,
            name: "Identification",
            parser: new Parser()
                .endianness('big')
                .uint8('id')
                .uint8('protocol')
                .string('username', StringOptions)
                .string('verificationKey', StringOptions)
                .uint8('userType'),
            size: 1 + 1 + 64 + 64 + 1,
            receiver: (connection:IConnection, data:string|Uint8Array|Buffer) => {
                const buffer = data instanceof Buffer ? data : Buffer.from(data);
                const packet = this.getPacket(0x00);
                if (!packet) {
                    throw new Error('Packet not found');
                    return;
                }
                const parsed = cleanParsedData(packet.parser.parse(buffer));
                console.log(parsed);
            }
        }
    };

    constructor() {
        super();
    }
}
export default Protocol7;