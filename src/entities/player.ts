import type { Connection } from "networking/server";
import { Entity } from "./entity";
import type { EntityOptions } from "./entity";
/*import EntityPosition from "datatypes/entityposition";
import type { World } from "data/worlds/world";*/
 
export interface PlayerOptions extends EntityOptions {
    fancyName: string;
}

export class Player extends Entity {
    fancyName: string;
    connection?: Connection;
    
    constructor(options: PlayerOptions) {
        super(options);
        const { fancyName, register } = options;
        this.fancyName = fancyName;
        if (register ?? true) {
            this.context.playerRegistry.register(this);
        }
    }
    /*spawn(world: World) {
        super.spawn(world);
    }
    move(position:EntityPosition) {
        super.move(position);
    }
    destroy() {
        super.destroy();
    }*/
}

export default Player;