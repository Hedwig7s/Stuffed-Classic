import pino from "pino";
import pinoCaller from "pino-caller";
import PinoPretty from "pino-pretty";
import * as pathLib from "path";

export function getSimpleLogger(name?: string) {
    const debug = process.env.DEBUG === "1";

    const level = debug ? "trace" : "info";
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
