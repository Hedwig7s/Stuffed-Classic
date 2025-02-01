import { Command } from "commands/command";
import type Player from "player/player";

export class CmdPing extends Command {
    public name = "ping";
    public description = "Ping pong!";
    public async execute(player: Player, args: string) {
        player.sendMessage("Pong!");
        return true;
    }
    public async help(player: Player) {
        return "Ping pong!";
    }
}

export default CmdPing;
