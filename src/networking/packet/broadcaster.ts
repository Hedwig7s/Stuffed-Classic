import type { Packet, PacketIds } from "networking/packet/packet";
import type { Server } from "networking/server";
import type { Connection } from "networking/connection";
import type { PacketData } from "./packetdata";
import { DestroySubscriptionManager } from "utility/destroysubscriptionmanager";

/**
 * Options for creating a broadcaster
 * @template T The packet data type
 */
export type BroadcastOptions<T> = {
    packetId: PacketIds;
    /** 
     * A function to modify the data before sending it to a connection
     * @param data The data to modify
     * @param target The connection to send the data to
     * @returns The modified data
     */
    modifier?: (data: Omit<T, "id">, target: Connection) => Omit<T, "id">;
    /**
     * A function to determine if a connection should receive the data
     * @param target The connection to check
     * @returns Whether the connection should receive the data
     */
    criteria?: (target: Connection) => boolean;
    /** Used to find connections to broadcast to */
    server?: Server;
    connections?: Map<number, Connection>;
} & ({ server: Server } | { connections: Map<number, Connection> });

/**
 * A broadcaster for sending packets to multiple connections
 * @template T The packet data type
 */
export class Broadcaster<T extends PacketData> {
    public readonly packetId: PacketIds;
    /**
     * A function to modify the data before sending it to a connection
     * @param data The data to modify
     * @param target The connection to send the data to
     * @returns The modified data
     */
    public readonly modifier?: (
        data: Omit<T, "id">,
        target: Connection
    ) => Omit<T, "id">;
    /**
     * A function to determine if a connection should receive the data
     * @param target The connection to check
     * @returns Whether the connection should receive the data
     */
    public readonly criteria?: (target: Connection) => boolean;
    public readonly connections?: Map<number, Connection>;
    protected destroySubscriptions = new DestroySubscriptionManager<number>(
        "close"
    );
    /** Used to find connections to broadcast to */
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

    /**
     * Add a connection to the broadcaster
     * @param connection The connection to add
     * @throws If using server for connections
     */
    public addConnection(connection: Connection) {
        if (!this.connections) throw new Error("Using server for connections. Cannot add connection");
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
    /**
     * Remove a connection from the broadcaster
     * @param connection The connection to remove
     * @throws If using server for connections
     */
    public removeConnection(connection: Connection) {
        if (!this.connections) throw new Error("Using server for connections. Cannot remove connection");
        this.destroySubscriptions.unsubscribe(
            connection.id,
            connection.emitter
        );
        this.connections.delete(connection.id);
    }
    /**
     * Broadcast data to all connections
     * @param data The data to broadcast
     */
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
