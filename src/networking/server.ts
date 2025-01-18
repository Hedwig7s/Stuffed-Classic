import type { TCPSocketListener, Socket } from "bun";
import { ArrayBufferSink } from "bun";
import type { Protocol } from "networking/protocol/protocol";
import {
    PacketIds,
    type Packet,
    type ReceivablePacket,
} from "networking/packet/packet";
import type { Player } from "player/player";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";
import type WorldManager from "data/worlds/worldmanager";

export interface SocketData {
    connection: Connection;
}

export class Connection {
    public closed = false;
    public protocol?: Protocol;
    public player?: Player;
    public readonly logger: pino.Logger;
    protected receivedBuffer: ArrayBufferSink;
    protected toSendBuffer: ArrayBufferSink;
    
    constructor(
        public readonly socket: Socket<SocketData>,
        public readonly id: number,
        public readonly protocols: Record<number, Protocol>,
        public readonly worldManager: WorldManager,
        public readonly server: Server
    ) {
        this.logger = getSimpleLogger(`Connection ${id}`);
        const sinkSettings = {
            highWaterMark: 1024,
            stream: true,
            asUint8Array: true,
        };
        this.receivedBuffer = new ArrayBufferSink();
        this.receivedBuffer.start(sinkSettings);
        this.toSendBuffer = new ArrayBufferSink();
        this.toSendBuffer.start(sinkSettings);

        setTimeout(() => {
            if (!this.protocol && !this.closed) {
                this.logger.warn("Handshake timeout");
                this.close();
            }
        }, 10000);
    }

    checkSocket() {
        if (this.socket.readyState === "closed" && !this.closed) this.close();
    }

    async write(data: string | ArrayBuffer | Bun.BufferSource) {
        if (this.closed) throw new Error("Connection was closed");
        this.toSendBuffer.write(data);
        await this.processOutgoing().catch(this.onError.bind(this));
    }

    async processOutgoing() {
        if (this.closed) return;
        const data = this.toSendBuffer.flush() as Uint8Array;
        const wrote = await this.socket.write(data);
        if (wrote < data.byteLength) {
            const flushed = this.toSendBuffer.flush() as Uint8Array;
            const subarray = data.subarray(wrote);
            this.toSendBuffer.write(subarray);
            if (flushed.length > 0) this.toSendBuffer.write(flushed);
        }
    }

    bufferIncoming(data: Uint8Array) {
        this.receivedBuffer.write(data);
        this.processIncoming().catch(this.onError.bind(this));
    }

    async processIncoming() {
        const requeue = (data: Uint8Array, retry = false) => {
            const flushed = this.receivedBuffer.flush() as Uint8Array;
            if (flushed.length === 0) {
                if (retry) {
                    this.bufferIncoming(data);
                } else {
                    this.receivedBuffer.write(data);
                }
                return;
            }
            this.receivedBuffer.write(data);
            if (retry) {
                this.bufferIncoming(flushed);
            } else {
                this.receivedBuffer.write(flushed);
            }
        };
        const data = this.receivedBuffer.flush() as Uint8Array<ArrayBuffer>;
        if (this.closed || data.byteLength === 0) {
            requeue(data);
            return;
        }

        const id = data[0];
        // Find protocol
        if (id === 0x00 && !this.protocol) {
            this.protocol = Object.values(this.protocols).find((p) =>
                p.checkIdentifier(data)
            );
            if (!this.protocol) throw new Error("Protocol not found");
        }

        if (!this.protocol) {
            requeue(data);
            return;
        }

        // Process packet
        const packet = this.protocol.packets[id as PacketIds] as Packet<any>;
        if (!packet?.receive) throw new Error(`Invalid packet ${id}`);

        const receivablePacket = packet as ReceivablePacket<any>;
        const size = receivablePacket.size;

        if (data.byteLength < size) {
            requeue(data);
            return;
        }

        await receivablePacket.receive(this, data);

        // Handle remaining data
        if (data.byteLength > size) {
            requeue(data.subarray(size), true);
        }
    }

    onError(error: Error) {
        this.logger.error(error);
        this.close();
    }

    close() {
        if (this.closed) return;
        try {
            this.player?.cleanup();
            if (this.socket.readyState !== "closed") {
                this.socket.end();
                setTimeout(() => {
                    if (this.socket.readyState !== "closed")
                        this.socket.terminate();
                }, 1000);
            }
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
    public readonly logger = getSimpleLogger("Server");
    protected _connections = new Map<number, WeakRef<Connection>>();

    constructor(public readonly protocols: Record<number, Protocol>) {}

    public get connections() {
        return Object.freeze(new Map(this._connections));
    }

    cleanConnections() {
        for (const [id, connection] of this._connections) {
            if (!connection.deref()) this._connections.delete(id);
        }
    }

    start(host: string, port: number, worldManager: WorldManager) {
        this.host = host;
        this.port = port;

        this.server = Bun.listen<SocketData>({
            hostname: this.host,
            port: this.port,
            socket: {
                data: (socket, data) => {
                    try {
                        socket.data.connection?.bufferIncoming(
                            new Uint8Array(data)
                        );
                    } catch {
                        socket.end();
                    }
                },
                close: (socket) => {
                    try {
                        this.logger.info(
                            `Socket ${socket.data.connection?.id} closed`
                        );
                        socket.data.connection?.close();
                    } catch (error) {
                        this.logger.error(error);
                    }
                },
                error: (socket, error) =>
                    this.logger.warn(`Socket error: ${error}`),
                open: (socket) => {
                    try {
                        const id = this.connectionCount++;
                        socket.data = {
                            connection: new Connection(
                                socket,
                                id,
                                this.protocols,
                                worldManager,
                                this
                            ),
                        };
                        this._connections.set(
                            id,
                            new WeakRef(socket.data.connection)
                        );
                        this.logger.info("Socket connected");
                    } catch (error) {
                        this.logger.error(error);
                        socket.end();
                    }
                },
                drain: (socket) => {
                    try {
                        socket.data.connection?.processOutgoing();
                    } catch (error) {
                        this.logger.error(error);
                        socket.end();
                    }
                },
            },
        });

        setInterval(() => {
            if (!this.stopped) this.cleanConnections();
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
