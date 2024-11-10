import EntityPosition from "datatypes/entityposition";
import type { ContextManager } from "contextmanager";
import type { World } from "data/worlds/world";
import type { EntityRegistry } from "entities/entityregistry";

export interface EntityOptions {
    position?: EntityPosition;
    name: string;
    context: ContextManager;
    register?: boolean; // If false, the entity will not be registered automatically, default behavior is to register.
    unregister?: boolean; // If set, the entity will be unregistered from the registries. Default behavior is to unregister
}

export class Entity {
    protected _position: EntityPosition;
    public get position(): EntityPosition {
        return this._position;
    };
    public readonly ids = new Map<EntityRegistry, string>();
    public name: string;
    public readonly context: ContextManager;
    public destroyed: boolean;
    protected unregister: boolean;
    public readonly registries: EntityRegistry[] = [];
    public world?: World;
    public worldEntityId = -1; // Entity id within a world
    protected static finalizationRegistry = new FinalizationRegistry<Entity>(this.cleanup);
    protected static cleanup(entity: Entity) {
        if (!entity.destroyed) {
            entity.destroy();
        }
    }
    constructor({ name, position, context, register, unregister }: EntityOptions) {
        this.context = context;
        this.unregister = unregister ?? true;
        if (register ?? true) {
            this.context.entityRegistry.register(this);
        }
        this._position = position ?? EntityPosition.zero;
        this.name = name;
        this.destroyed = false;   
    }

    move(position: EntityPosition) {
        this._position = position;
    }

    spawn(world: World) {
        // TODO: Implement
        this.world = world;
    }

    destroy() {
        this.destroyed = true;
        if (this.unregister) {
            for (const registry of this.registries) {
                registry.unregister(this);
            }
        }
        Entity.finalizationRegistry.unregister(this);
    }
}

export default Entity;
