import { CONFIG_PATH } from "./configs/constants";

const letters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateSalt(length = 32): string {
    const result = [];
    for (let i = 0; i < length; i++) {
        result.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    }
    return result.join("");
}

export async function writeSalt(
    salt: string,
    path = `${CONFIG_PATH}/cachedsalt.txt`
) {
    const file = Bun.file(path);
    await file.write(`${salt}\n${Date.now()}`);
}

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
