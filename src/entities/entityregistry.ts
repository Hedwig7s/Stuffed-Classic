import type { Entity } from "entities/entity";
import { DestroySubscriptionManager } from "utility/destroysubscriptionmanager";
import { v4 as uuidv4 } from "uuid";

export class EntityRegistry {
    protected _entities = new Map<string, Entity>();
    protected destroySubscriptions = new DestroySubscriptionManager<string>(
        "destroy"
    );

    register(entity: Entity, id?: string): string {
        const entityId = id ?? uuidv4();

        if (this._entities.has(entityId)) {
            throw new Error("Entity id was already registered");
        }

        this._entities.set(entityId, entity);
        entity.ids.set(this, entityId);

        const destroySubscription = () => {
            if (this._entities.has(entityId)) {
                this.unregister(entityId);
            }
        };
        this.destroySubscriptions.subscribe(
            entityId,
            entity.emitter,
            destroySubscription
        );

        return entityId;
    }

    unregister(entity: Entity | string) {
        if (typeof entity === "string") {
            if (!this.has(entity)) {
                throw new Error("Entity id wasn't registered");
            }
            const ent = this._entities.get(entity) as Entity;
            this._entities.delete(entity);
            this.destroySubscriptions.unsubscribe(entity, ent.emitter);
            return;
        }

        const id = entity.ids.get(this);
        if (id == null) {
            throw new Error("Entity has no id");
        }

        const current = this._entities.get(id);
        if (current == null || current !== entity) {
            throw new Error("Entity wasn't registered");
        }
        this._entities.delete(id);
        this.destroySubscriptions.unsubscribe(id, entity.emitter);
        entity.ids.delete(this);
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
