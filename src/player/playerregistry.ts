import type Player from "./player";

export class PlayerRegistry {
    public players = new Map<string, Player>();
    register(player: Player) {
        this.players.set(player.name, player);
    }
    unregister(player: Player) {
        this.players.delete(player.name);
    }
    get(name: string) {
        return this.players.get(name);
    }
}
