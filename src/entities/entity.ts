import type World from "data/worlds/world";
import EntityPosition from "datatypes/entityposition";
import { EntityRegistry } from "entities/entityregistry";
import type pino from "pino";
import type Player from "player/player";
import { getSimpleLogger } from "utility/logger";

export interface EntityOptions {
    name: string;
    fancyName: string;
    registry?: EntityRegistry; // The registry to automatically register in, if any 
}

export abstract class Entity {
    public readonly ids = new Map<EntityRegistry, string>();
    public readonly registries = new Set<EntityRegistry>();
    public name: string;
    public fancyName: string;
    public worldEntityId = -1;
    public world?: World;
    public position = new EntityPosition(0, 0, 0, 0, 0);
    public destroyed = false;
    public readonly logger: pino.Logger;
    constructor({ name, fancyName, registry: registry }: EntityOptions) {
        this.name = name;
        this.fancyName = fancyName;
        this.logger = getSimpleLogger(`Entity ${this.name}`);
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
        this.despawn();
        for (const registry of this.registries) {
            registry.unregister(this);
        }
        this.destroyed = true;
    }
    public move(position: EntityPosition) {
        this.position = position;
    }
    public abstract spawnFor(player: Player): Promise<void>;
}
export default Entity;
