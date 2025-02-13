/*
    World data structure and management
*/
import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import HWorldParser from "data/worlds/parsers/hworld";
import zlib from "zlib";
import fs from "fs";
import * as pathlib from "path";
import type { Entity } from "entities/entity";
import type WorldRegistry from "./worldregistry";
import type WorldParser from "./parsers/base";
import { StructuredParserBuilder } from "utility/datastruct";
import { concatUint8Arrays } from "uint8array-extras";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";
import { PacketIds } from "networking/packet/packet";
import PlayerEntity from "entities/playerentity";
import type { DEFAULT_CONFIGS } from "data/configs/constants";
import type { Config } from "data/config/config";

/**
 * Options for creating a new world instance.
 */
export interface WorldOptions {
    name: string;
    /** 1D array of block ids in xzy order */
    blocks?: Uint8Array;
    size: Vector3;
    spawn: EntityPosition;
    serverConfig?: Config<typeof DEFAULT_CONFIGS.server>;
}

/**
 * Options for loading a world from a file.
 */
export interface WorldFromFileOptions {
    filePath: string;
    serverConfig?: Config<typeof DEFAULT_CONFIGS.server>;
    parserClass?: new () => WorldParser;
}

/**
 * Calculates the index of a block in the 1D blocks array based on its 3D position.
 *
 * @param position - The 3D position of the block.
 * @param size - The 3D size of the world.
 * @returns The calculated index corresponding to the block's position.
 */
export function getBlockIndex(position: Vector3, size: Vector3): number {
    const { x, y, z } = position;
    return x + z * size.x + y * size.x * size.z;
}

/**
 * Represents a world and provides methods for managing its data,
 * including block manipulation, entity registration, file I/O, and compression.
 */
export class World {
    protected _blocks: Uint8Array;

    public get blocks(): Uint8Array {
        return new Uint8Array(this._blocks);
    }

    public readonly name: string;
    public size: Vector3;
    public spawn: EntityPosition;
    public lastUpdate: number;
    public manager?: WorldRegistry;
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

    /**
     * Creates a World instance from a file.
     *
     * @param options - Options for loading the world from a file.
     * @returns A promise that resolves with the loaded World instance.
     * @throws Error if the specified file does not exist.
     */
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
        const data = await Bun.file(filePath).bytes();
        const worldParser = new WorldParser();
        const options = (await worldParser.decode(data)) as WorldOptions;
        options.name =
            options.name !== ""
                ? options.name
                : pathlib.basename(filePath, pathlib.extname(filePath));
        options.serverConfig = config;
        return new World(options);
    }

    /**
     * Creates a basic world with default block settings.
     * Blocks below or equal to half the world's height are filled with block ID 1, others with 0.
     *
     * @param options - Options for creating a basic world. The spawn point is optional.
     * @returns A promise that resolves with the newly created basic World instance.
     * @deprecated Will be replaced with a generator-based system.
     */
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

    /**
     * Attempts to load a world from a file, falling back to creating a basic world if loading fails.
     *
     * @param fileOptions - Options for loading the world from a file.
     * @param fallbackOptions - Fallback options for creating a basic world if file loading fails.
     * @returns A promise that resolves with the resulting World instance.
     */
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

    /**
     * Compresses the world data into a client-compatible format.
     *
     * @param protocolVersion - The protocol version to encode the data.
     * @param callback - Optional callback invoked for each data chunk with the chunk data, its size, and the current percentage completed.
     * @returns A promise that resolves with the concatenated compressed data as a Uint8Array.
     * @throws Error if gzip compression times out.
     */
    async pack(
        protocolVersion: number,
        callback?: (data: Uint8Array, size: number, percent: number) => void
    ): Promise<Uint8Array> {
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

    /**
     * Sets the block at the specified position to the given block ID.
     * Notifies player entities about the change via network packets.
     *
     * @param position - The 3D position where the block will be set.
     * @param blockId - The block ID to set at the given position.
     */
    async setBlock(position: Vector3, blockId: number): Promise<void> {
        const index = getBlockIndex(position, this.size);
        this._blocks[index] = blockId;
        this.lastUpdate = Date.now();
        let cooldown = 0;
        for (const entity of this.entities.values()) {
            cooldown++;
            if (cooldown === 10) {
                await Promise.resolve();
                cooldown = 0;
            }
            // TODO: Perhaps replace with events at a later point
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
                    blockId: blockId,
                });
            }
        }
    }

    /**
     * Retrieves the block ID at the specified position.
     *
     * @param position - The 3D position of the block.
     * @returns The block ID at the given position.
     */
    getBlock(position: Vector3): number {
        const index = getBlockIndex(position, this.size);
        return this._blocks[index];
    }

    /**
     * Saves the current world state to disk.
     *
     * @param saveDir - Optional directory to save the world file. If not provided, the directory is taken from the server configuration.
     * @returns A promise that resolves when the world has been saved.
     * @throws Error if the save directory is not set.
     */
    async save(saveDir?: string): Promise<void> {
        const PARSER = new HWorldParser();
        const ENCODED = await PARSER.encode(this);
        const saveDirectory =
            saveDir ?? this.serverConfig?.data.worlds.worldDir;
        if (saveDirectory == null) {
            throw new Error("World save directory not set");
        }
        await fs.promises.mkdir(saveDirectory, { recursive: true });
        await fs.promises.writeFile(
            `${saveDirectory}/${this.name}.hworld`,
            ENCODED
        );
    }

    /**
     * Registers an entity in the world.
     * The entity is assigned the first available ID in the range [0, 127].
     *
     * @param entity - The entity to register.
     * @throws Error if the maximum number of entities is exceeded.
     */
    registerEntity(entity: Entity): void {
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

    /**
     * Unregisters an entity from the world.
     *
     * @param entity - The entity to unregister.
     */
    unregisterEntity(entity: Entity): void {
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
