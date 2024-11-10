import type { WorldOptions, World } from "data/worlds/world";
import { NotImplementedError } from "utility/genericerrors";
export default abstract class BaseWorldParser {
    decode (data: Uint8Array): WorldOptions {
        throw new NotImplementedError("Decode not implemented.");
    }
    encode(world: World): Uint8Array {
        throw new NotImplementedError("Encode not implemented.");
    }
}