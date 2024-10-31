import type { WorldOptions, World } from "data/worlds/world";
export default abstract class BaseParser {
    decode (data: Uint8Array): WorldOptions {
        throw new Error("Method not implemented.");
    }
    encode(world: World): Uint8Array {
        throw new Error("Method not implemented.");
    }
}