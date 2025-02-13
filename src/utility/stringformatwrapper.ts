/*
    A wrapper for the StructuredParserBuilder class with Lua-like format strings
*/

import { StructuredParserBuilder, type ValidBinaryValues } from "./datastruct";

type ParserBuildingState = "none" | "sizedValue";

const INT_CHARS = {
    b: 1,
    h: 2,
    l: 4,
};

/**
 * Process a format string
 * @param format The format string
 * @param encoding The encoding to use for strings
 * @param builder The structured parser builder to use
 * @returns The structured parser builder
 * @throws {Error} If the format string is invalid
 */
function processFormat(
    format: string,
    encoding = "utf-8",
    builder = new StructuredParserBuilder<Record<number, ValidBinaryValues>>()
) {
    let state: ParserBuildingState = "none";
    let sizedValueData:
        | {
              size: string;
              intSigned?: boolean;
              type: "integer" | "fstring" | "raw";
          }
        | undefined;

    let valueIndex = 0;
    format += " ";

    for (let i = 0; i < format.length; i++) {
        const char = format[i];
        if (state === "sizedValue") {
            if (!sizedValueData) {
                throw new Error(
                    `Invalid state at position ${i}: sizedValueData is undefined`
                );
            }
            if (!Number.isNaN(Number.parseInt(char))) {
                sizedValueData.size += char;
            } else {
                if (sizedValueData.size.length === 0) {
                    throw new Error(
                        `Invalid ${
                            sizedValueData.type
                        } at position ${i - 1}: No size specified`
                    );
                }
                const size = Number.parseInt(sizedValueData.size);
                switch (sizedValueData.type) {
                    case "integer": {
                        builder.integer(valueIndex++, {
                            signed: sizedValueData.intSigned as boolean,
                            size,
                        });
                        break;
                    }
                    case "fstring": {
                        builder.fixedString(valueIndex++, size, encoding);
                        break;
                    }
                    case "raw": {
                        builder.raw(valueIndex++, size);
                        break;
                    }
                }
                sizedValueData = undefined;
                state = "none";
            }
        }

        if (state === "none") {
            let intSize: number;
            if (
                (intSize =
                    INT_CHARS[char.toLowerCase() as keyof typeof INT_CHARS])
            ) {
                builder.integer(valueIndex++, {
                    size: intSize,
                    signed: char.toLowerCase() === char,
                });
            } else if (char === "=") {
                builder.nativeEndian();
            } else if (char === "<") {
                builder.littleEndian();
            } else if (char === ">") {
                builder.bigEndian();
            } else if (char === "f") {
                builder.float(valueIndex++);
            } else if (char === "d") {
                builder.double(valueIndex++);
            } else if (char === "x") {
                builder.padding(1);
            } else if (char === "z") {
                builder.zeroTerminatedString(valueIndex++, encoding);
            } else if (char === "r") {
                state = "sizedValue";
                sizedValueData = { size: "", type: "raw" };
            } else if (char.toLowerCase() === "i") {
                state = "sizedValue";
                sizedValueData = {
                    size: "",
                    intSigned: char.toLowerCase() === char,
                    type: "integer",
                };
            } else if (char === "c") {
                state = "sizedValue";
                sizedValueData = { size: "", type: "fstring" };
            } else if (char !== " ") {
                throw new Error(`Invalid character at position ${i}: ${char}`);
            }
        }
    }

    return builder;
}

/**
 * A wrapper for the StructuredParserBuilder class with Lua-like format strings
 */
export class FormatStringParserWrapper {
    public readonly size: number | undefined;
    public readonly format: string;
    public readonly encoding: string;
    protected parser: ReturnType<StructuredParserBuilder<any>["build"]>;

    /**
     * Create a new FormatStringParserWrapper
     * @param format The format string
     * @param encoding The encoding to use for strings
     * @throws {Error} If the format string is invalid
     */
    constructor(format: string, encoding = "utf-8") {
        const builder = processFormat(format, encoding);
        this.parser = builder.build();
        this.size = this.parser.size;
        this.format = format;
        this.encoding = encoding;
    }

    /**
     * Pack data into binary
     * @param data The data to pack
     * @returns The packed binary data
     */
    public pack(...data: ValidBinaryValues[]): Uint8Array {
        return this.parser.encode(
            data.reduce(
                (acc: Record<number, ValidBinaryValues>, value, index) => {
                    acc[index] = value;
                    return acc;
                },
                {}
            )
        );
    }

    /**
     * Unpack binary data
     * @param data The binary data to unpack
     * @returns The unpacked data
     */
    public unpack(
        data: Uint8Array | string | ArrayLike<number>
    ): ValidBinaryValues[] {
        return Object.entries(this.parser.decode(data))
            .sort(([k1], [k2]) => Number(k1) - Number(k2))
            .map(([, v]) => v) as ValidBinaryValues[];
    }
}

/**
 * Pack data into binary using a format string
 * @param format The format string
 * @param data The data to pack
 * @returns The packed binary data
 * @throws {Error} If the format string is invalid
 */
export function pack(format: string, ...data: ValidBinaryValues[]) {
    return new FormatStringParserWrapper(format).pack(...data);
}

/**
 * Unpack binary data using a format string
 * @param format The format string
 * @param data The binary data to unpack
 * @returns The unpacked data
 * @throws {Error} If the format string is invalid
 */
export function unpack(
    format: string,
    data: Uint8Array | string | ArrayLike<number>
) {
    return new FormatStringParserWrapper(format).unpack(data);
}
