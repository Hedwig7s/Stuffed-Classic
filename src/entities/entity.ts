import type World from "data/worlds/world";
import type { PositionAndOrientationPacketData } from "networking/packet/packetdata";
import EntityPosition from "datatypes/entityposition";
import { EntityRegistry } from "entities/entityregistry";
import { Broadcaster } from "networking/packet/broadcaster";
import { criterias } from "networking/packet/broadcasterutil";
import { PacketIds } from "networking/packet/packet";
import type { Connection, Server } from "networking/server";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";
import EventEmitter from "events";
import type TypedEmitter from "typed-emitter";

export interface EntityOptions {
    name: string;
    fancyName: string;
    registry?: EntityRegistry; // The registry to automatically register in, if any
    server?: Server;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type EntityEvents = {
    destroy: () => void;
};

export abstract class Entity {
    public readonly ids = new Map<EntityRegistry, string>();
    public name: string;
    public fancyName: string;
    public worldEntityId = -1;
    public world?: World;
    public position = new EntityPosition(0, 0, 0, 0, 0);
    public destroyed = false;
    public readonly logger: pino.Logger;
    public readonly server?: Server;
    public emitter = new EventEmitter() as TypedEmitter<EntityEvents>;
    constructor({ name, fancyName, registry, server }: EntityOptions) {
        this.name = name;
        this.fancyName = fancyName;
        this.logger = getSimpleLogger(`Entity ${this.name}`);
        this.server = server;
        if (registry) {
            registry.register(this);
        }
    }
    public spawn(world: World): Promise<any> {
        this.world = world;
        world.registerEntity(this);
        this.move(world.spawn);
        return Promise.resolve();
    }
    public despawn() {
        this.world?.unregisterEntity(this);
        this.world = undefined;
    }
    public destroy() {
        this.destroyed = true;
        this.emitter.emit("destroy");
        this.despawn();
        if (this.world && this.worldEntityId >= 0) {
            this.world.unregisterEntity(this);
            this.worldEntityId = -1;
        }
    }
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
