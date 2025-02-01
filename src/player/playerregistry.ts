/*
    Simple registry class to manage player instances
*/
import { DestroySubscriptionManager } from "utility/destroysubscriptionmanager";
import type Player from "./player";

export class PlayerRegistry {
    protected readonly _players = new Map<string, Player>();
    public get players() {
        return Object.freeze(new Map(this._players));
    }
    protected destroySubscriptions = new DestroySubscriptionManager<string>(
        "destroy"
    );
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
    get(name: string) {
        return this._players.get(name);
    }
    has(player: string | Player) {
        if (typeof player === "string") {
            return this._players.has(player);
        }
        return this._players.get(player.name) === player;
    }
}
