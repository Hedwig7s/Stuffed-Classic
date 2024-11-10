import type { World } from 'data/worlds/world';
import type { ContextManager } from 'contextmanager';

export class WorldManager {
    protected _worlds = new Map<string, World>();
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
    constructor(public readonly context: ContextManager) {}
}

export default WorldManager;
