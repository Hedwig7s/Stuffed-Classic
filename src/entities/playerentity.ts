import type World from "data/worlds/world";
import type EntityPosition from "datatypes/entityposition";
import Entity, { type EntityOptions } from "entities/entity";
import { Broadcaster } from "networking/packet/broadcaster";
import { combineCriteria, criterias } from "networking/packet/broadcasterutil";
import { PacketIds } from "networking/packet/packet";
import type { DespawnPlayerPacketData, PositionAndOrientationPacketData } from "networking/packet/packetdata";
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
    public move(
        position: EntityPosition,
        broadcast = true,
        replicatedMovement = false
    ) {
        super.move(position, this.player.connection == undefined && broadcast);
        if (!broadcast || !this.player.connection || !this.server) return;
        let criteria;
        if (replicatedMovement)
            criteria = combineCriteria(
                criterias.sameWorld(this),
                criterias.notSelf(this.player.connection)
            );
        else criteria = criterias.sameWorld(this);
        const broadcaster = new Broadcaster<PositionAndOrientationPacketData>({
            criteria: criteria,
            packetId: PacketIds.PositionAndOrientation,
            server: this.server,
        });
        const { x, y, z, yaw, pitch } = this.position;
        broadcaster.broadcast({
            entityId: this.worldEntityId,
            x,
            y,
            z,
            yaw,
            pitch,
        });
    }
    public despawn(broadcast = true) {
        if (broadcast && this.world && this.server) {
            const broadcaster = new Broadcaster<DespawnPlayerPacketData>({
                server: this.server,
                packetId: PacketIds.DespawnPlayer,
                criteria: combineCriteria(
                    criterias.sameWorld(this),
                    criterias.notSelf(this.player.connection)
                ),
            });
            broadcaster.broadcast({ entityId: this.worldEntityId });
        }
        super.despawn(false);
    }
}
export default PlayerEntity;
