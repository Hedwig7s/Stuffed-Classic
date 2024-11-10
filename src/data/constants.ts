export const CONFIG_PATH = "./config";

export const DEFAULT_CONFIGS = {
    main: {
        server: {
            host: "0.0.0.0",
            port: 25565,
            name: "Stuffed Classic",
            motd: "Welcome to Stuffed Classic",
            maxPlayers: 10,
        },
        worlds: {
            worldDir: "./worlds",
            defaultWorld: "world"
        }
    },
};
