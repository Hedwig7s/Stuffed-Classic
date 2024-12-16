import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import HWorldParser from "data/worlds/parsers/hworld";
import { BlockIds, BLOCK_VERSION_REPLACEMENTS } from "data/blocks";
import zlib from "zlib";
import fs from "fs";
import * as pathlib from "path";
import type { Entity } from "entities/entity";
import type WorldManager from "./worldmanager";
import type { ContextManager } from "contextmanager";
import type BaseWorldParser from "./parsers/base";
import { ParserBuilder } from "utility/dataparser";
import { concatUint8Arrays } from "uint8array-extras";
import Player from "entities/player";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";

export interface WorldOptions {
    name: string;
    blocks?: Uint8Array;
    size: Vector3;
    spawn: EntityPosition;
    context: ContextManager;
}

export interface WorldFromFileOptions {
    filePath: string;
    parserClass?: new () => BaseWorldParser;
    context: ContextManager;
}

export function getBlockIndex(position: Vector3, size: Vector3): number {
    const { x, y, z } = position;
    return x + z * size.x + y * size.x * size.z;
}

export interface CachedPack {
    data: Uint8Array;
    lastUpdate: number;
}

export class World {
    protected _blocks: Uint8Array;
    public get blocks(): Uint8Array {
        return new Uint8Array(this._blocks);
    }
    name: string;
    size: Vector3;
    spawn: EntityPosition;
    lastUpdate: number;
    entities = new Map<number, Entity>();
    manager?: WorldManager;
    public readonly context: ContextManager;
    public readonly logger: pino.Logger;

    constructor({ name, size, spawn, blocks, context }: WorldOptions) {
        this.logger = getSimpleLogger("World "+name);
        this.name = name;
        this.size = size;
        this._blocks = new Uint8Array(this.size.product()).fill(0);
        if (blocks) {
            this._blocks.set(blocks);
        }
        this.spawn = spawn;
        this.lastUpdate = Date.now();
        this.context = context;
    }

    static async fromFile({
        filePath,
        parserClass,
        context,
    }: WorldFromFileOptions): Promise<World> {
        if (!(await fs.promises.exists(filePath))) {
            throw new Error("File not found.");
        }
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const Parser = parserClass ?? HWorldParser;
        const data = new Uint8Array(await fs.promises.readFile(filePath));
        const parser = new Parser();
        const options = (await parser.decode(data)) as WorldOptions;
        options.context = context;
        options.name =
            options.name !== ""
                ? options.name
                : pathlib.basename(filePath, pathlib.extname(filePath));
        return new World(options);
    }

    async pack(
        protocolVersion: number,
        callback?: (data: Uint8Array, size: number, percent: number) => void
    ) {
        const gzip = zlib.createGzip();
        const chunkLength = 1024;
        const levelSize = this.size.product();
        const buffers: Uint8Array[] = [];
        let percentage = 0;
        let length = 0;
        let sentOffset = 0;

        const promise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Gzip timeout"));
            }, 20000);
            let sendingData = false;
            let queuePad = false;
            const sendData = function (pad = false) {
                if (!callback) return;
                if (sendingData) {
                    queuePad = queuePad || pad;
                    return;
                }
                sendingData = true;
                let buffer: Uint8Array | undefined = undefined;
                while (
                    sentOffset < length &&
                    length - sentOffset >= chunkLength
                ) {
                    if (!buffer) {
                        buffer = concatUint8Arrays(buffers);
                    }
                    const subarray = buffer.subarray(
                        sentOffset,
                        sentOffset + chunkLength
                    );
                    callback(subarray, subarray.byteLength, percentage);
                    sentOffset += subarray.byteLength;
                }
                if ((pad || queuePad) && sentOffset < length) {
                    queuePad = false;
                    if (!buffer) {
                        buffer = concatUint8Arrays(buffers);
                    }
                    const padded = new Uint8Array(chunkLength).fill(0);
                    const remaining = length - sentOffset;
                    const subarray = buffer.subarray(sentOffset, remaining);
                    padded.set(subarray);
                    callback(padded, remaining, percentage);
                    sentOffset += remaining;
                }
                sendingData = false;
            };
            gzip.on("data", (data) => {
                const dataArray = new Uint8Array(data);
                buffers.push(data);
                length += dataArray.byteLength;
                sendData();
            });

            gzip.on("end", () => {
                sendData(true);
                clearTimeout(timeout);
                resolve();
            });
            const headerParser = new ParserBuilder<{levelSize: number}>()
                .bigEndian()
                .int32("levelSize")
                .build();
            gzip.write(headerParser.encode({ levelSize: levelSize }));
            let i = 0;
            let array = new Uint8Array(chunkLength);
            for (const block of this._blocks) {
                // TODO: Protocol block replacements
                array[i % 1024] = block;
                if (i % chunkLength === 0) {
                    percentage = Math.round((i / levelSize) * 100);
                }
                if (i === levelSize - 1) {
                    gzip.write(array, () => {
                        gzip.end();
                    });
                } else if (i % chunkLength === 0 && i !== 0) {
                    gzip.write(array);
                    array = new Uint8Array(chunkLength);
                }
                i++;
            }
        });
        await promise;
        return concatUint8Arrays(buffers).subarray(0, length);
    }

    setBlock(position: Vector3, blockId: number) {
        const index = getBlockIndex(position, this.size);
        this._blocks[index] = blockId;
        this.lastUpdate = Date.now();

    }
    getBlock(position: Vector3) {
        const index = getBlockIndex(position, this.size);
        return this._blocks[index];
    }

    async save(saveDir?: string) {
        const PARSER = new HWorldParser();
        const ENCODED = await PARSER.encode(this);
        const saveDirectory =
            saveDir ?? this.context?.config.main.config.worlds.worldDir;
        if (saveDirectory == null) {
            throw new Error("World save directory not set");
        }
        await fs.promises.mkdir(saveDirectory, { recursive: true });
        await fs.promises.writeFile(
            `${saveDirectory}/${this.name}.hworld`,
            ENCODED
        );
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
        throw new Error("Too many entities");
    }

    unregisterEntity(entity: Entity) {
        if (entity.worldEntityId < 0) {
            throw new Error("Entity is not registered");
        }
        this.entities.delete(entity.worldEntityId);
        entity.worldEntityId = -1;
    }
}

export default World;
