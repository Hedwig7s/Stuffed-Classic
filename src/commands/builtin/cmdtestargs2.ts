import ColorCodes from "chat/colorcodes";
import { ArgumentParser, ArgumentParserBuilder } from "commands/argumentparser";
import { Command, type CommandOptions } from "commands/command";
import type World from "data/worlds/world";
import type EntityPosition from "datatypes/entityposition";
import type Vector3 from "datatypes/vector3";
import type Entity from "entities/entity";
import type Player from "player/player";

export class CmdTestArgs2 extends Command {
    public name = "testargs2";
    public description = "Argument parser test";
    protected argumentParser: ArgumentParser<
        [
            Vector3,
            Vector3,
            EntityPosition,
            EntityPosition,
        ]
    >;
    public async execute(player: Player, args: string): Promise<boolean | [boolean, string]> {
        const [success, parsed] = this.argumentParser.parse(args);
        if (!success) {
            return [false, parsed.formatted()];
        }
        player.sendMessage(
            `Parsed: ${parsed.join(" ")}`
        );
        return true;
    }
    public async help(player: Player) {
        return "Argument parser test. \nUsage: " + this.argumentParser.getUsage();
    }
    constructor(options: CommandOptions) {
        super(options);
        this.argumentParser = new ArgumentParserBuilder<
            [
                Vector3,
                Vector3,
                EntityPosition,
                EntityPosition,
            ]
        >()
            .vector3()
            .vector3("namedV3")
            .blockPosition()
            .entityPosition()
            .entityPosition("namedEntPos")
            .build();
    }
}

export default CmdTestArgs2;
