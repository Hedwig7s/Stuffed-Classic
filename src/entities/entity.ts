import type World from "data/worlds/world";
import type {
    DespawnPlayerPacketData,
    PositionAndOrientationPacketData,
} from "networking/packet/packetdata";
import EntityPosition from "datatypes/entityposition";
import { EntityRegistry } from "entities/entityregistry";
import { Broadcaster } from "networking/packet/broadcaster";
import { criterias } from "networking/packet/broadcasterutil";
import { PacketIds } from "networking/packet/packet";
import type { Server } from "networking/server";
import type { Connection } from "networking/connection";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";
import EventEmitter from "events";
import type TypedEmitter from "typed-emitter";

export interface EntityOptions {
    name: string;
    /** Name with any decoration (e.g. color) */
    fancyName?: string;
    /** The registry to automatically register in, if any */
    registry?: EntityRegistry;
    server?: Server;
}

/** Events emitted by entities */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type EntityEvents = {
    destroy: () => void;
};

/**
 * Represents an entity in the game world.
 */
export abstract class Entity {
    /** A map of entity registries and the entity's id in them */
    public readonly ids = new Map<EntityRegistry, number>();
    public name: string;
    /** Name with any decoration (e.g. color) */
    public fancyName: string;
    /** The entity's id in its current world */
    public worldEntityId = -1;
    public world?: World;
    public position = new EntityPosition(0, 0, 0, 0, 0);
    public destroyed = false;
    public readonly logger: pino.Logger;
    public readonly server?: Server;
    public emitter = new EventEmitter() as TypedEmitter<EntityEvents>;
    constructor({ name, fancyName, registry, server }: EntityOptions) {
        this.name = name;
        this.fancyName = fancyName ?? name;
        this.logger = getSimpleLogger(`Entity ${this.name}`);
        this.server = server;
        if (registry) {
            registry.register(this);
        }
    }
    /**
     * Spawns the entity in the world
     * @param world The world to spawn in
     * @returns A promise that resolves when the entity is spawned
     */
    public spawn(world: World): Promise<any> {
        this.world = world;
        world.registerEntity(this);
        this.move(world.spawn);
        return Promise.resolve();
    }
    /**
     * Despawns the entity from the world
     * @param broadcast Whether to broadcast the despawn to all players
     */
    public despawn(broadcast = true) {
        if (broadcast && this.world && this.server) {
            const broadcaster = new Broadcaster<DespawnPlayerPacketData>({
                server: this.server,
                packetId: PacketIds.DespawnPlayer,
                criteria: criterias.sameWorld(this),
            });
            broadcaster.broadcast({ entityId: this.worldEntityId });
        }
        this.world?.unregisterEntity(this);
        this.world = undefined;
    }
    /**
     * Destroys the entity, despawning it and cleaning up resources
     */
    public destroy() {
        this.destroyed = true;
        this.emitter.emit("destroy");
        this.despawn();
    }
    /**
     * Moves the entity to a new position
     * @param position The new position
     * @param broadcast Whether to broadcast the move to all players
     */
    public move(position: EntityPosition, broadcast = true) {
        this.position = position;
        if (!this.world || !this.server || !broadcast) return;
        const broadcaster = new Broadcaster<PositionAndOrientationPacketData>({
            server: this.server,
            packetId: PacketIds.PositionAndOrientation,
            criteria: criterias.sameWorld(this.world),
        });
        const { x, y, z, yaw, pitch } = position;
        broadcaster.broadcast({
            entityId: this.worldEntityId,
            x,
            y,
            z,
            yaw,
            pitch,
        });
    }
    /**
     * Spawns the entity for a connection
     * @param connection The connection to spawn for
     * @returns A promise that resolves when the entity is spawned for the connection
     */
    public spawnFor(connection: Connection): Promise<void> {
        if (this.destroyed || !this.world || this.worldEntityId === -1) {
            return Promise.resolve();
        }
        if (!connection) return Promise.resolve();
        const packet = connection.protocol?.packets[PacketIds.SpawnPlayer];
        if (!packet || !packet.send) return Promise.resolve();
        const { x, y, z, yaw, pitch } = this.position;
        return packet.send(connection, {
            entityId: this.worldEntityId,
            name: this.fancyName,
            x,
            y,
            z,
            yaw,
            pitch,
        });
    }
}
export default Entity;
