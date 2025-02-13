/*
    Interface for world format encoding and decoding
*/

import type { WorldOptions, World } from "data/worlds/world";
/**
 * Interface for world format encoding and decoding
*/
export default interface WorldParser {
    /** 
     * Decode raw data into a WorldOptions object
     * @param data The raw data to decode
     */
    decode(data: Uint8Array): Promise<Omit<WorldOptions, "context">>;
    /**
     * Encode a World object into raw data
     * @param world The world object to encode
     */
    encode(world: World): Promise<Uint8Array>;
}
