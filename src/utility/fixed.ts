/*
    Simple helper functions for converting to and from fixed point numbers
*/

/**
 * Convert a number to a fixed point number
 * @param precision The number of bits to shift the number by
 * @param nums The numbers to convert
 * @returns The fixed point numbers
 */
export function toFixed(precision: number, ...nums: number[]): number[];
/**
 * Convert a number to a fixed point number
 * @param precision The number of bits to shift the number by
 * @param num The number to convert
 * @returns The fixed point number
 */
export function toFixed(precision: number, num: number): number;
/**
 * Convert a number to a fixed point number
 * @param precision The number of bits to shift the number by
 * @param num The number or numbers to convert
 * @returns The fixed point number or numbers
 */
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

/**
 * Convert a fixed point number to a floating point number
 * @param precision The number of bits to shift the number by
 * @param nums The numbers to convert
 * @returns The floating point numbers
 */
export function fromFixed(precision: number, ...nums: number[]): number[];
/**
 * Convert a fixed point number to a floating point number
 * @param precision The number of bits to shift the number by
 * @param num The number to convert
 * @returns The floating point number
 */
export function fromFixed(precision: number, num: number): number;
/**
 * Convert a fixed point number to a floating point number
 * @param precision The number of bits to shift the number by
 * @param num The number or numbers to convert
 * @returns The floating point number or numbers
 */
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
