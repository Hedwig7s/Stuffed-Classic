import ColorCodes from "chat/colorcodes";
import { ArgumentParser, ArgumentParserBuilder } from "commands/argumentparser";
import { Command, type CommandOptions } from "commands/command";
import type World from "data/worlds/world";
import type EntityPosition from "datatypes/entityposition";
import type Vector3 from "datatypes/vector3";
import type Entity from "entities/entity";
import type Player from "player/player";

export class CmdTestArgs extends Command {
    public name = "testargs";
    public description = "Argument parser test";
    protected argumentParser: ArgumentParser<
        [
            string,
            string,
            number,
            number,
            boolean,
            number,
            number,
            number,
            string
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
                string,
                string,
                number,
                number,
                boolean,
                number,
                number,
                number,
                string
            ]
        >()
            .string()
            .string("named")
            .number()
            .integer()
            .boolean()
            .rangedNumber(0, 10)
            .rangedInteger(0, 10)
            .rangedNumber(0, 10, "namedRanged")
            .string("optional", true)
            .build();
    }
}

export default CmdTestArgs;
