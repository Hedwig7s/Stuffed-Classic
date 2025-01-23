import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import HWorldParser from "data/worlds/parsers/hworld";
import zlib from "zlib";
import fs from "fs";
import * as pathlib from "path";
import type { Entity } from "entities/entity";
import type WorldManager from "./worldmanager";
import type WorldParser from "./parsers/base";
import { StructuredParserBuilder } from "utility/datastruct";
import { concatUint8Arrays } from "uint8array-extras";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";
import { PacketIds } from "networking/packet/packet";
import PlayerEntity from "entities/playerentity";
import type { DEFAULT_CONFIGS } from "data/configs/constants";
import type { Config } from "data/config/config";

export interface WorldOptions {
    name: string;
    blocks?: Uint8Array;
    size: Vector3;
    spawn: EntityPosition;
    serverConfig?: Config<typeof DEFAULT_CONFIGS.server>;
}

export interface WorldFromFileOptions {
    filePath: string;
    serverConfig?: Config<typeof DEFAULT_CONFIGS.server>;
    parserClass?: new () => WorldParser;
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
    public readonly name: string;
    public size: Vector3;
    public spawn: EntityPosition;
    public lastUpdate: number;
    public manager?: WorldManager;
    public readonly entities = new Map<number, Entity>();
    public readonly logger: pino.Logger;
    public readonly serverConfig?: Config<typeof DEFAULT_CONFIGS.server>;

    constructor({
        name,
        size,
        spawn,
        blocks,
        serverConfig: config,
    }: WorldOptions) {
        this.logger = getSimpleLogger("World " + name);
        this.name = name;
        this.size = size;
        this._blocks = new Uint8Array(this.size.product()).fill(0);
        if (blocks) {
            this._blocks.set(blocks);
        }
        this.spawn = spawn;
        this.lastUpdate = Date.now();
        this.serverConfig = config;
    }

    static async fromFile({
        filePath,
        parserClass,
        serverConfig: config,
    }: WorldFromFileOptions): Promise<World> {
        if (!(await fs.promises.exists(filePath))) {
            throw new Error("File not found.");
        }
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const WorldParser = parserClass ?? HWorldParser;
        const data = new Uint8Array(await fs.promises.readFile(filePath));
        const worldParser = new WorldParser();
        const options = (await worldParser.decode(data)) as WorldOptions;
        options.name =
            options.name !== ""
                ? options.name
                : pathlib.basename(filePath, pathlib.extname(filePath));
        options.serverConfig = config;
        return new World(options);
    }
    // TODO: Replace with generators
    static async basicWorld({
        name,
        size,
        spawn,
        serverConfig,
    }: Omit<
        WorldOptions & Partial<Pick<WorldOptions, "spawn">>,
        "blocks"
    >): Promise<World> {
        spawn =
            spawn ??
            new EntityPosition(size.x / 2, size.y / 2 + 1, size.z / 2, 0, 0);
        const world = new World({
            name,
            size,
            spawn,
            serverConfig,
        });
        for (let x = 0; x < size.x; x++) {
            for (let y = 0; y <= size.y; y++) {
                for (let z = 0; z < size.z; z++) {
                    world.setBlock(
                        new Vector3(x, y, z),
                        y <= Math.floor(size.y / 2) ? 1 : 0
                    );
                }
            }
        }
        return world;
    }

    static async fromFileWithDefault(
        fileOptions: WorldFromFileOptions,
        fallbackOptions: Omit<
            WorldOptions & Partial<Pick<WorldOptions, "spawn">>,
            "blocks"
        >
    ): Promise<World> {
        try {
            return await World.fromFile(fileOptions);
        } catch {
            return await World.basicWorld(fallbackOptions);
        }
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
            const headerParser = new StructuredParserBuilder<{
                levelSize: number;
            }>()
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
        for (const entity of this.entities.values()) {
            // Perhaps replace with events at a later point
            if (entity instanceof PlayerEntity) {
                const playerEntity = entity as PlayerEntity;
                const player = playerEntity.player;
                const protocol = player.protocol;
                if (!protocol || !player.connection) {
                    this.logger.error(
                        "No connection/protocol on registered player!"
                    );
                    continue;
                }
                const setBlockPacket =
                    protocol.packets[PacketIds.SetBlockServer];
                if (!setBlockPacket || !setBlockPacket.send) {
                    this.logger.error("No setBlockServer packet found!");
                    continue;
                }

                setBlockPacket.send(player.connection, {
                    x: position.x,
                    y: position.y,
                    z: position.z,
                    blockType: blockId,
                });
            }
        }
    }
    getBlock(position: Vector3) {
        const index = getBlockIndex(position, this.size);
        return this._blocks[index];
    }

    async save(saveDir?: string) {
        const PARSER = new HWorldParser();
        const ENCODED = await PARSER.encode(this);
        const saveDirectory =
            saveDir ?? this.serverConfig?.config.worlds.worldDir;
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
        if (
            entity.worldEntityId < 0 ||
            !this.entities.has(entity.worldEntityId) ||
            this.entities.get(entity.worldEntityId) !== entity
        )
            return;
        entity.worldEntityId = -1;
    }
}

export default World;
