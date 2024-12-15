import type { ContextManager } from "contextmanager";
import pino from "pino";
import pinoCaller from "pino-caller";
import PinoPretty from "pino-pretty";

export function getSimpleLogger(name:string|undefined,context?:ContextManager) {
    let level = "info";
    if (context) {
        level = context.config.main.config.misc.debug ? "trace" : "info";
    }
    const logger = pinoCaller(pino({
        name,
        level: level,
    }, pino.multistream([
        {stream:PinoPretty({sync:false,colorize:true,destination:2}),level:level}
    ])));
    return logger;
}