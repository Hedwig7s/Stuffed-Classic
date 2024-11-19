import { WorldManager } from "data/worlds/worldmanager";
import { Config } from "data/config";
import { Server } from "networking/server";
import type { BaseProtocol } from "networking/protocol/baseprotocol";
import { Protocol7 } from "networking/protocol/7/protocol";
import { EntityRegistry } from "entities/entityregistry";
import World from 'data/worlds/world';
import EntityPosition from 'datatypes/entityposition';
import Vector3 from 'datatypes/vector3';
import * as pathlib from 'path';
import HWorldParser from "data/worlds/parsers/hworld";
import { DEFAULT_CONFIGS } from "data/constants";

export interface ConfigRecord {
    main: Config<typeof DEFAULT_CONFIGS.main>;
}

export interface ContextOptions  { // Used over parameters as it's easier to extend
    serverConfigName?: string;
}

export class ContextManager {
    public readonly worldManager: WorldManager;
    public readonly config: ConfigRecord;
    public readonly server: Server;
    public readonly entityRegistry: EntityRegistry;
    public readonly playerRegistry: EntityRegistry;
    public readonly protocols: Record<number, BaseProtocol>;
    // TODO: World generators
    public defaultWorld?: World;
    protected async setDefaultWorld() {
        this.defaultWorld = await World.fromFile(
            pathlib.join(this.config.main.config.worlds.worldDir, this.config.main.config.worlds.defaultWorld), 
            HWorldParser, 
            this) ?? new World({
                name: this.config.main.config.worlds.defaultWorld, 
                size: new Vector3(100, 60, 100), 
                spawn: new EntityPosition(0, 0, 0, 0, 0), 
                autosave: false,
                context: this
            });
        this.worldManager.addWorld(this.defaultWorld);
    }
    constructor({ serverConfigName }: ContextOptions = {}) {
        this.config = {
            main: new Config<typeof DEFAULT_CONFIGS.main>({
                defaultConfig: DEFAULT_CONFIGS.main, 
                name: serverConfigName ?? "server", 
                version: 1
            })
        };
        this.worldManager = new WorldManager(this);
        this.setDefaultWorld();
        this.server = new Server(this); 
        this.protocols = {
            [7]: new Protocol7(this)
        };
        this.entityRegistry = new EntityRegistry({ context: this });
        this.playerRegistry = new EntityRegistry({ context: this });
    }
}