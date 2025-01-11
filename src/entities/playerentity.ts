import type World from "data/worlds/world";
import Entity, { type EntityOptions } from "entities/entity";
import { PacketIds } from "networking/packet/packet";
import Player from "player/player";

export interface PlayerEntityOptions extends EntityOptions {
    player: Player;
}

export class PlayerEntity extends Entity {
    public readonly player: Player;
    constructor(options: PlayerEntityOptions) {
        super(options);
        this.player = options.player;
    }
    public async spawn(world: World): Promise<void> {
        super.spawn(world);
        if (!this.player.connection) return;
        await this.player.spawn();
    }
    public despawn() {
        super.despawn();
    }
}
export default PlayerEntity;
