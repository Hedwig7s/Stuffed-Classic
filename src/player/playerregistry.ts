/*
    Simple registry class to manage player instances
*/
import { DestroySubscriptionManager } from "utility/destroysubscriptionmanager";
import type Player from "./player";

/**
 * Registry for player instances
 */
export class PlayerRegistry {
    protected readonly _players = new Map<string, Player>();
    public get players() {
        return Object.freeze(new Map(this._players));
    }
    protected destroySubscriptions = new DestroySubscriptionManager<string>(
        "destroy"
    );
    /**
     * Add a player to the registry
     * @param player The player to register
     */
    register(player: Player) {
        if (this._players.has(player.name)) {
            throw new Error("Player was already registered, or name is taken");
        }
        this._players.set(player.name, player);
        const destroySubscription = () => {
            if (this._players.has(player.name)) {
                this.unregister(player);
            }
        };
        this.destroySubscriptions.subscribe(
            player.name,
            player.emitter,
            destroySubscription
        );
    }
    /**
     * Remove a player from the registry
     * @param player The player to unregister
     */
    unregister(player: Player) {
        if (this._players.get(player.name) !== player) {
            player.logger.warn(
                "Different player with same name was registered"
            );
            return;
        }
        this._players.delete(player.name);
        this.destroySubscriptions.unsubscribe(player.name, player.emitter);
    }
    /**
     * Get a player by name
     * @param name The name of the player
     * @returns The player instance, or undefined if not found
     */
    get(name: string) {
        return this._players.get(name);
    }
    /**
     * Check if a player is registered
     * @param player The player instance or name to check
     * @returns True if the player is registered
     */
    has(player: string | Player) {
        if (typeof player === "string") {
            return this._players.has(player);
        }
        return this._players.get(player.name) === player;
    }
}
