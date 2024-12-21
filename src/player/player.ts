import type { ContextManager } from "contextmanager";
import PlayerEntity from "entities/playerentity";
import type { Connection } from "networking/server";
import type pino from "pino";
import { getSimpleLogger } from "utility/logger";

export interface PlayerOptions {
    connection?: Connection;
    name: string;
    fancyName?: string;
    hasEntity?: boolean;
    context?: ContextManager;
}

export class Player {
    public readonly connection?: Connection;
    public readonly name: string;
    public fancyName: string;
    public entity?: PlayerEntity;
    public context?: ContextManager;
    public logger: pino.Logger;
    public get protocol() {
        return this.connection?.protocol;
    }
    constructor(options: PlayerOptions) {
        this.connection = options.connection;
        this.context = options.context;
        this.name = options.name;
        this.fancyName = options.fancyName || this.name;
        if (options.hasEntity ?? true) {
            this.entity = new PlayerEntity({
                player: this,
                name: this.name,
                fancyName: this.fancyName,
                context: this.context,
            });
        }
        this.logger = getSimpleLogger(`Player ${this.name}`);
    }
}

export default Player;
