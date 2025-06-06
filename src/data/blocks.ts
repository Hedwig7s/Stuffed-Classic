/**
    Block ID mapping of name to ID
*/
export enum BlockIds {
    air = 0,
    stone = 1,
    grass = 2,
    dirt = 3,
    cobblestone = 4,
    woodPlanks = 5,
    sapling = 6,
    bedrock = 7,
    water = 8,
    stationaryWater = 9,
    lava = 10,
    stationaryLava = 11,
    sand = 12,
    gravel = 13,
    goldOre = 14,
    ironOre = 15,
    coalOre = 16,
    wood = 17,
    leaves = 18,
    sponge = 19,
    glass = 20,
    red = 21,
    orange = 22,
    yellow = 23,
    lime = 24,
    green = 25,
    springGreen = 26,
    cyan = 27,
    lightBlue = 28,
    blue = 29,
    violet = 30,
    purple = 31,
    magenta = 32,
    pink = 33,
    black = 34,
    gray = 35,
    white = 36,
    dandelion = 37,
    rose = 38,
    brownMushroom = 39,
    redMushroom = 40,
    gold = 41,
    iron = 42,
    doubleSlab = 43,
    slab = 44,
    brick = 45,
    tnt = 46,
    bookshelf = 47,
    mossyCobblestone = 48,
    obsidian = 49,
}

/**
 * Data for which blocks need to be replaced when sending to specific versions
 */
export const BLOCK_VERSION_REPLACEMENTS = {
    /** Default block if a block is unsupported */
    default: BlockIds.stone,
    /** Highest block id supported by each protocol */
    replacementInfo: {
        [1]: {
            max: BlockIds.leaves,
        },
        [6]: {
            max: BlockIds.gold,
        },
        [5]: {
            max: BlockIds.glass,
        },
        [4]: {
            max: BlockIds.leaves,
        },
        [3]: {
            max: BlockIds.leaves,
        },
    },
    /** Block replacements if a block is incompatible with the protocol */
    replacements: {
        [BlockIds.sponge]: BlockIds.sand,
        [BlockIds.glass]: BlockIds.gravel,
        [BlockIds.yellow]: BlockIds.sand,
        [BlockIds.lime]: BlockIds.leaves,
        [BlockIds.green]: BlockIds.leaves,
        [BlockIds.springGreen]: BlockIds.leaves,
        [BlockIds.gray]: BlockIds.stone,
        [BlockIds.white]: BlockIds.stone,
        [BlockIds.dandelion]: BlockIds.air,
        [BlockIds.rose]: BlockIds.air,
        [BlockIds.brownMushroom]: BlockIds.air,
        [BlockIds.redMushroom]: BlockIds.air,
        [BlockIds.gold]: BlockIds.goldOre,
        [BlockIds.iron]: BlockIds.ironOre,
        [BlockIds.doubleSlab]: BlockIds.stone,
        [BlockIds.mossyCobblestone]: BlockIds.cobblestone,
    },
};
