import type { Context } from "context";
import Entity from "./entity";
import EntityPosition from "datatypes/entityposition";

export default class Player extends Entity {
    fancyName:string;
    constructor(id:number, name:string, fancyName:string, context:Context) {
        super(id, name, context);
        this.fancyName = fancyName;
    }
    spawn() {
        super.spawn();
        
    }
    move(position:EntityPosition) {
        super.move(position);
    }
}