import type { TCPSocketListener, Socket } from "bun";
import { ArrayBufferSink } from "bun";
import type { BaseProtocol, PacketIds } from "networking/protocol/baseprotocol";
import type { ContextManager } from "contextmanager";
import type { Player } from "entities/player";

function writeFromSink(sink: ArrayBufferSink, socket: Socket<any>) {
    const data = sink.flush() as Uint8Array;
    const wrote = socket.write(data);
    if (wrote < data.byteLength) {
        sink.write(data.subarray(wrote));
    }
}

export interface SocketData {
    connection: Connection;
    faucet: ArrayBufferSink; // In
    sink: ArrayBufferSink; // Out
}

export class Connection {
    closed = false;
    protocol?: BaseProtocol;
    player?: Player;
    dataQueue: Uint8Array[] = [];
    processing = false;
    constructor(public readonly socket: Socket<SocketData>, public readonly context: ContextManager) {}

    async write(data: string | ArrayBuffer | Bun.BufferSource) {
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
            const data = this.dataQueue.shift() ?? new Uint8Array();
            await this.processData(data);
        }

        this.processing = false;
    }

    async processData(data: Uint8Array) {
        if (this.closed || data.length === 0) return;

        try {
            const id = data[0];
            if (id === 0x00 && !this.protocol) {
                let protocolVersion = data[1];
                if (protocolVersion < 2 || protocolVersion > 7) {
                    protocolVersion = 1; // Protocol 1 has no version
                }
                this.protocol = this.context.protocols[protocolVersion];
                if (!this.protocol) {
                    throw new Error(`Protocol ${protocolVersion} not found`);
                }
            }

            if (!this.protocol) return;

            const packet = this.protocol.getPacket(id as PacketIds);
            if (!packet) {
                throw new Error(`Packet ${id} not found`);
            }
            if (!packet.receiver) {
                throw new Error(`Packet ${id} has no receiver`);
            }

            const size = packet.size;
            if (data.byteLength < size) {
                this.dataQueue.unshift(data);
                return;
            }

            await packet.receiver(this, data);

            if (data.byteLength > size) {
                this.queueData(data.subarray(size));
            }
        } catch (error) {
            console.error(error);
            this.stop();
        }
    }

    stop() {
        if (this.closed) {
            return;
        }
        try {
            this.socket.end();
            setTimeout(() => {
                if (this.socket.readyState !== 'closed') {
                    this.socket.terminate();
                }
            }, 1000);
        } catch {
            // Ignore errors (if the method fails there isn't much I can do)
        }
        this.closed = true;
    }
}
export class Server {
    server?: TCPSocketListener;
    constructor(public readonly context: ContextManager) {}
    public host?: string;
    public port?: number;
    start(host: string, port: number) {
        this.host = host;
        this.port = port;
        this.server = Bun.listen<SocketData>({
            hostname: this.host,
            port: this.port,
            socket: {
                data: (socket, data) => {
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
                        connection: new Connection(socket, this.context),
                        faucet: new ArrayBufferSink(),
                        sink: new ArrayBufferSink()
                    };
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