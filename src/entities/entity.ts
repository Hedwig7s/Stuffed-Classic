import EntityPosition from "datatypes/entityposition";
import type { Context } from "context";

export default class Entity {
    private _position:EntityPosition;
    public get position():EntityPosition {
        return this._position;
    };
    constructor(public readonly id:number, public name:string, private context: Context) {
        this.id = id;
        this._position = EntityPosition.zero;
        this.name = name;
    }
    move(position:EntityPosition) {
        this._position = position;
    }
    spawn() {
        // TODO: Implement
    }
}