import type { TCPSocketListener, Socket } from "bun";
import { ArrayBufferSink } from "bun";
import type { BaseProtocol } from "networking/protocol/baseprotocol";
import type { PacketIds } from "networking/protocol/basepacket";
import type { ContextManager } from "contextmanager";
import type { Player } from "entities/player";

async function writeFromSink(sink: ArrayBufferSink, socket: Socket<any>) {
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
    processingIncoming = false;
    constructor(
        public readonly socket: Socket<SocketData>,
        public readonly context: ContextManager,
        public readonly id: number
    ) {
        setTimeout(()=> {
            if (!this.protocol && !this.closed) {
                console.warn("Handshake timeout");
                this.close();
            }
        }, 10000);
    }
    onError(error: Error) {
        console.error(error);
        this.close();
    }
    async write(data: string | ArrayBuffer | Bun.BufferSource) {
        if (this.closed) {
            throw new Error("Connection was closed");
        }
        this.socket.data.sink.write(data);
        await writeFromSink(this.socket.data.sink, this.socket).catch(
            this.onError.bind(this)
        );
    }

    queueData(data: Uint8Array) {
        this.dataQueue.push(data);
        if (!this.processingIncoming) {
            this.processQueue().catch(this.onError.bind(this));
        }
    }

    async processQueue() {
        if (this.processingIncoming) return;
        this.processingIncoming = true;

        while (this.dataQueue.length > 0) {
            const data = this.dataQueue.shift() ?? new Uint8Array();
            await this.processData(data);
        }

        this.processingIncoming = false;
    }

    async processData(data: Uint8Array) {
        if (this.closed || data.length === 0) return;

        try {
            const id = data[0];
            if (id === 0x00 && !this.protocol) {
                for (const protocol of Object.values(this.context.protocols)) {
                    if (protocol.checkIdentifier(data)) {
                        this.protocol = protocol;
                        break;
                    }
                }
                if (this.protocol == null) {
                    throw new Error(`Protocol not found`);
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
            this.onError(error as Error);
        }
    }

    close() {
        if (this.closed) {
            return;
        }
        try {
            this.socket.end();
            setTimeout(() => {
                if (this.socket.readyState !== "closed") {
                    this.socket.terminate();
                }
            }, 1000);
        } catch (error) {
            console.error(error);
        }
        this.closed = true;
    }
}
export class Server {
    server?: TCPSocketListener;
    constructor(public readonly context: ContextManager) {}
    public host?: string;
    public port?: number;
    public connectionCount = 0;
    public stopped = false;
    protected _connections = new Map<number, WeakRef<Connection>>();
    public get connections() {
        return Object.freeze(new Map(this._connections));
    }
    cleanConnections() {
        for (const [id, connection] of this._connections) {
            if (!connection.deref()) {
                this._connections.delete(id);
            }
        }
    }
    start(host: string, port: number) {
        this.host = host;
        this.port = port;
        this.server = Bun.listen<SocketData>({
            hostname: this.host,
            port: this.port,
            socket: {
                data: (socket, data) => {
                    try {
                        if (socket.data.connection) {
                            socket.data.connection.queueData(
                                new Uint8Array(data)
                            );
                        }
                    } catch {
                        socket.end();
                    }
                },
                close: (socket) => {
                    try {
                        console.log("Socket closed");
                        if (socket.data.connection) {
                            socket.data.connection.close();
                        }
                    } catch (error) {
                        console.error(error);
                    }
                },
                error: (socket, error) => {
                    console.log(`Socket error: ${error}`);
                },
                open: (socket) => {
                    try {
                        console.log("Socket connected");
                        const id = this.connectionCount;
                        this.connectionCount++;
                        socket.data = {
                            connection: new Connection(
                                socket,
                                this.context,
                                id
                            ),
                            faucet: new ArrayBufferSink(),
                            sink: new ArrayBufferSink(),
                        };
                        socket.data.faucet.start({
                            stream: true,
                            highWaterMark: 1024,
                        });
                        socket.data.sink.start({
                            stream: true,
                            highWaterMark: 1024,
                        });
                        this.connections.set(
                            id,
                            new WeakRef(socket.data.connection)
                        );
                    } catch (error) {
                        console.error(error);
                        socket.end();
                    }
                },
                drain: (socket) => {
                    try {
                        console.log("Socket drained");
                        writeFromSink(socket.data.sink, socket);
                    } catch (error) {
                        console.error(error);
                        socket.end();
                    }
                },
            },
        });
        const cleanupInterval = setInterval(() => {
            if (this.stopped) {
                clearInterval(cleanupInterval);
                return;
            }
            this.cleanConnections();
        }, 30000);
        console.log(`Server started at ${this.host}:${this.port}`);
    }

    close() {
        this.server?.stop();
        this.stopped = true;
        console.log("Server stopped");
    }
}
export default Server;
