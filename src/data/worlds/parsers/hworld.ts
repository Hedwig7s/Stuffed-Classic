/*
    hworld format:
    All numbers are little endian
    4 byte uint: version (v2+)
    ascii string "HWORLD": identifier (v4+)
    2 byte uint: world size x
    2 byte uint: world size y
    2 byte uint: world size z
    2 byte uint: spawn position x
    2 byte uint: spawn position y
    2 byte uint: spawn position z
    1 byte uint: spawn yaw
    1 byte uint: spawn pitch
    4 byte uint: block data size (v4+)
    rest of file (or block data size v4+): block data stored in the following format 
        Compressed with zlib in v3
        1 byte uint: block id
        4 byte uint: number of occurences in XZY order (y is up) (same order as minecraft classic) 
*/
import BaseWorldParser from "data/worlds/parsers/base";
import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import { ParserBuilder, type BinaryParserType } from "utility/dataparser";
import zlib from "zlib";

import type { WorldOptions, World } from "data/worlds/world";
import { concatUint8Arrays } from "uint8array-extras";
import { writeFile } from "fs/promises";

interface V2Header {
    version: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
    spawnX: number;
    spawnY: number;
    spawnZ: number;
    spawnYaw: number;
    spawnPitch: number;
}
interface V4Header {
    version: number;
    identifier: string;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
    spawnX: number;
    spawnY: number;
    spawnZ: number;
    spawnYaw: number;
    spawnPitch: number;
    blockDataSize: number;
}
interface Block {
    readonly id: number;
    readonly count: number;
}

const VERSION_PARSER = new ParserBuilder<{version: number}>()
    .littleEndian()
    .uint32("version")
    .build();

const V2HEADER_PARSER = new ParserBuilder<V2Header>()
    .littleEndian()
    .uint32("version")
    .uint16("sizeX")
    .uint16("sizeY")
    .uint16("sizeZ")
    .uint16("spawnX")
    .uint16("spawnY")
    .uint16("spawnZ")
    .uint8("spawnYaw")
    .uint8("spawnPitch")
    .build();

const V4HEADER_PARSER = new ParserBuilder<V4Header>()
    .littleEndian()
    .uint32("version")
    .fixedString("identifier",6, "ascii")
    .uint16("sizeX")
    .uint16("sizeY")
    .uint16("sizeZ")
    .uint16("spawnX")
    .uint16("spawnY")
    .uint16("spawnZ")
    .uint8("spawnYaw")
    .uint8("spawnPitch")
    .uint32("blockDataSize")
    .build();

const BLOCK_PARSER = new ParserBuilder<Block>()
    .littleEndian()
    .uint8("id")
    .uint32("count")
    .build();
const WORLD_VERSION = 4;

function zlibCallbackToPromise<
    T extends (buf: zlib.InputType, callback: zlib.CompressCallback) => void,
>(func: T): (buf: zlib.InputType) => Promise<Buffer> {
    return function (buf: zlib.InputType) {
        return new Promise<Buffer>((resolve, reject) => {
            func(buf, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    };
}

function getHeaderParser(version: number): BinaryParserType<V2Header|V4Header> {
    if (version === 4) {
        return V4HEADER_PARSER;
    } else if (version >= 2 && version <= 3) {
        return V2HEADER_PARSER;
    } else {
        throw new Error(`Unsupported hworld version: ${version}`);
    }
}

export default class HWorldParser extends BaseWorldParser {
    async decode(data: Uint8Array) {
        const VERSION = VERSION_PARSER.parse(data.subarray(0,VERSION_PARSER.size)).version;
        const HEADER_PARSER = getHeaderParser(VERSION);
        if (HEADER_PARSER.size == undefined) {
            throw new Error("Invalid parser sizes!");
        }
        const HEADER = HEADER_PARSER.parse(data.subarray(0,HEADER_PARSER.size));
        
        const SIZE = new Vector3(HEADER.sizeX, HEADER.sizeY, HEADER.sizeZ);
        const SPAWN = new EntityPosition(
            HEADER.spawnX,
            HEADER.spawnY,
            HEADER.spawnZ,
            HEADER.spawnYaw,
            HEADER.spawnPitch
        );
        const BLOCKS = new Uint8Array(SIZE.product()).fill(0);
        let compressedBlocks = data.subarray(HEADER_PARSER.size,"blockDataSize" in HEADER ? HEADER_PARSER.size+HEADER.blockDataSize : undefined);
        if (VERSION >= 3) {
            const TEMP_BLOCKS = await zlibCallbackToPromise(zlib.inflate)(
                compressedBlocks
            );
            compressedBlocks = new Uint8Array(
                TEMP_BLOCKS.buffer,
                TEMP_BLOCKS.byteOffset,
                TEMP_BLOCKS.byteLength
            );
        }
        let blockIndex = 0;
        for (let i = 0; i < compressedBlocks.byteLength; i += 5) {
            const BLOCK = BLOCK_PARSER.parse(
                compressedBlocks.subarray(i, i + 5)
            );
            for (let j = 0; j < BLOCK.count; j++) {
                BLOCKS[blockIndex] = BLOCK.id;
                blockIndex++;
            }
        }
        return {
            name: "",
            blocks: BLOCKS,
            size: SIZE,
            spawn: SPAWN,
        };
    }
    async encode(world: World) {
        const LEVEL_SIZE = world.size.product();
        let blocks = new Uint8Array(LEVEL_SIZE).fill(0);
        let blockOffset = 0;
        let count = 0;
        let currentBlock = -1;
        const writeBlock = function (id: number, count: number) {
            if (blockOffset + (BLOCK_PARSER.size??5) >= blocks.byteLength) {
                const newBlocks = new Uint8Array(blocks.byteLength+5*1024*1024).fill(0);
                blocks = newBlocks;
            }
            blocks.set(
                BLOCK_PARSER.encode({ id: id, count: count }),
                blockOffset
            );
            blockOffset += 5;
        };
        const WORLD_BUFFER = world.blocks;
        for (let i = 0; i < LEVEL_SIZE; i++) {
            const block = WORLD_BUFFER[i];
            if (block === currentBlock) {
                count++;
                continue;
            } else if (count > 0) {
                writeBlock(currentBlock, count);
                currentBlock = block;
                count = 1;
            } else {
                currentBlock = block;
                count = 1;
            }
        }
        if (count > 0) {
            writeBlock(currentBlock, count);
        }
        const TEMP_BLOCKS = await zlibCallbackToPromise(zlib.deflate)(blocks.subarray(0,blockOffset));
        const COMPRESSED_BLOCKS = new Uint8Array(
            TEMP_BLOCKS.buffer,
            TEMP_BLOCKS.byteOffset,
            TEMP_BLOCKS.byteLength
        );
        const HEADER = V4HEADER_PARSER.encode({
            version: WORLD_VERSION,
            identifier: "HWORLD",
            sizeX: world.size.x,
            sizeY: world.size.y,
            sizeZ: world.size.z,
            spawnX: world.spawn.x,
            spawnY: world.spawn.y,
            spawnZ: world.spawn.z,
            spawnYaw: world.spawn.yaw,
            spawnPitch: world.spawn.pitch,
            blockDataSize: COMPRESSED_BLOCKS.byteLength,
        });
        const WORLD_DATA: Uint8Array = concatUint8Arrays([
            HEADER,
            COMPRESSED_BLOCKS,
        ]);
        return WORLD_DATA;
    }
}
