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
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    public spawn(world: World): Promise<void[]> {
        super.spawn(world);
        const promises: Promise<void>[] = [];
        if (!this.player.connection) return Promise.all(promises);
        for (const entity of world.entities.values()) {
            if (entity !== this) {
                promises.push(entity.spawnFor(this.player));
                if (entity instanceof PlayerEntity) {
                    promises.push(this.spawnFor(entity.player));
                }
            }
        }
        const packet = this.player.protocol?.packets[PacketIds.SpawnPlayer];
        if (!packet || !packet.sender) {
            this.logger.warn(
                "Could not find SpawnPlayer packet for player entity"
            );
            return Promise.all(promises);
        }
        const { x, y, z, yaw, pitch } = this.position;
        promises.push(
            packet.sender(this.player.connection, {
                entityId: -1,
                name: this.fancyName,
                x,
                y,
                z,
                yaw,
                pitch,
            })
        );
        return Promise.all(promises);
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
        if (!packet || !packet.sender) return Promise.resolve();
        const { x, y, z, yaw, pitch } = this.position;
        return packet.sender(connection, {
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
