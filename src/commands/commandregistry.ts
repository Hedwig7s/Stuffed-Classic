import ColorCodes from "chat/colorcodes";
import { Command } from "commands/command";
import type Player from "player/player";
import { readdir } from "node:fs/promises";
import { getSimpleLogger } from "utility/logger";
import { join as joinPath, resolve } from "node:path";
import type { ServiceRegistry } from "utility/serviceregistry";
import type { ServiceMap } from "servercontext";

/**
 * A registry for all commands in a server instance.
 */
export class CommandRegistry {
    private _commands = new Map<string, Command>();
    public readonly logger = getSimpleLogger("CommandRegistry");
    public get commands(): Map<string, Command> {
        return this._commands;
    }
    constructor(public readonly serviceRegistry: ServiceRegistry<ServiceMap>) {}
    /**
     * Adds a command to the registry
     * @throws {Error} If a command with the same name is already registered
     * @param command The command to register
     */
    public register(command: Command): void {
        if (this._commands.has(command.name.toLowerCase())) {
            throw new Error(`Command ${command.name} already registered`);
        }
        this._commands.set(command.name.toLowerCase(), command);
    }
    /**
     * Removes a command from the registry
     * @param command The command, or command name to unregister
     */
    public unregister(command: Command | string): void {
        if (typeof command === "string") {
            this._commands.delete(command.toLowerCase());
            return;
        }
        if (this._commands.get(command.name.toLowerCase()) !== command) {
            return;
        }
        this._commands.delete(command.name.toLowerCase());
    }
    /**
     * Gets a command by name
     * @param name The name of the command
     * @returns The command, or undefined if not found
     */
    public getCommand(name: string): Command | undefined {
        return this._commands.get(name.toLowerCase());
    }
    /**
     * Handles a message as a command
     * @param player The player that sent the message
     * @param message The message sent by the player, starting with a command prefix
     * @returns Whether or not the command was successful, or if the command was not found
     */
    public async handleMessage(
        player: Player,
        message: string
    ): Promise<boolean> {
        message = message.slice(1);
        const parts = message.split(" ");
        const commandName = parts[0].toLowerCase();
        const command = this.getCommand(commandName);
        if (!command) {
            player.sendMessage(
                `${ColorCodes.Red}Unknown command: ${commandName}`
            );
            return false;
        }
        let status: boolean | [boolean, string, boolean?];
        try {
            status = await command.execute(player, parts.slice(1).join(" "));
        } catch (e) {
            this.logger.error(`Error executing command ${commandName}: ${e}`);
            player.sendMessage(
                `${ColorCodes.Red}An error occurred while executing the command`
            );
            return false;
        }
        if (status === false || (Array.isArray(status) && !status[0])) {
            if (Array.isArray(status) && (status[2] || status.length === 2)) {
                player.sendMessage(status[1]);
            }
            return false;
        }
        return true;
    }
    /**
     * Scans a folder for command files and registers them
     * Uses the default export of the file as the command class
     * @param path The path to the folder to scan
     */
    public async scanFolder(path: string) {
        path = resolve(path);
        const files = (await readdir(path)).filter(
            (file) =>
                file.toLowerCase().startsWith("cmd") &&
                (file.endsWith(".ts") || file.endsWith(".js"))
        );
        for (const file of files) {
            try {
                const command = (await import(joinPath(path, file))).default;
                if (!command) {
                    this.logger.warn(`No default export in ${file}`);
                    continue;
                }
                this.register(
                    new command({ serviceRegistry: this.serviceRegistry })
                );
            } catch (e: any) {
                this.logger.error(
                    `Failed to register ${file}: ${e}\n${e.stack}`
                );
            }
        }
    }
}
