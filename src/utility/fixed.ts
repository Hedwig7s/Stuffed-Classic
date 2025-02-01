/*
    Simple helper functions for converting to and from fixed point numbers
*/

export function toFixed(precision: number, ...nums: number[]): number[];
export function toFixed(precision: number, num: number): number;
export function toFixed(
    precision: number,
    num: number | number[]
): number | number[] {
    if (typeof num === "number") {
        return num >> precision;
    } else {
        return num.map((n) => n >> precision);
    }
}

export function fromFixed(precision: number, ...nums: number[]): number[];
export function fromFixed(precision: number, num: number): number;
export function fromFixed(
    precision: number,
    num: number | number[]
): number | number[] {
    if (typeof num === "number") {
        return num << precision;
    } else {
        return num.map((n) => n << precision);
    }
}
