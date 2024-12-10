import type { WorldOptions, World } from "data/worlds/world";
export default abstract class BaseWorldParser {
    async decode(data: Uint8Array): Promise<Omit<WorldOptions, "context">> {
        throw new Error("Decode not implemented.");
    }
    async encode(world: World): Promise<Uint8Array> {
        throw new Error("Encode not implemented.");
    }
}