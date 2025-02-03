/*
    Registry for all entities in a server
*/
import type { Entity } from "entities/entity";
import { DestroySubscriptionManager } from "utility/destroysubscriptionmanager";

export class EntityRegistry {
    protected _entities = new Map<number, Entity>();
    protected destroySubscriptions = new DestroySubscriptionManager<number>(
        "destroy"
    );
    protected entityCount = 0;

    register(entity: Entity, id?: number): number {
        const entityId = id ?? this.entityCount++;

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

    unregister(entity: Entity | number) {
        if (typeof entity === "number") {
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

    has(id: number | Entity): boolean {
        if (typeof id === "number") {
            return this._entities.has(id);
        }
        const entityId = id.ids.get(this);
        return entityId != null && this._entities.has(entityId);
    }

    get(id: number): Entity | undefined {
        return this._entities.get(id);
    }

    get entities(): ReadonlyMap<number, Entity> {
        return Object.freeze(new Map(this._entities));
    }
}
