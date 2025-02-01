/*
    Interface for world format encoding and decoding
*/

import type { WorldOptions, World } from "data/worlds/world";
export default interface WorldParser {
    decode(data: Uint8Array): Promise<Omit<WorldOptions, "context">>;
    encode(world: World): Promise<Uint8Array>;
}
