export const CONFIG_PATH = "./config";

export const DEFAULT_CONFIGS = {
    server: (await import("data/configs/server")).default,
};

export const PROTOCOLS = {
    [0x07]: (await import("networking/protocol/7/protocol")).protocol7,
};
