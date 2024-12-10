import { readFile, writeFile, exists, mkdir } from "fs/promises";
import { join as joinPath, parse } from "path";
import * as toml from "smol-toml";
import { CONFIG_PATH } from "data/constants";

export type ConfigData = Record<string | symbol, any>;
export type ConfigObject<T extends ConfigData> = T & { version: number };

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
    console.log(typeof config[key], typeof defaultConfig[key]);
    return (
        key &&
        key in config &&
        key in defaultConfig &&
        verifyConfigValues(config[key], defaultConfig[key])
    );
}

function verifyConfig(config: any, defaultConfig: ConfigData) {
    if (!isObject(defaultConfig) || !isObject(config)) {
        console.warn("Invalid config passed into verifyConfig");
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
    defaultConfig: ConfigData
) {
    return new Proxy(config, {
        get(target, key) {
            if (typeof target[key] === "object") {
                const value = target[key];
                return createProxy<typeof value>(value, defaultConfig[key]);
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
                return Reflect.set(target, key, value, receiver);
            } else {
                throw new Error(`Invalid value for key ${String(key)}`);
            }
            return false;
        },
    }) as T;
}

export interface ConfigOptions<T extends ConfigData = ConfigData> {
    defaultConfig: T;
    name: string;
    version: number;
}

export class Config<T extends ConfigData = ConfigData> {
    private __config!: ConfigObject<T>; // It's set by _config
    protected set _config(value: ConfigObject<T>) {
        this.__config = structuredClone(value);
    }
    protected get _config() {
        return this.__config;
    }
    public get config() {
        return createProxy(this._config, this.defaultConfig);
    }
    public readonly defaultConfig: Readonly<ConfigObject<T>>;
    public readonly name: string;
    public readonly version: number;
    constructor({ defaultConfig, name, version }: ConfigOptions<T>) {
        // TODO: updaters and validator
        this._config = structuredClone(defaultConfig) as ConfigObject<T>;
        if (defaultConfig["version"]) {
            console.warn(
                "Top level version parameter reserved for config version! Will be overwritten"
            );
        }
        const def = structuredClone(defaultConfig) as ConfigObject<T>;
        def.version = version;
        this.defaultConfig = Object.freeze(def);
        this.version = version;
        this.name = name;
        this._config.version = version;
    }
    public getPath() {
        return joinPath(CONFIG_PATH, `${this.name}.toml`);
    }
    async save() {
        const encoded = toml.stringify(this._config);
        if (!(await exists(CONFIG_PATH))) {
            await mkdir(CONFIG_PATH);
        }
        writeFile(this.getPath(), encoded, { encoding: "utf-8" });
    }
    async load() {
        const path = this.getPath();
        if (!(await exists(path))) {
            return;
        }
        const data = (await readFile(path)).toString("utf-8");
        let parsed: ReturnType<typeof toml.parse>;
        try {
            parsed = toml.parse(data);
        } catch {
            console.warn("Failed to load config!");
            return;
        }
        const parseObj = function (
            obj: ConfigData,
            defaultObj: ConfigData
        ): ConfigData {
            const out: ConfigData = {};
            for (const key of new Set([
                ...Object.keys(obj),
                ...Object.keys(defaultObj),
            ])) {
                if (!(key in defaultObj)) {
                    continue;
                }
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
        this.save();
    }
}
export default Config;
