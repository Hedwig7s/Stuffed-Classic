import type Player from "player/player";
import type { ServiceMap } from "servercontext";
import type { ServiceRegistry } from "utility/serviceregistry";

export interface CommandOptions {
    serviceRegistry: ServiceRegistry<ServiceMap>;
}
/**
 * Base class and shape for commands
 * @abstract
 */
export abstract class Command {
    /**
     * The name of the command. Used to call the command. (e.g. /example)
     */
    public abstract name: string;
    /**
     * A brief description of the command. Used in the help command.
     */
    public abstract description: string;
    /**
     * The function that is called when the command is executed.
     * @param {Player} player The player that executed the command.
     * @param {string} args All text after the command name.
     * @returns {Promise<boolean | [boolean, string, boolean?]>} Can either return a success boolean, or an array with a success boolean, a message, and an optional boolean for whether or not to send the player the message (defaults to true).
     */
    public abstract execute(
        player: Player,
        args: string
    ): Promise<boolean | [boolean, string, boolean?]>;
    /**
     * The function that is called when the help command is executed.
     * @param {Player} player The player that executed the command.
     */
    public abstract help(player: Player): Promise<string>;
    protected serviceRegistry: ServiceRegistry<ServiceMap>;
    public constructor(options: CommandOptions) {
        this.serviceRegistry = options.serviceRegistry;
    }
}
