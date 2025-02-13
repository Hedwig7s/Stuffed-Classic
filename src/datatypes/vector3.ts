/*
    Represents a 3D point in space
*/
import { fromFixed, toFixed } from "utility/fixed";
/**
 * Represents a 3D point in space
 */
export default class Vector3 {
    protected _x: number;
    protected _y: number;
    protected _z: number;
    get x(): number {
        return this._x;
    }
    get y(): number {
        return this._y;
    }
    get z(): number {
        return this._z;
    }
    constructor(x: number, y: number, z: number) {
        this._x = x;
        this._y = y;
        this._z = z;
    }
    add(v: Vector3): Vector3 {
        return new Vector3(this._x + v.x, this._y + v.y, this._z + v.z);
    }
    subtract(v: Vector3): Vector3 {
        return new Vector3(this._x - v.x, this._y - v.y, this._z - v.z);
    }
    multiply(v: Vector3): Vector3 {
        return new Vector3(this._x * v.x, this._y * v.y, this._z * v.z);
    }
    divide(v: Vector3): Vector3 {
        return new Vector3(this._x / v.x, this._y / v.y, this._z / v.z);
    }
    /**
     * Scale the vector by a scalar
     * @param s The scalar to scale by
     */
    scale(s: number): Vector3 {
        return new Vector3(this._x * s, this._y * s, this._z * s);
    }
    /**
     * Get the dot product of this vector and another
     * @param v The other vector
     * @returns The dot product
     */
    dot(v: Vector3): number {
        return this._x * v.x + this._y * v.y + this._z * v.z;
    }
    /**
     * Get the cross product of this vector and another
     * @param v The other vector
     * @returns The cross product
     */
    cross(v: Vector3): Vector3 {
        return new Vector3(
            this._y * v.z - this._z * v.y,
            this._z * v.x - this._x * v.z,
            this._x * v.y - this._y * v.x
        );
    }
    /**
     * Get the magnitude of the vector
     * @returns The magnitude of the vector
     */
    magnitude(): number {
        return Math.sqrt(
            this._x * this._x + this._y * this._y + this._z * this._z
        );
    }
    /**
     * Normalize the vector
     * @returns The normalized vector
     */
    normalize(): Vector3 {
        const mag = this.magnitude();
        return new Vector3(this._x / mag, this._y / mag, this._z / mag);
    }
    /**
     * Get the distance between this vector and another
     * @param v The other vector
     * @returns The distance between the two vectors
     */
    distance(v: Vector3): number {
        return this.subtract(v).magnitude();
    }
    /**
     * Get the angle between this vector and another
     * @param v The other vector
     * @returns The angle between the two vectors
     */
    angle(v: Vector3): number {
        return Math.acos(this.dot(v) / (this.magnitude() * v.magnitude()));
    }
    toString(): string {
        return `${this._x},${this._y},${this._z}`;
    }
    /**
     * Convert to fixed point representation with a given precision. Mainly used for packets
     * @param precision Fixed point precision
     * @returns The fixed point representation
     */
    toFixed(precision: number): Vector3 {
        return new Vector3(
            ...(toFixed(precision, this._x, this._y, this._z) as [
                number,
                number,
                number,
            ])
        );
    }
    /**
     * Convert from fixed point representation with a given precision. Mainly used for packets
     * @param precision Fixed point precision
     * @returns The floating point representation
     */
    fromFixed(precision: number): Vector3 {
        return new Vector3(
            ...(fromFixed(precision, this._x, this._y, this._z) as [
                number,
                number,
                number,
            ])
        );
    }
    /**
     * Get the product of the components of the vector
     * @returns The product of the components
     */
    product(): number {
        return this._x * this._y * this._z;
    }
    static zero(): Vector3 {
        return new Vector3(0, 0, 0);
    }
    static one(): Vector3 {
        return new Vector3(1, 1, 1);
    }
    static up(): Vector3 {
        return new Vector3(0, 1, 0);
    }
    static down(): Vector3 {
        return new Vector3(0, -1, 0);
    }
    static left(): Vector3 {
        return new Vector3(-1, 0, 0);
    }
    static right(): Vector3 {
        return new Vector3(1, 0, 0);
    }
    static forward(): Vector3 {
        return new Vector3(0, 0, 1);
    }
    static back(): Vector3 {
        return new Vector3(0, 0, -1);
    }
}
