import { exists, mkdir } from "fs/promises";
import { join as joinPath } from "path";
import {
    handlers,
    type FileFormatHandler,
} from "data/config/configfilehandlers";
import { CONFIG_PATH } from "data/configs/constants";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";

export type ConfigData = Record<string | symbol, any>;
export type ConfigObject<T extends ConfigData> = T & {
    version: number;
    lastUpdated: number;
};

function isObject(value: any) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function verifyConfigValues(value: any, defaultValue: any) {
    return typeof value === typeof defaultValue;
}

function verifyConfigKey(
    key: string | symbol,
    config: any,
    defaultConfig: ConfigData
) {
    return (
        key &&
        key in config &&
        key in defaultConfig &&
        verifyConfigValues(config[key], defaultConfig[key])
    );
}

function verifyConfig(config: any, defaultConfig: ConfigData) {
    if (!isObject(defaultConfig) || !isObject(config)) {
        return false;
    }

    const keys = new Set([
        ...Object.keys(config),
        ...Object.keys(defaultConfig),
    ]);
    for (const key of keys) {
        if (!verifyConfigKey(key, config, defaultConfig)) {
            return false;
        }
        const value = config[key];
        const defaultValue = defaultConfig[key];

        if (value && isObject(value)) {
            if (!verifyConfig(value, defaultValue)) {
                return false;
            }
        }
    }
    return true;
}

function createProxy<T extends ConfigData>(
    config: ConfigData,
    defaultConfig: ConfigData,
    instance: Config
) {
    return new Proxy(config, {
        get(target, key) {
            if (typeof target[key] === "object") {
                const value = target[key];
                return createProxy<typeof value>(
                    value,
                    defaultConfig[key],
                    instance
                );
            }
            if (!(key in target)) {
                target[key] = structuredClone(defaultConfig[key]);
            }
            return target[key];
        },
        set(target, key, value, receiver) {
            if (
                (isObject(value) &&
                    isObject(defaultConfig[key]) &&
                    verifyConfig(value, defaultConfig[key])) ||
                (key in defaultConfig &&
                    verifyConfigValues(value, defaultConfig[key]))
            ) {
                const ret = Reflect.set(target, key, value, receiver);
                if (instance && instance.autosave) {
                    instance.needsResave = true;
                }
                Reflect.set(
                    target,
                    "lastUpdate",
                    Math.floor(Date.now() / 1000)
                );
                return ret;
            } else {
                throw new Error(`Invalid value for key ${String(key)}`);
            }
        },
    }) as T;
}

export interface ConfigOptions<T extends ConfigData = ConfigData> {
    defaultConfig: T;
    name: string;
    version: number;
    autosave?: boolean;
    handler?: keyof typeof handlers | FileFormatHandler;
}

const reservedKeys = ["version", "lastUpdated"];

export class Config<T extends ConfigData = ConfigData> {
    private _config: ConfigObject<T>;
    public get data() {
        return createProxy(
            this._config,
            this.defaultConfig,
            this
        ) as ConfigObject<T>;
    }
    public readonly defaultConfig: Readonly<ConfigObject<T>>;
    public readonly name: string;
    public readonly version: number;
    public readonly logger: pino.Logger;
    public readonly fileHandler: FileFormatHandler;
    public autosave: boolean;
    public needsResave = false;

    constructor({
        defaultConfig,
        name,
        version,
        autosave,
        handler,
    }: ConfigOptions<T>) {
        this.logger = getSimpleLogger("Config " + name);
        this._config = structuredClone(defaultConfig) as ConfigObject<T>;

        for (const key of reservedKeys) {
            if (key in defaultConfig) {
                this.logger.warn(
                    `Top level ${key} key is reserved! Will be overwritten`
                );
            }
        }
        const def = structuredClone(defaultConfig) as ConfigObject<T>;
        def.version = version;
        def.lastUpdated = Math.floor(Date.now() / 1000);
        this._config.lastUpdated = def.lastUpdated;
        this._config.version = version;
        this.defaultConfig = Object.freeze(def);
        this.version = version;
        this.name = name;
        this.autosave = autosave ?? true;

        let fileHandler: FileFormatHandler | undefined;
        if (handler) {
            if (typeof handler === "string") {
                fileHandler = handlers[handler];
            } else {
                fileHandler = handler;
            }
        } else if (
            process.env.CONFIG_FORMAT &&
            process.env.CONFIG_FORMAT !== ""
        ) {
            const format = process.env.CONFIG_FORMAT.toLowerCase();
            if (format in handlers) {
                fileHandler = handlers[format as keyof typeof handlers];
            } else {
                this.logger.warn(`Invalid file format ${format}`);
            }
        }
        const saveInterval = setInterval(() => {
            if (this == null) {
                clearInterval(saveInterval);
                return;
            }
            if (!this.needsResave) return;
            this.save();
        }, 10000);
        this.fileHandler = fileHandler ?? handlers.json5;
    }

    public getPath(
        extension: string = this.fileHandler.extension.toLowerCase()
    ) {
        return joinPath(CONFIG_PATH, `${this.name}.${extension}`);
    }

    async save() {
        const encoded = this.fileHandler.handler.stringify(
            this._config,
            null,
            4
        );
        if (!(await exists(CONFIG_PATH))) {
            await mkdir(CONFIG_PATH);
        }
        await Bun.write(this.getPath(), encoded);
    }

    protected _load(
        data: string,
        handler: FileFormatHandler = this.fileHandler
    ) {
        let parsed: ConfigData;
        try {
            parsed = handler.handler.parse(data) as ConfigData;
        } catch (error) {
            this.logger.warn("Failed to load config!", error);
            return;
        }
        const parseObj = (
            obj: ConfigData,
            defaultObj: ConfigData
        ): ConfigData => {
            const out: ConfigData = {};
            for (const key of new Set([
                ...Object.keys(obj),
                ...Object.keys(defaultObj),
            ])) {
                if (!(key in defaultObj)) continue;
                let value = obj[key] ?? structuredClone(defaultObj[key]);
                if (!verifyConfigKey(key, obj, defaultObj)) {
                    value = structuredClone(defaultObj[key]);
                } else if (isObject(value)) {
                    value = parseObj(value, defaultObj[key]);
                }
                out[key] = value;
            }
            return out;
        };
        this._config = parseObj(parsed, this.defaultConfig) as ConfigObject<T>;
        if (this.autosave) this.save();
    }
    protected async checkForOtherFormats() {
        for (const handler of Object.values(handlers)) {
            if (handler === this.fileHandler) continue;
            const path = this.getPath(handler.extension);
            const file = Bun.file(path);
            if (await file.exists()) {
                const data = await file.text();
                this._load(data, handler);
                await file.delete();
                return true;
            }
        }
        return false;
    }
    public async load() {
        const path = this.getPath();
        if (!(await exists(path))) {
            const found = this.checkForOtherFormats();
            if (!found) {
                this.save();
            }
            return;
        }
        const data = await Bun.file(path).text();
        this._load(data);
    }
}
export default Config;
