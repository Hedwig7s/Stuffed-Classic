import type { TCPSocketListener, Socket } from "bun";
import { ArrayBufferSink } from "bun";
import type { IConnection, SocketData } from "./types";
import { Protocol } from "networking/protocol/protocol";
import { Protocol7 } from "networking/protocol/protocol7";
const Protocols: Record<number, Protocol> = {
    7: Protocol7.getInstance()
};
function writeFromSink(sink: ArrayBufferSink, socket: Socket<SocketData>) {
    const data = sink.flush() as Uint8Array;
    const wrote = socket.write(data);
    if (wrote < data.byteLength) {
        sink.write(data.subarray(wrote));
    }
}
class Connection implements IConnection {
    socket: Socket<SocketData>;
    closed: boolean;
    protocol?: Protocol;
    dataQueue: Uint8Array[];
    processing: boolean;
    constructor(socket: Socket<SocketData>) {
        this.socket = socket;
        this.closed = false;
        this.dataQueue = [];
        this.processing = false;
    }

    write(data: string | Bun.BufferSource) {
        if (this.closed) {
            throw new Error('Connection was closed');
        }
        this.socket.data.sink.write(data);
        writeFromSink(this.socket.data.sink, this.socket);
    }

    queueData(data: Uint8Array) {
        this.dataQueue.push(data);
        if (!this.processing) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.dataQueue.length > 0) {
            const data = this.dataQueue.shift()!;
            await this.processData(data);
        }

        this.processing = false;
    }

    async processData(data: Uint8Array) {
        if (this.closed) return;

        try {
            const id = data[0];
            if (id === 0x00 && !this.protocol) {
                let protocolVersion = data[1];
                if (protocolVersion < 2 || protocolVersion > 7) {
                    protocolVersion = 1; // Protocol 1 has no version
                }
                this.protocol = Protocols[protocolVersion];
                if (!this.protocol) {
                    throw new Error(`Protocol ${protocolVersion} not found`);
                }
            }

            if (!this.protocol) return;

            const packet = this.protocol.getPacket(id);
            if (!packet) {
                throw new Error(`Packet ${id} not found`);
            }
            if (!packet.receiver) {
                throw new Error(`Packet ${id} has no receiver`);
            }

            const size = packet.size;
            if (data.byteLength < size) {
                // If we don't have enough data, put it back in the queue
                this.dataQueue.unshift(data);
                return;
            }

            await packet.receiver(this, data);

            if (data.byteLength > size) {
                // If there's remaining data, queue it for processing
                this.queueData(data.subarray(size));
            }
        } catch (error) {
            console.error(error);
            this.stop();
        }
    }

    start() {
        if (this.closed) {
            throw new Error('Connection was closed');
        }
    }

    stop() {
        if (this.closed) {
            return;
        }
        try {
            this.socket.shutdown();
        } catch { }
        this.closed = true;
    }
}
export class Server {
    host: string;
    port: number;
    server?: TCPSocketListener;
    constructor(host: string, port: number) {
        this.host = host;
        this.port = port;
    }

    start() {
        this.server = Bun.listen<SocketData>({
            hostname: this.host,
            port: this.port,
            socket: {
                data: (socket, data) => {
                    console.log(`Received data: ${data}`);
                    if (socket.data.connection) {
                        socket.data.connection.queueData(new Uint8Array(data));
                    }
                },
                close: (socket) => {
                    console.log('Socket closed');
                    if (socket.data.connection) {
                        socket.data.connection.stop();
                    }
                },
                error: (socket, error) => {
                    console.log(`Socket error: ${error}`);
                },
                open: (socket) => {
                    console.log('Socket connected');
                    socket.data = {
                        connection: new Connection(socket),
                        faucet: new ArrayBufferSink(),
                        sink: new ArrayBufferSink()
                    };
                    socket.data.connection.start();
                    socket.data.faucet.start({ stream: true, highWaterMark: 1024 });
                    socket.data.sink.start({ stream: true, highWaterMark: 1024 });
                },
                drain: (socket) => {
                    console.log('Socket drained');
                    writeFromSink(socket.data.sink, socket);
                }
            }
        });
        console.log(`Server started at ${this.host}:${this.port}`);
    }

    stop() {
        this.server?.stop();
        console.log('Server stopped');
    }
}
export default Server;