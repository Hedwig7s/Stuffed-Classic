import { readFileSync, writeFileSync } from "fs";
import { join as joinPath } from "path";
import * as toml from "smol-toml";
import { CONFIG_PATH } from "data/constants";
type ConfigData = Record<string|symbol, any>;
function createProxy(config: ConfigData, defaultConfig: ConfigData) {
    return new Proxy(config, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            if (value && typeof value === 'object') {
                return createProxy(value, defaultConfig[prop]);
            }
            return value;
        },
        set(target, prop, value, receiver) {
            if (typeof defaultConfig[prop] !== typeof value) {
                throw new Error("Value type mismatch");
            }
            return Reflect.set(target, prop, value, receiver);
        }
    });
}

export interface ConfigOptions {
    name: string;
    version: number;
    defaultConfig: ConfigData;
}

export class Config {
    private readonly defaultConfig: ConfigData = {};
    private _config: ConfigData = {};
    public config = createProxy(this._config, this.defaultConfig);
    public readonly path;
    public readonly name: string;
    public readonly version: number;
    constructor({ name, version, defaultConfig }: ConfigOptions) {
        this.name = name;
        this.version = version;
        this.defaultConfig = structuredClone(defaultConfig);
        this.path = joinPath(CONFIG_PATH, this.name + ".toml");
    }
    public load() {
        try {
            const data = readFileSync(CONFIG_PATH).toString();
            this._config = toml.parse(data);
            this.config = createProxy(this._config, this.defaultConfig);
        } catch {
            this._config = structuredClone(this.defaultConfig);
        }
    }
    public save() {
        writeFileSync(this.path, toml.stringify(this.config));
    }
}
export default Config;