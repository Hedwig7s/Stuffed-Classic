import { fromFixed, toFixed } from "utility/fixed";
import Vector3 from "./vector3";

export default class EntityPosition {
    protected _position: Vector3;
    protected _yaw: number;
    protected _pitch: number;
    constructor(x: number, y: number, z: number, yaw: number, pitch: number) {
        this._position = new Vector3(x, y, z);
        this._yaw = yaw;
        this._pitch = pitch;
    }
    get x(): number {
        return this._position.x;
    }
    get y(): number {
        return this._position.y;
    }
    get z(): number {
        return this._position.z;
    }
    get position(): Vector3 {
        return this._position;
    }
    get yaw(): number {
        return this._yaw;
    }
    get pitch(): number {
        return this._pitch;
    }
    static fromVector3(v: Vector3, yaw: number, pitch: number): EntityPosition {
        return new EntityPosition(v.x, v.y, v.z, yaw, pitch);
    }
    static get zero(): EntityPosition {
        return new EntityPosition(0, 0, 0, 0, 0);
    }
    static get one(): EntityPosition {
        return new EntityPosition(1, 1, 1, 0, 0);
    }
    toString(): string {
        return `${this._position.toString()},${this._yaw},${this._pitch}`;
    }
    toFixed(precision: number): EntityPosition {
        return new EntityPosition(
            ...(toFixed(
                precision,
                this._position.x,
                this._position.y,
                this._position.z
            ) as [number, number, number]),
            ...(toFixed(precision, this._yaw, this._pitch) as [number, number])
        );
    }
    fromFixed(precision: number): EntityPosition {
        return new EntityPosition(
            ...(fromFixed(
                precision,
                this._position.x,
                this._position.y,
                this._position.z
            ) as [number, number, number]),
            ...(fromFixed(precision, this._yaw, this._pitch) as [
                number,
                number,
            ])
        );
    }
}
