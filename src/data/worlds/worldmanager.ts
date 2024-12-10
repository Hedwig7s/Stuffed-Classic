import type { World } from 'data/worlds/world';
import type { ContextManager } from 'contextmanager';

export interface WorldManagerOptions {
    context: ContextManager,
    autosave?: boolean,
    autosaveTime?: number,
}

export class WorldManager {
    protected _worlds = new Map<string, World>();
    public readonly context: ContextManager
    public autosave: boolean
    addWorld(world: World) {
        this._worlds.set(world.name, world);
        world.manager = this;
    }
    get worlds(): ReadonlyMap<string, World> {
        return Object.freeze(new Map(this._worlds));
    }
    getWorld(name: string): World|undefined {
        return this._worlds.get(name);
    }
    constructor({ context, autosave, autosaveTime }: WorldManagerOptions) {
        this.context = context;
        this.autosave = autosave ?? false;

        setInterval(()=> {
            if (this.autosave) {
                for (const world of this.worlds.values()) {
                    try {
                        world.save();
                    } catch(error) {
                        console.error(error);
                    }
                }
            }
        },autosaveTime ?? 30000)
    }
}

export default WorldManager;
