import type { Packet, PacketIds } from "networking/packet/packet";
import type { Connection, Server } from "networking/server";
import type { PacketData } from "./packetdata";
type XOR<T, U> =
    | (T & { [K in keyof U]?: never })
    | (U & { [K in keyof T]?: never });

export type BroadcastOptions<T> = {
    packetId: PacketIds;
    modifier?: (data: Omit<T, "id">, target: Connection) => Omit<T, "id">;
    criteria?: (target: Connection) => boolean;
} & XOR<{ server: Server }, { connections: Map<number, WeakRef<Connection>> }>;

export class Broadcaster<T extends PacketData> {
    public readonly packetId: PacketIds;
    public readonly modifier?: (
        data: Omit<T, "id">,
        target: Connection
    ) => Omit<T, "id">;
    public readonly criteria?: (target: Connection) => boolean;
    public readonly connections: Map<number, WeakRef<Connection>>;

    constructor({
        packetId,
        modifier,
        criteria,
        server,
        connections,
    }: BroadcastOptions<T>) {
        this.packetId = packetId;
        this.modifier = modifier;
        this.criteria = criteria;
        this.connections = connections ?? server.connections;
    }

    public broadcast(data: Omit<T, "id">) {
        const promises: Promise<void>[] = [];
        for (const ref of this.connections.values()) {
            const connection = ref.deref();
            if (!connection) continue;
            try {
                if (this.criteria && !this.criteria(connection)) continue;
                const packet = connection.protocol?.packets[this.packetId] as
                    | Packet<T>
                    | undefined;
                if (!packet) continue;
                if (!packet.send) continue;
                const newData = this.modifier
                    ? this.modifier(data, connection)
                    : data;
                promises.push(
                    packet.send(connection, newData).catch((error) => {
                        connection.logger.error(error);
                    })
                );
            } catch (error) {
                connection.logger.error(error);
            }
        }
        return Promise.all(promises);
    }
}
