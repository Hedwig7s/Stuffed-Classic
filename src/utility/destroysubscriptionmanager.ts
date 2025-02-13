import type { EventEmitter } from "events";

/**
 * Simple helper class to manage destroy events for a given key.
 * Useful for cleaning up destroy subscriptions when an object is destroyed
 */
export class DestroySubscriptionManager<K> {
    protected destroySubscriptions = new Map<K, (...args: any) => void>();
    constructor(protected eventKey: string) {}
    /**
     * Add a destroy subscription for a given key
     * @param key The key to associate with the destroy subscription
     * @param emitter The emitter to listen for destroy events on
     * @param destroySubscription The function to call when the destroy event is emitted
     */
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
    /**
     * Remove a destroy subscription for a given key
     * @param key The destroy subscription's key
     * @param emitter The emitter to remove the destroy subscription fro
     */
    public unsubscribe(key: K, emitter: EventEmitter) {
        const destroySubscription = this.destroySubscriptions.get(key);
        if (!destroySubscription) return;
        emitter.off(this.eventKey, destroySubscription);
        this.destroySubscriptions.delete(key);
    }
}
