/*
    Registry for worlds. Also manages autosaving
*/
import type { World } from "data/worlds/world";
import { getSimpleLogger } from "utility/logger";
import pino from "pino";

export interface WorldRegistryOptions {
    autosave?: boolean;
    autosaveTime?: number;
    defaultWorld?: World;
}

export class WorldRegistry {
    protected _worlds = new Map<string, World>();
    public autosave: boolean;
    public readonly logger: pino.Logger;
    protected _defaultWorld?: World;
    public get defaultWorld() {
        return this._defaultWorld;
    }
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
