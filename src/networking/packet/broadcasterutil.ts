import type Player from "player/player";
import type { Connection } from "networking/server";
import type { BasePacketData } from "./packetdata";
export const criterias = {
    sameWorld: (source: Player) => {
        return (target: Connection): boolean => {
            return new Boolean(
                target.player?.entity &&
                    source.entity &&
                    target.player?.entity?.world === source.entity?.world
            ).valueOf();
        };
    },
    notSelf: (source?: Connection) => {
        return (target: Connection) => {
            return new Boolean(target && source && target !== source).valueOf();
        };
    },
};

export function combineCriteria(
    ...criteria: ((target: Connection) => boolean)[]
): (target: Connection) => boolean {
    return (target: Connection) => {
        for (const crit of criteria) {
            if (!crit(target)) {
                return false;
            }
        }
        return true;
    };
}

export const modifiers = {
    selfId: <T extends { entityId: number }>(source: Player) => {
        return (data: Omit<T, "id">, target: Connection) => {
            if (target.player && source && target.player === source) {
                return { ...data, entityId: -1 };
            }
            return data;
        };
    },
};

export function combineModifiers<T extends BasePacketData>(
    ...modifiers: ((data: T, target: Connection) => T)[]
): (data: T, target: Connection) => T {
    return (data: T, target: Connection) => {
        for (const mod of modifiers) {
            data = mod(data, target);
        }
        return data;
    };
}
