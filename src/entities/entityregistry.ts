import type { ContextManager } from "contextmanager";
import type { Entity } from "entities/entity";
import { OutOfCapacityError, ValueError } from "utility/genericerrors";
import { v4 as uuidv4 } from 'uuid';

export interface EntityRegistryOptions {
    maxEntities?: number;
    appendToList?: boolean; // If true, will append self to entity's registries list. Default is true
    context: ContextManager;
}

export class EntityRegistry {
    protected _entities = new Map<string, Entity>();
    public readonly maxEntities: number;
    protected context: ContextManager;
    protected appendToList: boolean;

    constructor({ maxEntities, appendToList, context }: EntityRegistryOptions) {
        this.context = context;
        this.maxEntities = maxEntities ?? 10**7;
        this.appendToList = appendToList ?? true;
    }

    register(entity: Entity, id?: string): string {
        if (this._entities.size >= this.maxEntities) {
            throw new OutOfCapacityError("Too many entities");
        }

        const entityId = id ?? uuidv4();
        
        if (this._entities.has(entityId)) {
            throw new ValueError("Entity id was already registered");
        }

        this._entities.set(entityId, entity);
        entity.ids.set(this, entityId);
        
        if (this.appendToList && entity.registries.indexOf(this) === -1) {
            entity.registries.push(this);
        }

        return entityId;
    }

    unregister(entity: Entity | string) {
        if (typeof entity === "string") {
            if (!this.has(entity)) {
                throw new Error("Entity id wasn't registered");
            }
            this._entities.delete(entity);
            return;
        }

        const id = entity.ids.get(this);
        if (id == null) {
            throw new ValueError("Entity has no id");
        }

        const current = this._entities.get(id);
        if (current == null || current !== entity) {
            throw new Error("Entity wasn't registered");
        }
        this._entities.delete(id);
    }

    has(id: string | Entity): boolean {
        if (typeof id === "string") {
            return this._entities.has(id);
        }
        const entityId = id.ids.get(this);
        return entityId != null && this._entities.has(entityId);
    }

    get(id: string): Entity | undefined {
        return this._entities.get(id);
    }

    get entities(): ReadonlyMap<string, Entity> {
        return Object.freeze(new Map(this._entities));
    }
}
