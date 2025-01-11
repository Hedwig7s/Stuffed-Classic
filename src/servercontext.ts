import Config from "data/config";
import { DEFAULT_CONFIGS, PROTOCOLS } from "data/constants";
import World from "data/worlds/world";
import WorldManager from "data/worlds/worldmanager";
import pathlib from "path";
import HWorldParser from "data/worlds/parsers/hworld";
import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import Server from "networking/server";
import { EntityRegistry } from "entities/entityregistry";
import type { Protocol } from "networking/protocol/protocol";

export interface ConfigRecord {
    server: Config<typeof DEFAULT_CONFIGS.server>;
}

export interface ServerContext {
    worldManager: WorldManager;
    config: ConfigRecord;
    server: Server;
    entityRegistry: EntityRegistry;
    protocols: Record<number, Protocol>;
}

export function getConfigRecord(): ConfigRecord {
    return {
        server: new Config({
            defaultConfig: DEFAULT_CONFIGS.server,
            name: "server",
            version: 1,
            autosave: true,
        }),
    };
}

export async function getServerContext(): Promise<ServerContext> {
    const configRecord: ConfigRecord = getConfigRecord();
    for (const config of Object.values(configRecord)) {
        config.loadSync();
    }
    const worldManager = new WorldManager({ autosave: true });
    const defaultWorld = await World.fromFileWithDefault(
        {
            filePath: pathlib.join(
                configRecord.server.config.worlds.worldDir,
                configRecord.server.config.worlds.defaultWorld + ".hworld"
            ),
            parserClass: HWorldParser,
            serverConfig: configRecord.server,
        },
        {
            name: configRecord.server.config.worlds.defaultWorld,
            size: new Vector3(100, 100, 100),
            spawn: new EntityPosition(0, 0, 0, 0, 0),
            serverConfig: configRecord.server,
        }
    );
    worldManager.setDefaultWorld(defaultWorld);

    const server = new Server(PROTOCOLS);
    const entityRegistry = new EntityRegistry();

    const serverContext: ServerContext = {
        worldManager,
        config: configRecord,
        server,
        entityRegistry,
        protocols: PROTOCOLS,
    };
    return serverContext;
}
