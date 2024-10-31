import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import HWorldParser from "data/worlds/parsers/hworld";
import { BlockIds, BLOCK_VERSION_REPLACEMENTS } from "data/blocks";
import zlib from "zlib";
import fs from "fs";
export interface WorldOptions {
    name: string;
    blocks?: Uint8Array;
    size: Vector3;
    spawn: EntityPosition;
    autosave: boolean;
}
export function getBlockIndex(position:Vector3, size: Vector3): number {
    const {x, y, z} = position;
    return x + (z*size.x) + (y*size.x*size.z);
}
export class World {
    private _blocks: Uint8Array;
    private _blocksView: DataView;
    public get blocks(): DataView {
        return new DataView(Object.freeze(this._blocks.subarray(0, this._blocks.length)).buffer);
    }
    autosave: boolean;
    name: string;
    size: Vector3;
    spawn: EntityPosition;
    constructor(options:WorldOptions) {
        this.name = options.name;
        this.size = options.size;
        this._blocks = options.blocks || new Uint8Array(this.size.product());
        this._blocksView = new DataView(this._blocks.buffer);
        this.autosave = options.autosave;
        this.spawn = options.spawn;
    }
    save(saveDir:string){
        const PARSER = new HWorldParser();
        const ENCODED = PARSER.encode(this);
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir);
        }
        fs.writeFileSync(`${saveDir}/${this.name}.hworld`, new DataView(ENCODED.buffer));
    }
    pack(): Uint8Array { // TODO: Caching (with minimal update cost), protocol replacements
        const totalSize = Math.floor(this.size.product());
        const data = new Uint8Array(totalSize+4);
        const dataView = new DataView(data.buffer);
        dataView.setUint32(this.size.x, 0, false);
        const currentBlocks = this.blocks;
        const airBlock = BlockIds.air;
        for (let i = 0; i < totalSize; i++) {
            dataView.setUint8(currentBlocks.getUint8(i) || airBlock, i+4);
        }
        const tempData = zlib.gzipSync(data);
        return new Uint8Array(tempData.buffer, tempData.byteOffset, tempData.byteLength);
    }
    setBlock(position: Vector3, blockId: number) {
        this._blocksView.setUint8(blockId, getBlockIndex(position, this.size));
    }
    getBlock(position: Vector3): number {
        return this._blocksView.getUint8(getBlockIndex(position, this.size));
    }
}

export default World;