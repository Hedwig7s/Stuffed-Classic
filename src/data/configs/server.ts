/*
    Main server configuration format and defaults
*/
export const serverConfig = {
    server: {
        host: "0.0.0.0",
        port: 25565,
        name: "Stuffed Classic",
        motd: "Welcome to Stuffed Classic",
        maxPlayers: 10,
        public: false,
        verifyNames: true,
        allowUnverifiedLocalNames: true,
    },
    worlds: {
        worldDir: "./worlds",
        defaultWorld: "world",
    },
    heartbeat: {
        url: "https://www.classicube.net/server/heartbeat",
        enabled: true,
    },
};

export default serverConfig;
