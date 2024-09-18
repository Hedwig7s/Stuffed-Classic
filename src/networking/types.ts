import type { ArrayBufferSink, Socket } from "bun";
import type { Protocol } from "networking/protocol/protocol";
export interface IConnection {
    socket: Socket<SocketData>;
    protocol?: Protocol;
    closed: boolean;
    dataQueue: Uint8Array[];
    processing: boolean;

    write(data: string | Bun.BufferSource): void;
    start(): void;
    stop(): void;
    queueData(data: Uint8Array): void;
    processQueue(): Promise<void>;
    processData(data: Uint8Array): Promise<void>;
}
export type SocketData = {
    connection: IConnection;
    faucet: ArrayBufferSink; // In
    sink: ArrayBufferSink; // Out
}
