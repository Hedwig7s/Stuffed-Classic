import type Player from "player/player";
import type { ServiceMap } from "servercontext";
import type { ServiceRegistry } from "utility/serviceregistry";

export interface CommandOptions {
    serviceRegistry: ServiceRegistry<ServiceMap>;
}

export abstract class Command {
    public abstract name: string;
    public abstract description: string;
    public abstract execute(
        player: Player,
        args: string
    ): Promise<boolean | [boolean, string, boolean?]>;
    public abstract help(player: Player): Promise<string>;
    protected serviceRegistry: ServiceRegistry<ServiceMap>;
    public constructor(options: CommandOptions) {
        this.serviceRegistry = options.serviceRegistry;
    }
}
