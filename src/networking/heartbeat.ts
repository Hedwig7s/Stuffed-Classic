/*
    Send a heartbeat to the server list with the server's information
*/
import type { Config } from "data/config/config";
import { METADATA } from "data/configs/constants";
import type serverConfig from "data/configs/server";
import { writeSalt } from "data/salt";
import type { PlayerRegistry } from "player/playerregistry";
import { getSimpleLogger } from "utility/logger";
import type { ServiceRegistry } from "utility/serviceregistry";

/** Send heartbeats to a server list using the classicube format */
export class Heartbeat {
    public readonly logger = getSimpleLogger("Heartbeat");
    /**
     * Create a Heartbeat instance
     * @param salt The server's salt for name verification
     * @param serviceRegistry Service registry. Used to get player registry for player count
     * @param config Server configuration, used for server information
     * @param url The URL to send the heartbeat to
     * @param interval The interval to send heartbeats at in milliseconds
     */
    constructor(
        public salt: string,
        public readonly serviceRegistry: ServiceRegistry<{
            playerRegistry: PlayerRegistry;
        }>,
        public readonly config: Config<typeof serverConfig>,
        public url = "https://www.classicube.net/server/heartbeat",
        public interval = 10000
    ) {}
    public running = false;
    protected intervalTimer?: Timer;
    public gameUrl = "";
    /** Send a heartbeat */
    async send() {
        let players = this.serviceRegistry.get("playerRegistry")?.players.size;
        if (players === undefined) {
            players = 0;
            this.logger.warn("Player registry not found");
        }
        const config = this.config.data;
        const data = {
            salt: this.salt,
            port: config.server.port,
            users: players,
            max: config.server.maxPlayers,
            name: config.server.name,
            public: config.server.public ? "true" : "false",
            software: `${METADATA.softwareName} ${METADATA.version}`,
        };
        const partialUrl = [this.url, "?"];
        for (const key of Object.keys(data)) {
            partialUrl.push(`${key}=${data[key as keyof typeof data]}&`);
        }
        const url = encodeURI(partialUrl.join("").slice(0, -1));
        const request = new Request(url, {
            method: "GET",
        });
        try {
            const response = await fetch(request);
            const body = await response.text();
            if (response.status !== 200) {
                this.logger.warn(
                    `Heartbeat failed with status ${response.status} ${response.statusText}: ${body}`
                );
            } else if (
                body.startsWith("{") &&
                this.url.search("classicube.net") !== -1
            ) {
                this.logger.warn(`Heartbeat failed: ${body}`);
            } else if (body !== this.gameUrl) {
                this.logger.info(`Game URL: ${body}`);
                this.gameUrl = body;
            }
        } catch (error) {
            this.logger.error(error);
        }
        writeSalt(this.salt);
    }
    /** Start sending heartbeats */
    start() {
        if (this.running) return;
        this.running = true;
        this.intervalTimer = setInterval(() => {
            if (!this.running) {
                if (this.intervalTimer) {
                    clearInterval(this.intervalTimer);
                    this.intervalTimer = undefined;
                }
                return;
            }
            this.send();
        }, this.interval);
    }
    /** Stop sending heartbeats */
    stop() {
        this.running = false;
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = undefined;
        }
    }
}
