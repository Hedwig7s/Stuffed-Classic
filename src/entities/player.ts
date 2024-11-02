import { Entity } from "./entity";
import type { EntityOptions } from "./entity";
import EntityPosition from "datatypes/entityposition";

export interface PlayerOptions extends EntityOptions {
    fancyName: string;
}

export class Player extends Entity {
    fancyName:string;
    constructor(options: PlayerOptions) {
        super(options);
        const { fancyName } = options;
        this.fancyName = fancyName;
    }
    spawn() {
        super.spawn();
    }
    move(position:EntityPosition) {
        super.move(position);
    }
}
export default Player;