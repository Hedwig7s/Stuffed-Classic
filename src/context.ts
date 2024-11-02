import { WorldManager } from "data/worlds/worldmanager";
import { Config } from "data/config";
import { Server } from "networking/server";
import type { Protocol } from "networking/protocol/protocol";
import { Protocol7 } from "networking/protocol/protocol7";

export interface ConfigRecord {
    server: Config;
}

export interface ContextOptions  { // Used over parameters as it's easier to extend
    serverConfigName?: string;
}

const DEFAULT_CONFIGS: Record<string, Record<string, any>> = {
    server: {},
};

export class Context {
    public readonly worldManager: WorldManager;
    public readonly config: ConfigRecord;
    public readonly server: Server;
    public readonly protocols: Record<number, Protocol>;
    constructor({ serverConfigName }: ContextOptions = {}) {
        this.config = {
            server: new Config({
                defaultConfig: DEFAULT_CONFIGS.serverConfig, 
                name: serverConfigName ?? "server", 
                version: 1
            })
        };
        this.worldManager = new WorldManager("./worlds", this); // TODO: Use config for world directory
        this.server = new Server("localhost", 25565, this); // TODO: Use config for host and port
        this.protocols = {
            [7]: new Protocol7(this)
        };
    }
}