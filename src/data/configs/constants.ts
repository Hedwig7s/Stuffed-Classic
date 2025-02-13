/*
    Constants across the whole program.
*/

export const CONFIG_PATH = "./config";

/**
 * The default configurations for the server.
 */
export const DEFAULT_CONFIGS = {
    server: (await import("data/configs/server")).default,
};

/**
 * List of all the protocols supported by the server.
 * TODO: Potentially move to a more dynamic system as plugins may want to register a protocol
 */
export const PROTOCOLS = {
    [0x07]: (await import("networking/protocol/7/protocol")).protocol7,
};

/**
 * The metadata for the server.
 */
export const METADATA = {
    version: "v0.2.0-alpha",
    softwareName: "Stuffed-Classic",
};
