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
    scale(s: number): Vector3 {
        return new Vector3(this._x * s, this._y * s, this._z * s);
    }
    dot(v: Vector3): number {
        return this._x * v.x + this._y * v.y + this._z * v.z;
    }
    cross(v: Vector3): Vector3 {
        return new Vector3(this._y * v.z - this._z * v.y, this._z * v.x - this._x * v.z, this._x * v.y - this._y * v.x);
    }
    magnitude(): number {
        return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z);
    }
    normalize(): Vector3 {
        const mag = this.magnitude();
        return new Vector3(this._x / mag, this._y / mag, this._z / mag);
    }
    distance(v: Vector3): number {
        return this.subtract(v).magnitude();
    }
    angle(v: Vector3): number {
        return Math.acos(this.dot(v) / (this.magnitude() * v.magnitude()));
    }
    toString(): string {
        return `${this._x},${this._y},${this._z}`;
    }
    product(): number {
        return this._x * this._y * this._z;
    }
    static get zero(): Vector3 {
        return new Vector3(0, 0, 0);
    }
    static get one(): Vector3 {
        return new Vector3(1, 1, 1);
    }
    static get up(): Vector3 {
        return new Vector3(0, 1, 0);
    }
    static get down(): Vector3 {
        return new Vector3(0, -1, 0);
    }
    static get left(): Vector3 {
        return new Vector3(-1, 0, 0);
    }
    static get right(): Vector3 {
        return new Vector3(1, 0, 0);
    }
    static get forward(): Vector3 {
        return new Vector3(0, 0, 1);
    }
    static get back(): Vector3 {
        return new Vector3(0, 0, -1);
    }
}