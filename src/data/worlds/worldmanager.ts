import type { World } from 'data/worlds/world';
import type { Context } from 'context';

export class WorldManager {
    private _worlds = new Map<string, World>();
    addWorld(world: World) {
        this._worlds.set(world.name, world);
    }
    get worlds(): ReadonlyMap<string, World> {
        return Object.freeze(new Map(this._worlds));
    }
    getWorld(name: string): World|undefined {
        return this._worlds.get(name);
    }

    constructor(public readonly worldDir:string, public readonly context: Context) {}
}

export default WorldManager;
