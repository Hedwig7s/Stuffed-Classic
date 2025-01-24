import type { Config } from "data/config/config";
import { METADATA } from "data/configs/constants";
import type serverConfig from "data/configs/server";
import { writeSalt } from "data/salt";
import type { ServiceMap } from "servercontext";
import { getSimpleLogger } from "utility/logger";
import type { ServiceRegistry } from "utility/serviceregistry";

export class Heartbeat {
    public readonly logger = getSimpleLogger("Heartbeat");
    constructor(
        public salt: string,
        public readonly serviceRegistry: ServiceRegistry<ServiceMap>,
        public readonly config: Config<typeof serverConfig>,
        public url = "https://www.classicube.net/server/heartbeat",
        public interval = 10000,
    ) {}
    public running = false;
    public gameUrl = "";
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
            if (response.status !== 200 ) {
                this.logger.warn(`Heartbeat failed with status ${response.status} ${response.statusText}: ${body}`);
            } else if (body.startsWith("{") && this.url.search("classicube.net") !== -1) {
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
    start() {
        if (this.running) return;
        this.running = true;
        const interval = setInterval(() => {
            if (!this.running) {
                clearInterval(interval);
                return;
            }
            this.send();
        }, this.interval);
    }
    stop() {
        this.running = false;
    }
}