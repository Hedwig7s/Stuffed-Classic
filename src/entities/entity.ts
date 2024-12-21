import type { ContextManager } from "contextmanager";
import type World from "data/worlds/world";
import EntityPosition from "datatypes/entityposition";
import { EntityRegistry } from "entities/entityregistry";
import type pino from "pino";
import type Player from "player/player";
import { getSimpleLogger } from "utility/logger";

export interface EntityOptions {
    context?: ContextManager;
    name: string;
    fancyName: string;
    register?: boolean; // Whether to register in the default registry. Defaults to true
}

export abstract class Entity {
    public ids = new Map<EntityRegistry, string>();
    public name: string;
    public fancyName: string;
    public registries = new Set<EntityRegistry>();
    public worldEntityId = -1;
    public world?: World;
    public position = new EntityPosition(0, 0, 0, 0, 0);
    public destroyed = false;
    public context?: ContextManager;
    public logger: pino.Logger;
    constructor({ context, name, fancyName, register }: EntityOptions) {
        this.context = context;
        this.name = name;
        this.fancyName = fancyName;
        this.logger = getSimpleLogger(`Entity ${this.name}`);
        if (this.context && register && true) {
            this.context.entityRegistry.register(this);
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
