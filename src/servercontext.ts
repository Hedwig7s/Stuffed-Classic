import Config from "data/config/config";
import { DEFAULT_CONFIGS, PROTOCOLS } from "data/configs/constants";
import World from "data/worlds/world";
import WorldManager from "data/worlds/worldmanager";
import pathlib from "path";
import HWorldParser from "data/worlds/parsers/hworld";
import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import Server from "networking/server";
import { EntityRegistry } from "entities/entityregistry";
import type { Protocol } from "networking/protocol/protocol";
import { ServiceRegistry } from "utility/serviceregistry";
import { Chatroom } from "chat/chatroom";

export interface ConfigRecord {
    server: Config<typeof DEFAULT_CONFIGS.server>;
}

export interface ServerContext {
    worldManager: WorldManager;
    config: ConfigRecord;
    server: Server;
    entityRegistry: EntityRegistry;
    globalChatroom: Chatroom;
    protocols: Record<number, Protocol>;
    serviceRegistry: ServiceRegistry<ServiceMap>;
}

export type ServiceMap = Omit<
    ServerContext,
    "serviceRegistry" | "protocols" | "config"
>;

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
    const serviceRegistry = new ServiceRegistry<ServiceMap>();
    const configRecord: ConfigRecord = getConfigRecord();
    for (const config of Object.values(configRecord)) {
        config.loadSync();
    }
    const worldManager = new WorldManager({ autosave: true });
    serviceRegistry.register("worldManager", worldManager);
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

    const server = new Server(PROTOCOLS, serviceRegistry);
    serviceRegistry.register("server", server);
    const entityRegistry = new EntityRegistry();
    serviceRegistry.register("entityRegistry", entityRegistry);
    const globalChatroom = new Chatroom("Global");
    serviceRegistry.register("globalChatroom", globalChatroom);

    const serverContext: ServerContext = {
        worldManager,
        config: configRecord,
        server,
        entityRegistry,
        protocols: PROTOCOLS,
        serviceRegistry,
        globalChatroom,
    };
    return serverContext;
}
