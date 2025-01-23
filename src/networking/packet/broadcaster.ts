import type { Packet, PacketIds } from "networking/packet/packet";
import type { Connection, Server } from "networking/server";
import type { PacketData } from "./packetdata";
import { DestroySubscriptionManager } from "utility/destroysubscriptionmanager";

export type BroadcastOptions<T> = {
    packetId: PacketIds;
    modifier?: (data: Omit<T, "id">, target: Connection) => Omit<T, "id">;
    criteria?: (target: Connection) => boolean;
    server?: Server;
    connections?: Map<number, Connection>;
} & ({ server: Server } | { connections: Map<number, Connection> });

export class Broadcaster<T extends PacketData> {
    public readonly packetId: PacketIds;
    public readonly modifier?: (
        data: Omit<T, "id">,
        target: Connection
    ) => Omit<T, "id">;
    public readonly criteria?: (target: Connection) => boolean;
    public readonly connections?: Map<number, Connection>;
    protected destroySubscriptions = new DestroySubscriptionManager<number>(
        "close"
    );
    public readonly server?: Server;

    constructor({
        packetId,
        modifier,
        criteria,
        server,
        connections,
    }: BroadcastOptions<T>) {
        if (!server && !connections) {
            throw new Error("No server or connections");
        }
        this.packetId = packetId;
        this.modifier = modifier;
        this.criteria = criteria;
        this.connections = connections;
        this.server = server;
        if (this.connections) {
            for (const connection of this.connections.values()) {
                this.addConnection(connection);
            }
        }
    }

    public addConnection(connection: Connection) {
        if (!this.connections) return;
        const destroySubscription = () => {
            this.removeConnection(connection);
        };
        this.destroySubscriptions.subscribe(
            connection.id,
            connection.emitter,
            destroySubscription
        );
        this.connections.set(connection.id, connection);
    }

    public removeConnection(connection: Connection) {
        if (!this.connections) return;
        this.destroySubscriptions.unsubscribe(
            connection.id,
            connection.emitter
        );
        this.connections.delete(connection.id);
    }

    public broadcast(data: Omit<T, "id">) {
        const promises: Promise<void>[] = [];
        for (const connection of [
            ...(this.connections?.values() ?? []),
            ...(this.server?.connections.values() ?? []),
        ]) {
            if (connection.closed) continue;
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
