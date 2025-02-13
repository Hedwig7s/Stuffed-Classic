import ColorCodes from "chat/colorcodes";
import type WorldRegistry from "data/worlds/worldregistry";
import EntityPosition from "datatypes/entityposition";
import Vector3 from "datatypes/vector3";
import type { EntityRegistry } from "entities/entityregistry";
import type Player from "player/player";
import type { PlayerRegistry } from "player/playerregistry";

export type SimpleArgumentType =
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "vector3"
    | "blockPosition"
    | "entityPosition"
    | "restOfLine";

export interface Argument {
    type:
        | SimpleArgumentType
        | "entity"
        | "player"
        | "rangedNumber"
        | "rangedInteger"
        | "world";
    name?: string;
    optional?: boolean;
}

export interface EntityArgument extends Argument {
    type: "entity";
    registry: EntityRegistry;
}

export interface PlayerArgument extends Argument {
    type: "player";
    registry: PlayerRegistry;
}

export interface RangedNumberArgument extends Argument {
    type: "rangedNumber";
    min: number;
    max: number;
}

export interface RangedIntegerArgument extends Argument {
    type: "rangedInteger";
    min: number;
    max: number;
}

export interface WorldArgument extends Argument {
    type: "world";
    registry: WorldRegistry;
}

/**
 * Parses a string into an integer, but only if the string is an integer
 * @param value The string to parse
 * @returns The string as an integer, or NaN if the string is not an integer
 */
function exclusiveParseInt(value: string): number {
    const parsed = parseInt(value);
    if (parsed !== parseFloat(value)) {
        // Check if there are any decimal places
        return NaN;
    }
    return parsed;
}

/**
 * Represents an error that occurred during parsing
 * Provides a formatted method for sending the error message to the client
 * It is not a subclass of Error because it is not thrown, as thrown errors might contain sensitive information and shouldn't be sent to the client
 * Should only be used when the error is caused by invalid user input and can be safely sent to the client
 */
export class ParseError {
    constructor(public message: string) {}
    toString() {
        return this.message;
    }
    /**
     * Formats the error message for sending to the client
     * @returns The formatted error message
     */
    formatted() {
        return `${ColorCodes.Red}Invalid usage: ${this.message}`;
    }
}

/**
 * A class for parsing command arguments
 * @typeParam T - The type of the parsed arguments
 */
export class ArgumentParser<T extends any[] = any[]> {
    constructor(protected argumentFormats: Argument[]) {}
    /**
     *
     * @param arg Current argument
     * @param args Full list of arguments
     * @param i Index of the current argument
     * @returns {[string, number] | [null, ParseError]} - The parsed string and the new index, or null and a ParseError if the string is invalid
     */
    protected parseString(
        arg: string,
        args: string[],
        i: number
    ): [string, number] | [null, ParseError] {
        if (arg.startsWith('"')) {
            if (arg.endsWith('"')) {
                return [arg.slice(1, -1), i];
            }
            let j = i;
            while (!args[j].endsWith('"') || args[j].endsWith('\\"')) {
                const curArg = args[j];
                if (j >= args.length) {
                    return [
                        null,
                        new ParseError(`Unterminated string at ${i}`),
                    ];
                }
                const found = curArg.indexOf('"');
                if (
                    curArg.startsWith('"') ||
                    (found !== -1 && curArg[found - 1] !== "\\")
                ) {
                    return [null, new ParseError(`Invalid syntax at ${i}`)];
                }
                j++;
            }
            return [
                args
                    .slice(i, j + 1)
                    .join(" ")
                    .slice(1, -1),
                j,
            ];
        } else {
            return [arg, i];
        }
    }

    /**
     * Parses a list of arguments into the desired format
     * @param args The list of arguments to parse
     * @returns {[true, T] | [false, ParseError]} - A tuple of [success, parsed arguments] or [failure, error] if the arguments are invalid
     */
    public parse(args: string[] | string): [true, T] | [false, ParseError] {
        const out = [] as any as T;
        if (typeof args === "string") {
            args = args.split(" ");
        }
        let i = 0;
        let reachedOptional = false;
        for (const format of this.argumentFormats) {
            const arg = args[i];
            if (!arg && !format.optional) {
                return [false, new ParseError("Not enough arguments")];
            }
            if (format.optional && !arg) {
                reachedOptional = true;
                break;
            }
            switch (format.type) {
                case "string": {
                    const [parsedString, newIndex] = this.parseString(
                        arg,
                        args,
                        i
                    );
                    if (parsedString === null) {
                        return [false, newIndex as ParseError];
                    }
                    out.push(parsedString);
                    i = newIndex;
                    break;
                }
                case "number":
                    if (isNaN(parseFloat(arg))) {
                        return [
                            false,
                            new ParseError(`Invalid number at ${i}`),
                        ];
                    }
                    out.push(parseFloat(arg));
                    break;
                case "integer":
                    if (isNaN(exclusiveParseInt(arg))) {
                        return [
                            false,
                            new ParseError(`Invalid integer at ${i}`),
                        ];
                    }
                    out.push(exclusiveParseInt(arg));
                    break;
                case "boolean": {
                    const bool = ["true", "1", "yes", "y"].includes(
                        arg.toLowerCase()
                    );
                    if (
                        !bool &&
                        !["false", "0", "no", "n"].includes(arg.toLowerCase())
                    ) {
                        return [
                            false,
                            new ParseError(`Invalid boolean at ${i}`),
                        ];
                    }
                    out.push(bool);
                    break;
                }
                case "entity": {
                    const entityFormat = format as EntityArgument;
                    const entity = entityFormat.registry.get(
                        exclusiveParseInt(arg)
                    );
                    if (!entity) {
                        return [
                            false,
                            new ParseError(`Invalid entity at ${i}`),
                        ];
                    }
                    out.push(entity);
                    break;
                }
                case "player": {
                    const playerFormat = format as PlayerArgument;
                    const [parsedString, newIndex] = this.parseString(
                        arg,
                        args,
                        i
                    );
                    if (parsedString === null) {
                        return [false, newIndex as ParseError];
                    }
                    i = newIndex;
                    const player = playerFormat.registry.get(parsedString);
                    if (!player) {
                        return [
                            false,
                            new ParseError(`Invalid player at ${i}`),
                        ];
                    }
                    out.push(player);
                    break;
                }
                case "vector3": {
                    const x = parseFloat(args[i++]);
                    const y = parseFloat(args[i++]);
                    const z = parseFloat(args[i]);
                    if (isNaN(x) || isNaN(y) || isNaN(z)) {
                        return [
                            false,
                            new ParseError(`Invalid vector3 at ${i - 2}`),
                        ];
                    }
                    out.push(new Vector3(x, y, z));
                    break;
                }
                case "blockPosition": {
                    const x = exclusiveParseInt(args[i++]);
                    const y = exclusiveParseInt(args[i++]);
                    const z = exclusiveParseInt(args[i]);
                    if (isNaN(x) || isNaN(y) || isNaN(z)) {
                        return [
                            false,
                            new ParseError(
                                `Invalid block position at ${i - 2}`
                            ),
                        ];
                    }
                    out.push(new Vector3(x, y, z));
                    break;
                }
                case "entityPosition": {
                    const x = parseFloat(args[i++]);
                    const y = parseFloat(args[i++]);
                    const z = parseFloat(args[i++]);
                    const yaw = exclusiveParseInt(args[i++]);
                    const pitch = exclusiveParseInt(args[i]);
                    if (
                        isNaN(x) ||
                        isNaN(y) ||
                        isNaN(z) ||
                        isNaN(yaw) ||
                        isNaN(pitch)
                    ) {
                        return [
                            false,
                            new ParseError(
                                `Invalid entity position at ${i - 4}`
                            ),
                        ];
                    }
                    out.push(new EntityPosition(x, y, z, yaw, pitch));
                    break;
                }
                case "rangedNumber": {
                    const numberFormat = format as RangedNumberArgument;
                    const number = parseFloat(arg);
                    if (
                        isNaN(number) ||
                        number < numberFormat.min ||
                        number > numberFormat.max
                    ) {
                        return [
                            false,
                            new ParseError(`Number out of range at ${i}`),
                        ];
                    }
                    out.push(number);
                    break;
                }
                case "rangedInteger": {
                    const numberFormat = format as RangedIntegerArgument;
                    const number = exclusiveParseInt(arg);
                    if (
                        isNaN(number) ||
                        number < numberFormat.min ||
                        number > numberFormat.max
                    ) {
                        return [
                            false,
                            new ParseError(`Number out of range at ${i}`),
                        ];
                    }
                    out.push(number);
                    break;
                }
                case "world": {
                    const worldFormat = format as WorldArgument;
                    const [parsedString, newIndex] = this.parseString(
                        arg,
                        args,
                        i
                    );
                    if (parsedString === null) {
                        return [false, newIndex as ParseError];
                    }
                    i = newIndex;
                    const world = worldFormat.registry.getWorld(parsedString);
                    if (!world) {
                        return [false, new ParseError(`Invalid world at ${i}`)];
                    }
                    out.push(world);
                    break;
                }
                case "restOfLine": {
                    out.push(args.slice(i).join(" "));
                    i = args.length;
                    reachedOptional = true;
                    break;
                }
            }
            i++;
        }
        if (i < args.length && !reachedOptional) {
            return [false, new ParseError("Too many arguments")];
        }
        return [true, out];
    }
    public getUsage(): string {
        return this.argumentFormats
            .map((format) => {
                if (format.type === "restOfLine") {
                    return "[...]";
                }
                if (
                    ["vector3", "entityPosition", "blockPosition"].includes(
                        format.type
                    )
                ) {
                    let out: string;
                    if (format.name) {
                        out = `<${format.name}X> <${format.name}Y> <${format.name}Z>${format.type === "entityPosition" ? ` <${format.name}Yaw> <${format.name}Pitch>` : ""}`;
                    } else {
                        out =
                            `<x> <y> <z>` +
                            (format.type === "entityPosition"
                                ? ` <yaw> <pitch>`
                                : "");
                    }
                    return format.optional ? `[${out}]` : out;
                }
                if (["rangedNumber", "rangedInteger"].includes(format.type)) {
                    const rangedFormat = format as RangedNumberArgument;
                    return `${format.optional ? "[" : "<"}${rangedFormat.name ?? rangedFormat.type} (${rangedFormat.min}-${rangedFormat.max})${format.optional ? "]" : ">"}`;
                }
                if (format.optional) {
                    return `[${format.name ?? format.type}]`;
                }
                return `<${format.name ?? format.type}>`;
            })
            .join(" ");
    }
}

/**
 * A builder for creating ArgumentParsers
 * @typeParam T - The type of the parsed arguments
 */
export class ArgumentParserBuilder<T extends any[] = any[]> {
    protected argumentFormats: Argument[] = [];
    protected restOfLineSet = false;
    protected optionalSet = false;

    /** Check if more arguments can be added
     * @param optional Whether or not the argument being added is optional
     * @returns Whether or not more arguments can be added
     */
    canAdd(optional: boolean): boolean {
        if (this.optionalSet && !optional) {
            return false;
        }
        if (this.restOfLineSet) {
            return false;
        }
        return true;
    }

    /** Assert that more arguments can be added
     * @param optional Whether or not the argument being added is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    protected assertCanAdd(optional: boolean) {
        if (this.optionalSet && !optional) {
            throw new Error(
                "Cannot add required argument after optional argument"
            );
        }
        if (!this.canAdd(optional)) {
            throw new Error("Cannot add more arguments");
        }
    }

    /** Adds a string argument to the parser.
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    string(name?: string, optional = false): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({ type: "string", name, optional });
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds a number argument to the parser.
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    number(name?: string, optional = false): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({ type: "number", name, optional });
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds an integer argument to the parser.
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    integer(name?: string, optional = false): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({ type: "integer", name, optional });
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds a boolean argument to the parser.
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    boolean(name?: string, optional = false): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({ type: "boolean", name, optional });
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds an entity argument to the parser.
     * @param registry The entity registry to use
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    entity(
        registry: EntityRegistry,
        name?: string,
        optional = false
    ): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({
            type: "entity",
            registry,
            name,
            optional,
        } as EntityArgument);
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds a player argument to the parser.
     * @param registry The player registry to use
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    player(
        registry: PlayerRegistry,
        name?: string,
        optional = false
    ): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({
            type: "player",
            registry,
            name,
            optional,
        } as PlayerArgument);
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds a vector3 argument to the parser.
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    vector3(name?: string, optional = false): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({ type: "vector3", name, optional });
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds a block position argument to the parser.
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    blockPosition(name?: string, optional = false): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({ type: "blockPosition", name, optional });
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds an entity position argument to the parser.
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    entityPosition(name?: string, optional = false): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({ type: "entityPosition", name, optional });
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds a ranged number argument to the parser.
     * @param min Minimum allowed value
     * @param max Maximum allowed value
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    rangedNumber(
        min: number,
        max: number,
        name?: string,
        optional = false
    ): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({
            type: "rangedNumber",
            min,
            max,
            name,
            optional,
        } as RangedNumberArgument);
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds a ranged integer argument to the parser.
     * @param min Minimum allowed value
     * @param max Maximum allowed value
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    rangedInteger(
        min: number,
        max: number,
        name?: string,
        optional = false
    ): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({
            type: "rangedInteger",
            min,
            max,
            name,
            optional,
        } as RangedIntegerArgument);
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds a world argument to the parser.
     * @param registry The world registry to use
     * @param name Optional name for the argument
     * @param optional Whether or not the argument is optional
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    world(
        registry: WorldRegistry,
        name?: string,
        optional = false
    ): ArgumentParserBuilder<T> {
        this.assertCanAdd(optional);
        this.argumentFormats.push({
            type: "world",
            registry,
            name,
            optional,
        } as WorldArgument);
        if (optional) this.optionalSet = true;
        return this;
    }

    /** Adds a rest-of-line argument to the parser.
     * @throws Error if more arguments cannot be added
     * @throws Error if a required argument is added after an optional argument
     */
    restOfLine(): ArgumentParserBuilder<T> {
        this.assertCanAdd(false);
        this.restOfLineSet = true;
        this.argumentFormats.push({ type: "restOfLine" });
        return this;
    }
    build() {
        return new ArgumentParser<T>(this.argumentFormats);
    }
}
