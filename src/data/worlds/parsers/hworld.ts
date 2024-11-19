import BaseWorldParser from "data/worlds/parsers/base";
import Vector3 from "datatypes/vector3";
import EntityPosition from "datatypes/entityposition";
import { BinaryParser } from "utility/dataparser";
import zlib from "zlib";

import type { WorldOptions, World } from "data/worlds/world";

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

const HEADER_PARSER = new BinaryParser<Header>()
    .littleEndian()
    .uint32('version')
    .uint16('sizeX')
    .uint16('sizeY')
    .uint16('sizeZ')
    .uint16('spawnX')
    .uint16('spawnY')
    .uint16('spawnZ')
    .uint8('spawnYaw')
    .uint8('spawnPitch');

const BLOCK_PARSER = new BinaryParser<Block>()
    .uint8('id')
    .uint32('count');
const WORLD_VERSION = 3;

export default class HWorldParser extends BaseWorldParser {
    decode(data: Uint8Array): WorldOptions {
        const HEADER = HEADER_PARSER.parse(data.subarray(0, 18));
        const SIZE = new Vector3(HEADER.sizeX, HEADER.sizeY, HEADER.sizeZ);
        const SPAWN = new EntityPosition(HEADER.spawnX, HEADER.spawnY, HEADER.spawnZ, HEADER.spawnYaw, HEADER.spawnPitch);
        const blocks = new Uint8Array(SIZE.product()).fill(0);
        const blocksView = new DataView(blocks.buffer);
        let compressedBlocks = data.subarray(18);
        if (HEADER.version >= 3) {
            const tempBlocks = zlib.inflateSync(compressedBlocks);
            compressedBlocks = new Uint8Array(tempBlocks.buffer, tempBlocks.byteOffset, tempBlocks.byteLength);
        }
        for (let i = 0; i < blocks.length; i+=5) {
            const BLOCK = BLOCK_PARSER.parse(compressedBlocks.subarray(i, i+5));
            for (let j = 0; j < BLOCK.count; j++) {
                blocksView.setUint8(BLOCK.id, i+j);
            }
        }
        return {
            name: "unnamed",
            blocks: blocks,
            size: SIZE,
            spawn: SPAWN,
            autosave: false
        };
    }
    encode(world: World): Uint8Array {
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
        let blocks = new Uint8Array(world.size.product()).fill(0);
        let blockSize = 0;
        function writeBlock(id: number, count: number, offset: number) {
            if (offset + 5 > blocks.length) {
                const newBlocks = new Uint8Array(blocks.length + 10240000);
                blocks.set(newBlocks);
                blocks = newBlocks;
            }
            blocks.set(BLOCK_PARSER.encode({id:id, count:count}), offset);
            blockSize += 5;
        }
        let lastBlock = -1;
        let count = 0;
        for (let i = 0; i < world.size.product(); i++) {
            const block = world.blocks.getUint8(i);
            if (block === lastBlock) {
                count++;
            } else {
                if (count > 0) {
                    writeBlock(lastBlock, count, i-5);
                }
                lastBlock = block;
                count = 1;
            }
        }
        if (count > 0) {
            writeBlock(lastBlock, count, world.size.product()-5);
        }
        const tempBlocks = zlib.deflateSync(Uint8Array.from(blocks.subarray(0, blockSize)));
        const compressedBlocks = new Uint8Array(tempBlocks.buffer, tempBlocks.byteOffset, tempBlocks.byteLength);
        const ret = new Uint8Array(HEADER.length+compressedBlocks.length);
        ret.set(HEADER);
        ret.set(compressedBlocks);
        return ret;
    }
}