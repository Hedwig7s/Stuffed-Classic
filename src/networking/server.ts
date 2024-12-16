import type { TCPSocketListener, Socket } from "bun";
import { ArrayBufferSink } from "bun";
import type { BaseProtocol } from "networking/protocol/baseprotocol";
import type { PacketIds } from "networking/protocol/basepacket";
import type { ContextManager } from "contextmanager";
import type { Player } from "entities/player";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";

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
    public closed = false;
    public protocol?: BaseProtocol;
    public player?: Player;
    public readonly dataQueue: Uint8Array[] = [];
    public processingIncoming = false;
    public readonly logger: pino.Logger;

    constructor(
        public readonly socket: Socket<SocketData>,
        public readonly context: ContextManager,
        public readonly id: number
    ) {
        this.logger = getSimpleLogger(`Connection ${id}`);
        setTimeout(() => {
            if (!this.protocol && !this.closed) {
                this.logger.warn("Handshake timeout");
                this.close();
            }
        }, 10000);
    }
    onError(error: Error) {
        this.logger.error(error);
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
            this.logger.error(error);
        }
        this.closed = true;
    }
}
export class Server {
    server?: TCPSocketListener;
    public host?: string;
    public port?: number;
    public connectionCount = 0;
    public stopped = false;
    public readonly logger: pino.Logger;
    protected _connections = new Map<number, WeakRef<Connection>>();
    public get connections() {
        return Object.freeze(new Map(this._connections));
    }
    constructor(public readonly context: ContextManager) {
        this.logger = getSimpleLogger("Server");
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
                        this.logger.info(
                            `Socket ${socket.data.connection?.id} closed`
                        );
                        if (socket.data.connection) {
                            socket.data.connection.close();
                        }
                    } catch (error) {
                        this.logger.error(error);
                    }
                },
                error: (socket, error) => {
                    this.logger.warn(`Socket error: ${error}`);
                },
                open: (socket) => {
                    try {
                        this.logger.info("Socket connected");
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
                        this.logger.error(error);
                        socket.end();
                    }
                },
                drain: (socket) => {
                    try {
                        writeFromSink(socket.data.sink, socket);
                    } catch (error) {
                        this.logger.error(error);
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
        this.logger.info(`Server started at ${this.host}:${this.port}`);
    }

    close() {
        this.server?.stop();
        this.stopped = true;
        this.logger.info("Server stopped");
    }
}
export default Server;
