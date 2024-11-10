import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import HWorldParser from "data/worlds/parsers/hworld";
import { BlockIds, BLOCK_VERSION_REPLACEMENTS } from "data/blocks";
import zlib from "zlib";
import fs from "fs";
import * as pathlib from "path";
import type { Entity } from "entities/entity";
import { OutOfCapacityError, ValueError } from "utility/genericerrors";
import type WorldManager from "./worldmanager";
import type { ContextManager } from "contextmanager";
import type BaseWorldParser from "./parsers/base";

export interface WorldOptions {
    name: string;
    blocks?: Uint8Array;
    size: Vector3;
    spawn: EntityPosition;
    autosave: boolean;
    context?: ContextManager;
}

export function getBlockIndex(position: Vector3, size: Vector3): number {
    const { x, y, z } = position;
    return x + (z * size.x) + (y * size.x * size.z);
}

export interface CachedPack {
    data: Uint8Array;
    lastUpdate: number;
}

export class World {
    protected _blocks: Uint8Array;
    protected _blocksView: DataView;
    public get blocks(): DataView {
        return new DataView(Object.freeze(this._blocks.subarray(0, this._blocks.length)).buffer);
    }
    autosave: boolean;
    name: string;
    size: Vector3;
    spawn: EntityPosition;
    lastUpdate: number;
    entities = new Map<number, Entity>();
    manager?: WorldManager;
    public readonly context?: ContextManager;
    protected packedCache = new Map<number, CachedPack>();
    protected dirtyIndices = new Map<number, number>(); // blockIndex -> timestamp of change

    constructor({ name, size, spawn, blocks, autosave, context }: WorldOptions) {
        this.name = name;
        this.size = size;
        this._blocks = blocks || new Uint8Array(this.size.product()).fill(0);
        this._blocksView = new DataView(this._blocks.buffer);
        this.autosave = autosave;
        this.spawn = spawn;
        this.lastUpdate = Date.now();
        this.context = context;
    }

    static async fromFile(filePath: string, Parser: new () => BaseWorldParser = HWorldParser, context?: ContextManager): Promise<World|null> {
        if (!await fs.promises.exists(filePath)) {
            return null;
        }
        const data = new Uint8Array(await fs.promises.readFile(filePath));
        const parser = new Parser();
        const options = parser.decode(data);
        options.context = context;
        options.name = options.name !== "unnamed" ? options.name : pathlib.basename(filePath, pathlib.extname(filePath));
        return new World(options);

    }

    
    protected _setPackedBlock(index: number, blockId: number, protocolVersion:number, dataView: DataView) {
        // TODO: Protocol block replacements
        dataView.setUint8(index, blockId);
    }
    protected _buildOrUpdatePack(protocolVersion:number, existingPack?: CachedPack): Uint8Array {
        const totalSize = Math.floor(this.size.product());
        const existingData = existingPack?.data;
        const result = existingData ? new Uint8Array(existingData) : new Uint8Array(totalSize + 4);
        const dataView = new DataView(result.buffer);
        
        dataView.setUint32(0, totalSize, false);
    
        const indicesToProcess = existingData 
            ? Array.from(this.dirtyIndices.keys(), (index, timestamp) => {return timestamp < existingPack.lastUpdate ? undefined : index;})
                   .filter(index => index !== undefined)
            : Array.from({ length: totalSize }, (_, i) => i);
        
        for (const index of indicesToProcess) {
            this._setPackedBlock(
                index + 4, 
                this._blocksView.getUint8(index), 
                protocolVersion,
                dataView
            );
        }
        
        return result;
    }

    pack(protocolVersion = 7): Uint8Array {
        const cached = this.packedCache.get(protocolVersion);
        const currentTime = this.lastUpdate;
        
        let uncompressed: Uint8Array;
        if (cached?.lastUpdate === currentTime) {
            uncompressed = cached.data;
        } else if (cached && this.dirtyIndices.size < 1000) { // Arbitrary threshold for full rebuild
            uncompressed = this._buildOrUpdatePack(protocolVersion,cached);
        } else {
            uncompressed = this._buildOrUpdatePack(protocolVersion);
        }
        
        this.packedCache.set(protocolVersion, {
            data: uncompressed,
            lastUpdate: currentTime
        });
        
        const compressed = zlib.gzipSync(uncompressed);
        return new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength);
    }

    setBlock(position: Vector3, blockId: number) {
        const index = getBlockIndex(position, this.size);
        this._blocksView.setUint8(index, blockId);
        this.lastUpdate = Date.now();
        this.dirtyIndices.set(index, this.lastUpdate);
        
        // Clean up old changes that have been applied to all protocol versions
        const oldestCacheUpdate = Math.min(...Array.from(this.packedCache.values())
            .map(cache => cache.lastUpdate));
            
        // Remove changes that are older than all caches
        for (const [index, timestamp] of this.dirtyIndices) {
            if (timestamp <= oldestCacheUpdate) {
                this.dirtyIndices.delete(index);
            }
        }
    }

    async save(saveDir?: string) {
        const PARSER = new HWorldParser();
        const ENCODED = PARSER.encode(this);
        const saveDirectory = saveDir ?? this.context?.config.main.config.worlds.worldDir;
        if (!saveDirectory) {
            throw new Error("World save directory not set");
        }
        await fs.promises.mkdir(saveDirectory, { recursive: true });
        await fs.promises.writeFile(`${saveDir}/${this.name}.hworld`, new DataView(ENCODED.buffer));
    }

    registerEntity(entity: Entity) {
        for (let i = 0; i < 128; i++) {
            const current = this.entities.get(i);
            if (current == null || current.destroyed) {
                this.entities.set(i, entity);
                entity.worldEntityId = i;
                return;
            }
        }
        throw new OutOfCapacityError("Too many entities");
    }

    unregisterEntity(entity: Entity) {
        if (entity.worldEntityId < 0) {
            throw new ValueError("Entity is not registered");
        }
        this.entities.delete(entity.worldEntityId);
        entity.worldEntityId = -1;
    }
}

export default World;