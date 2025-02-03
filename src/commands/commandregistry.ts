import ColorCodes from "chat/colorcodes";
import { Command } from "commands/command";
import type Player from "player/player";
import { exists, mkdir, readdir } from "node:fs/promises";
import { getSimpleLogger } from "utility/logger";
import { join as joinPath, resolve } from "node:path";
import type { ServiceRegistry } from "utility/serviceregistry";
import type { ServiceMap } from "servercontext";

export class CommandRegistry {
    private _commands = new Map<string, Command>();
    public readonly logger = getSimpleLogger("CommandRegistry");
    public get commands(): Map<string, Command> {
        return this._commands;
    }
    constructor(
        public readonly serviceRegistry: ServiceRegistry<ServiceMap>
    ) {}
    public register(command: Command): void {
        if (this._commands.has(command.name.toLowerCase())) {
            throw new Error(`Command ${command.name} already registered`);
        }
        this._commands.set(command.name.toLowerCase(), command);
    }
    public unregister(command: Command): void {
        this._commands.delete(command.name.toLowerCase());
    }
    public getCommand(name: string): Command | undefined {
        return this._commands.get(name.toLowerCase());
    }
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
                this.logger.error(`Failed to register ${file}: ${e}\n${e.stack}`);
            }
        }
    }
}
