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
        await this.player.loadWorld();
        for (const entity of world.entities.values()) {
            if (entity !== this) {
                await entity.spawnFor(this.player);
                if (entity instanceof PlayerEntity) {
                    await this.spawnFor(entity.player);
                }
            }
        }

        const packet = this.player.protocol?.packets[PacketIds.SpawnPlayer];
        if (!packet || !packet.send) {
            this.logger.warn(
                "Could not find SpawnPlayer packet for player entity"
            );
            return;
        }
        const { x, y, z, yaw, pitch } = this.position;
        await packet.send(this.player.connection, {
            entityId: -1,
            name: this.fancyName,
            x,
            y,
            z,
            yaw,
            pitch,
        });
    }
    public despawn() {
        super.despawn();
    }
    public spawnFor(player: Player): Promise<void> {
        if (this.destroyed) return Promise.resolve();
        if (this.player === player) return Promise.resolve();
        if (!this.world || this.worldEntityId === -1) return Promise.resolve();
        const connection = player.connection;
        if (!connection) return Promise.resolve();
        const packet = player.protocol?.packets[PacketIds.SpawnPlayer];
        if (!packet || !packet.send) return Promise.resolve();
        const { x, y, z, yaw, pitch } = this.position;
        return packet.send(connection, {
            entityId: this.worldEntityId,
            name: this.fancyName,
            x,
            y,
            z,
            yaw,
            pitch,
        });
    }
}
export default PlayerEntity;
