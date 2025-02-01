/*
    Handles traffic between the server and the client
*/
import type { Socket } from "bun";
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
import { ServiceRegistry } from "utility/serviceregistry";
import type { ServiceMap } from "servercontext";
import type TypedEventEmitter from "typed-emitter";
import EventEmitter from "events";
import type { SocketData } from "./server";
interface Cooldown {
    count: number;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type ConnectionEvents = {
    close: () => void;
};

export class Connection {
    public closed = false;
    public protocol?: Protocol;
    public player?: Player;
    public readonly logger: pino.Logger;
    protected receivedBuffer: ArrayBufferSink;
    protected toSendBuffer: ArrayBufferSink;
    public packetCooldown: Cooldown = { count: 0 };
    public readonly emitter =
        new EventEmitter() as TypedEventEmitter<ConnectionEvents>;

    constructor(
        public readonly socket: Socket<SocketData>,
        public readonly id: number,
        public readonly protocols: Record<number, Protocol>,
        public readonly serviceRegistry: ServiceRegistry<ServiceMap>
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
        const checkCooldown = setInterval(() => {
            if (this.closed) clearInterval(checkCooldown);
            if (this.packetCooldown.count > 50) {
                this.logger.warn("Packet flood detected");
                this.disconnectWithReason("Too much data!", 100);
            }
            this.packetCooldown.count = 0;
        }, 1000);
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
        if (!packet?.receive) throw new Error(`Invalid packet ${id}: ${data}`);

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
        this.disconnectWithReason("Internal error");
    }
    disconnectWithReason(reason = "Disconnected", timeout = 1000) {
        const packet = this.protocol?.packets[PacketIds.DisconnectPlayer];
        if (packet) {
            packet.send(this, { reason }).catch(this.close.bind(this));
        }
        setTimeout(() => {
            if (!this.closed) this.close();
        }, timeout);
    }
    close() {
        if (this.closed) return;
        this.closed = true;
        this.emitter.emit("close");
        try {
            this.player?.destroy();
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
    }
}