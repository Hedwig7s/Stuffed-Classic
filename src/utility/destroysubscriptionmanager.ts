/*
    Simple helper class to manage destroy events for a given key
    Useful for cleaning up subscriptions when an object is destroyed
*/
import type { EventEmitter } from "events";

export class DestroySubscriptionManager<K> {
    protected destroySubscriptions = new Map<K, (...args: any) => void>();
    constructor(protected eventKey: string) {}
    public subscribe(
        key: K,
        emitter: EventEmitter,
        destroySubscription: (...args: any) => void
    ) {
        if (!this.destroySubscriptions.has(key)) {
            emitter.on(this.eventKey, destroySubscription);
            this.destroySubscriptions.set(key, destroySubscription);
        }
    }
    public unsubscribe(key: K, emitter: EventEmitter) {
        const destroySubscription = this.destroySubscriptions.get(key);
        if (!destroySubscription) return;
        emitter.off(this.eventKey, destroySubscription);
        this.destroySubscriptions.delete(key);
    }
}
