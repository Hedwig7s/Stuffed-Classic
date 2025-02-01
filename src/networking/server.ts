/*
    Handles opening connections
*/
import type { TCPSocketListener } from "bun";
import type { Protocol } from "networking/protocol/protocol";
import { getSimpleLogger } from "utility/logger";
import { ServiceRegistry } from "utility/serviceregistry";
import type { ServiceMap } from "servercontext";
import type TypedEventEmitter from "typed-emitter";
import EventEmitter from "events";
import { Connection } from "networking/connection";

export interface SocketData {
    connection: Connection;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type ServerEvents = {
    close: () => void;
};

export class Server {
    server?: TCPSocketListener;
    public host?: string;
    public port?: number;
    public connectionCount = 0;
    public stopped = false;
    public readonly logger = getSimpleLogger("Server");
    public readonly emitter =
        new EventEmitter() as TypedEventEmitter<ServerEvents>;

    public connections = new Map<number, Connection>();

    constructor(
        public readonly protocols: Record<number, Protocol>,
        public readonly serviceRegistry: ServiceRegistry<ServiceMap>
    ) {}

    start(host: string, port: number) {
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
                        if (socket.data.connection)
                            socket.data.connection.packetCooldown.count++;
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
                                this.serviceRegistry
                            ),
                        };
                        this.connections.set(id, socket.data.connection);
                        socket.data.connection.emitter.on("close", () => {
                            this.connections.delete(id);
                        });
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

        this.logger.info(`Server started at ${this.host}:${this.port}`);
    }

    close() {
        if (this.stopped) return;
        this.emitter.emit("close");
        this.server?.stop();
        this.stopped = true;
        this.logger.info("Server stopped");
    }
}

export default Server;
