import json5 from "json5";
import toml from "smol-toml";
import yaml from "yaml";
import xml from "fast-xml-parser";

export interface FileFormatHandler {
    handler: {
        stringify: typeof JSON.stringify;
        parse: typeof JSON.parse;
    };
    extension: string;
}

export const handlers = {
    json5: {
        extension: "json5",
        handler: json5,
    },
    json: {
        extension: "json",
        handler: JSON,
    },
    yaml: {
        extension: "yml",
        handler: yaml,
    },
    toml: {
        extension: "toml",
        handler: {
            // I love hacky nonsense
            stringify(
                value: any,
                replacer?:
                    | ((this: any, key: string, value: any) => any)
                    | (number | string)[]
                    | null
            ): string {
                if (replacer) {
                    const json = JSON.stringify(value, replacer as any);
                    value = JSON.parse(json);
                }
                return toml.stringify(value);
            },
            parse(
                text: string,
                reviver:
                    | ((this: any, key: string, value: any) => any)
                    | undefined
            ) {
                if (reviver) {
                    return JSON.parse(
                        JSON.stringify(toml.parse(text)),
                        reviver
                    );
                }
                return toml.parse(text);
            },
        },
    },
    xml: {
        extension: "xml",
        handler: {
            // More hacky nonsense :D
            stringify(
                value: any,
                replacer?:
                    | ((this: any, key: string, value: any) => any)
                    | (number | string)[]
                    | null,
                space?: number
            ): string {
                if (replacer) {
                    const json = JSON.stringify(value, replacer as any);
                    value = JSON.parse(json);
                }
                const parser = new xml.XMLBuilder({
                    format: true,
                    indentBy: " ".repeat(space ?? 4),
                });
                return parser.build(value) as string;
            },
            parse(
                text: string,
                reviver:
                    | ((this: any, key: string, value: any) => any)
                    | undefined
            ) {
                const parser = new xml.XMLParser();
                if (reviver) {
                    return JSON.parse(
                        JSON.stringify(parser.parse(text)),
                        reviver
                    );
                }
                return parser.parse(text);
            },
        },
    },
};
