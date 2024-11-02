import EntityPosition from "datatypes/entityposition";
import type { Context } from "context";

export interface EntityOptions {
    position?: EntityPosition;
    name: string;
    id: number;
    context: Context;
}
export class Entity {
    private _position:EntityPosition;
    public get position():EntityPosition {
        return this._position;
    };
    public readonly id:number;
    public name:string;
    private context: Context;
    constructor({ id, name, position, context }: EntityOptions) {
        this.id = id;
        this._position = position ?? EntityPosition.zero;
        this.name = name;
        this.context = context;
    }
    move(position:EntityPosition) {
        this._position = position;
    }
    spawn() {
        // TODO: Implement
    }
}
export default Entity;