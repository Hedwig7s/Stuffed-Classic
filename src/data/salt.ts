/*
    Functions for generating, caching, and retrieving the salt for the server list
*/
import { CONFIG_PATH } from "./configs/constants";
import crypto from "crypto";

const letters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Get a random cryptographically secure number between min and max
 * @param min Minimum value
 * @param max Maximum exclusive value
 * @returns
 */
function randomCryptNumber(min: number, max: number) {
    if (min >= max) {
        throw new Error(
            "The minimum value must be less than the maximum value."
        );
    }

    const range = max - min;
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);

    const scaledRandomNumber =
        Math.floor((randomNumber / 0xffffffff) * range) + min;

    return scaledRandomNumber;
}

/**
 * Generate a random salt
 * @param length Length of the salt
 * @returns
 */
export function generateSalt(length = 32): string {
    const result = [];
    for (let i = 0; i < length; i++) {
        result.push(
            letters.charAt(Math.floor(randomCryptNumber(0, letters.length)))
        );
    }
    return result.join("");
}

/**
 * Write the salt to a file
 * @param salt Salt to write
 * @param path Path to write the salt to
 */
export async function writeSalt(
    salt: string,
    path = `${CONFIG_PATH}/cachedsalt.txt`
) {
    const file = Bun.file(path);
    await file.write(`${salt}\n${Date.now()}`);
}

/**
 * Get the salt from the cache or generate a new one
 * @param length Length of the salt
 * @param path Path to the cached salt
 * @returns
 */
export async function getSalt(
    length = 32,
    path = `${CONFIG_PATH}/cachedsalt.txt`
): Promise<string> {
    const file = Bun.file(path);
    if (await file.exists()) {
        const data = await file.text();
        const [salt, lastUsed] = data.split("\n");
        if (Date.now() - parseInt(lastUsed) <= 300000) {
            return salt;
        }
    }
    const salt = generateSalt(length);
    writeSalt(salt);
    return salt;
}
