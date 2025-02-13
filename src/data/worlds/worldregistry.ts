/*
    Registry for worlds. Also manages autosaving
*/
import type { World } from "data/worlds/world";
import { getSimpleLogger } from "utility/logger";
import pino from "pino";

/** Options for creating a world registry */
export interface WorldRegistryOptions {
    /** Whether to automatically save worlds in the registry. Defaults to true */
    autosave?: boolean;
    /** Autosave interval in milliseconds */
    autosaveTime?: number;
    /** Default world for the registry. Can be set later */
    defaultWorld?: World;
}

/** Registry for worlds */
export class WorldRegistry {
    protected _worlds = new Map<string, World>();
    public autosave: boolean;
    public readonly logger: pino.Logger;
    protected _defaultWorld?: World;
    public get defaultWorld() {
        return this._defaultWorld;
    }
    /**
     * Sets the default world, registering it if it is not already registered
     * @param world
     */
    public setDefaultWorld(world: World | undefined) {
        const existing = world ? this.getWorld(world.name) : undefined;
        if (world === undefined || existing === world) {
            this._defaultWorld = world;
            return;
        }
        if (existing !== undefined && existing !== world) {
            throw new Error("Duplicate world");
        }
        this.addWorld(world);
        this._defaultWorld = world;
    }

    /**
     * Adds a world to the registry
     * @param world
     * @throws Error if a world with the same name is already registered
     */
    addWorld(world: World) {
        if (this._worlds.get(world.name)) {
            throw new Error("Duplicate world");
        }
        this._worlds.set(world.name, world);
        world.manager = this;
    }
    get worlds(): ReadonlyMap<string, World> {
        return Object.freeze(new Map(this._worlds));
    }
    /**
     * Gets a world from the registry
     * @param name
     * @returns The world with the given name, or undefined if it does not exist
     */
    getWorld(name: string): World | undefined {
        return this._worlds.get(name);
    }
    constructor({
        autosave,
        autosaveTime,
        defaultWorld,
    }: WorldRegistryOptions) {
        this.autosave = autosave ?? false;
        this.logger = getSimpleLogger("WorldManager");
        this.setDefaultWorld(defaultWorld);
        setInterval(() => {
            if (this.autosave) {
                for (const world of this.worlds.values()) {
                    try {
                        world.save();
                    } catch (error) {
                        this.logger.error(error);
                    }
                }
            }
        }, autosaveTime ?? 30000);
    }
}

export default WorldRegistry;
