import type { Packet, PacketIds } from "networking/packet/basepacket";
import type { Connection } from "networking/server";
import type { BasePacketData } from "./packetdata";
import type { ContextManager } from "contextmanager";

export interface BroadcastOptions<T> {
    packetId: PacketIds;
    context: ContextManager;
    modifier?: (data: Omit<T, "id">, target: Connection) => Omit<T, "id">;
    criteria?: (target: Connection) => boolean;
}

export class Broadcaster<T extends BasePacketData> {
    public readonly packetId: PacketIds;
    public readonly modifier?: (
        data: Omit<T, "id">,
        target: Connection
    ) => Omit<T, "id">;
    public readonly criteria?: (target: Connection) => boolean;
    public readonly context: ContextManager;

    constructor({
        packetId,
        modifier,
        criteria,
        context,
    }: BroadcastOptions<T>) {
        this.packetId = packetId;
        this.modifier = modifier;
        this.criteria = criteria;
        this.context = context;
    }

    public broadcast(data: Omit<T, "id">) {
        const promises: Promise<void>[] = [];
        for (const ref of this.context.server.connections.values()) {
            const connection = ref.deref();
            if (!connection) continue;
            try {
                if (this.criteria && !this.criteria(connection)) continue;
                const packet = connection.protocol?.packets[
                    this.packetId
                ] as Packet<T>;
                if (!packet) continue;
                if (!packet.sender) continue;
                const newData = this.modifier
                    ? this.modifier(data, connection)
                    : data;
                promises.push(
                    packet.sender(connection, newData).catch((error) => {
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
