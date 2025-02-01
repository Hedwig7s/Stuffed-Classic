/*
    Simple logger factory
*/

import pino from "pino";
import pinoCaller from "pino-caller";
import PinoPretty from "pino-pretty";
import * as pathLib from "path";

export function getSimpleLogger(name?: string) {
    const level = process.env.LOG_LEVEL?.toLowerCase() || "info";
    const debug =
        process.env.DEBUG !== undefined &&
        process.env.DEBUG.toLowerCase() !== "false" &&
        process.env.DEBUG !== "0" &&
        process.env.DEBUG !== "";
    if (!(level in pino.levels.values)) {
        throw new Error(`Invalid log level: ${level}`);
    }
    const pinoLogger = pino(
        {
            name,
            level: level,
        },
        pino.multistream([
            {
                stream: PinoPretty({
                    sync: false,
                    colorize: true,
                    destination: 2,
                }),
                level: level,
            },
        ])
    );
    const logger = debug
        ? pinoCaller(pinoLogger, { relativeTo: pathLib.dirname(Bun.main) })
        : pinoLogger;
    return logger;
}
