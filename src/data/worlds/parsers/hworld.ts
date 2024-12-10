import BaseWorldParser from "data/worlds/parsers/base";
import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import { ParserBuilder } from "utility/dataparser";
import zlib from "zlib";

import type { WorldOptions, World } from "data/worlds/world";
import { concatUint8Arrays } from "uint8array-extras";
import { writeFile } from "fs/promises";

interface Header {
    [key: string]: string|number;
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
interface Block {
    readonly id: number;
    readonly count: number;
}

const HEADER_PARSER = new ParserBuilder<Header>()
    .littleEndian()
    .uint32('version')
    .uint16('sizeX')
    .uint16('sizeY')
    .uint16('sizeZ')
    .uint16('spawnX')
    .uint16('spawnY')
    .uint16('spawnZ')
    .uint8('spawnYaw')
    .uint8('spawnPitch')
    .build();

const BLOCK_PARSER = new ParserBuilder<Block>()
    .littleEndian()
    .uint8('id')
    .uint32('count')
    .build();
const WORLD_VERSION = 3;

function zlibCallbackToPromise<T extends (buf: zlib.InputType, callback: zlib.CompressCallback) => void>(func: T): (buf: zlib.InputType) => Promise<Buffer> {
    return function(buf: zlib.InputType) {
        return new Promise<Buffer>((resolve,reject) => {
            func(buf, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            })
        })
    }
}

export default class HWorldParser extends BaseWorldParser {
    async decode(data: Uint8Array) {
        const HEADER = HEADER_PARSER.parse(data.subarray(0, 18));
        const SIZE = new Vector3(HEADER.sizeX, HEADER.sizeY, HEADER.sizeZ);
        const SPAWN = new EntityPosition(HEADER.spawnX, HEADER.spawnY, HEADER.spawnZ, HEADER.spawnYaw, HEADER.spawnPitch);
        const BLOCKS = new Uint8Array(SIZE.product()).fill(0);
        let compressedBlocks = data.subarray(18);
        if (HEADER.version >= 3) {
            const TEMP_BLOCKS = await zlibCallbackToPromise(zlib.inflate)(compressedBlocks);
            compressedBlocks = new Uint8Array(TEMP_BLOCKS.buffer,TEMP_BLOCKS.byteOffset,TEMP_BLOCKS.byteLength);
        }
        let blockIndex = 0;
        for (let i = 0; i < compressedBlocks.byteLength; i+=5) {
            const BLOCK = BLOCK_PARSER.parse(compressedBlocks.subarray(i, i+5));
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
        const HEADER = HEADER_PARSER.encode({
            version: WORLD_VERSION,
            sizeX: world.size.x,
            sizeY: world.size.y,
            sizeZ: world.size.z,
            spawnX: world.spawn.x,
            spawnY: world.spawn.y,
            spawnZ: world.spawn.z,
            spawnYaw: world.spawn.yaw,
            spawnPitch: world.spawn.pitch
        });
        const LEVEL_SIZE = world.size.product();
        const BLOCKS = new Uint8Array(LEVEL_SIZE).fill(0);
        let blockOffset = 0;
        let count = 0;
        let currentBlock = -1;
        const writeBlock = function(id: number, count: number) {
            BLOCKS.set(BLOCK_PARSER.encode({id: id, count:count}),blockOffset)
            blockOffset += 5;
        }
        for (let i = 0; i < LEVEL_SIZE; i++) {
            let block = world.blocks.getUint8(i);
            if (block === currentBlock) {
                count++;
                continue;
            } else if (count > 0) {
                writeBlock(currentBlock, count);
                currentBlock = block;
                count = 0;
            }
        }
        if (count > 0) {
            writeBlock(currentBlock,count)
        }

        const TEMP_BLOCKS = await zlibCallbackToPromise(zlib.deflate)(BLOCKS);
        const COMPRESSED_BLOCKS = new Uint8Array(TEMP_BLOCKS.buffer,TEMP_BLOCKS.byteOffset,TEMP_BLOCKS.byteLength);
        const WORLD_DATA: Uint8Array = concatUint8Arrays([HEADER, COMPRESSED_BLOCKS]);
        return WORLD_DATA;
    }
}