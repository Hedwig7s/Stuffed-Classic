/**
 * Config wrapper for loading and saving from multiple formats.
 */

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

function isObject(value: any): boolean {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Verifies if the type of a value matches the type of a default value.
 *
 * @param value - The value to verify.
 * @param defaultValue - The default value to compare against.
 * @returns True if the types match, false otherwise.
 */
function verifyConfigValues(value: any, defaultValue: any): boolean {
    return typeof value === typeof defaultValue;
}

/**
 * Verifies if a configuration key exists in both the configuration and the default configuration,
 * and that the corresponding values have matching types.
 *
 * @param key - The key to verify.
 * @param config - The configuration object.
 * @param defaultConfig - The default configuration object.
 * @returns True if the key is valid and the types match, false otherwise.
 */
function verifyConfigKey(
    key: string | symbol,
    config: any,
    defaultConfig: ConfigData
): boolean {
    return new Boolean(
        key &&
            key in config &&
            key in defaultConfig &&
            verifyConfigValues(config[key], defaultConfig[key])
    ).valueOf();
}

/**
 * Recursively verifies a configuration object against a default configuration object.
 *
 * @param config - The configuration object to verify.
 * @param defaultConfig - The default configuration object.
 * @returns True if the configuration is valid, false otherwise.
 */
function verifyConfig(config: any, defaultConfig: ConfigData): boolean {
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

/**
 * Creates a proxy for a configuration object that ensures proper validation and triggers autosave.
 *
 * @template T - The configuration data type.
 * @param config - The current configuration object.
 * @param defaultConfig - The default configuration object.
 * @param instance - The Config instance that uses this proxy.
 * @returns A proxied configuration object of type T.
 */
function createProxy<T extends ConfigData>(
    config: ConfigData,
    defaultConfig: ConfigData,
    instance: Config
): T {
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

/**
 * Options for initializing a Config instance.
 *
 * @template T - The type of configuration data.
 */
export interface ConfigOptions<T extends ConfigData = ConfigData> {
    defaultConfig: T;
    name: string;
    version: number;
    autosave?: boolean;
    /** Handler to save the file with */
    handler?: keyof typeof handlers | FileFormatHandler;
}

/** Reserved keys that will be overwritten if found in the default configuration. */
const reservedKeys = ["version", "lastUpdated"];

/**
 * Class representing a configuration with support for multiple file formats.
 *
 * @template T - The type of configuration data.
 */
export class Config<T extends ConfigData = ConfigData> {
    private _config: ConfigObject<T>;

    /**
     * Returns a proxied version of the configuration data.
     */
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

    /**
     * Constructs a new Config instance.
     *
     * @param options - Configuration options.
     */
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

    /**
     * Generates the full file path for the configuration file.
     *
     * @param extension - The file extension to use (defaults to the fileHandler's extension in lowercase).
     * @returns The full path to the configuration file.
     */
    public getPath(
        extension: string = this.fileHandler.extension.toLowerCase()
    ): string {
        return joinPath(CONFIG_PATH, `${this.name}.${extension}`);
    }

    /**
     * Saves the current configuration to disk using the specified file handler.
     *
     * @returns A promise that resolves when the configuration has been saved.
     */
    async save(): Promise<void> {
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

    /**
     * Loads configuration data from a string and updates the internal configuration.
     *
     * @param data - The raw configuration data as a string.
     * @param handler - The file format handler to use for parsing (defaults to the instance's fileHandler).
     * @returns void
     */
    protected _load(
        data: string,
        handler: FileFormatHandler = this.fileHandler
    ): void {
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

    /**
     * Checks for configuration files in alternative supported formats.
     * If a file is found in a different format, it loads the configuration, deletes the old file, and returns true.
     *
     * @returns A promise that resolves to true if another format was found and loaded, false otherwise.
     */
    protected async checkForOtherFormats(): Promise<boolean> {
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

    /**
     * Loads the configuration from disk. If the primary configuration file does not exist,
     * it checks for files in other supported formats and saves a new file if necessary.
     *
     * @returns A promise that resolves when the configuration has been loaded.
     */
    public async load(): Promise<void> {
        const path = this.getPath();
        if (!(await exists(path))) {
            const found = await this.checkForOtherFormats();
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
