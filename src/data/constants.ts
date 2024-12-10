export const CONFIG_PATH = "./config";

export const DEFAULT_CONFIGS = {
    main: (await import("data/configs/main")).default,
};
