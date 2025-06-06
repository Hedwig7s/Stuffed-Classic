/*
    Encoder and decoder for structured data that allows for 2 way conversion between binary data and structured data
*/
import * as iconv from "iconv-lite";

export type ValidBinaryValues = string | number | bigint | Uint8Array;

export type StructDataFormat<T> = {
    [K in keyof T as T[K] extends ValidBinaryValues ? K : never]: T[K];
};
/**
 * Basic format entry for data
 */
interface Format<T extends StructDataFormat<T>> {
    name: string;
    key: keyof T;
    size: number;
}
export interface IntOptions {
    /** Integer size in bytes */
    size: number;
    /** Whether the integer is signed */
    signed: boolean;
}
type IntFormat<T extends StructDataFormat<T>> = Format<T> & IntOptions;
export interface StringOptions {
    type: "fixed" | "zero-terminated";
    /** If type is fixed, the length of the string */
    length?: number;
    /** Which character encoding to use. Defaults to utf-8 */
    encoding?: string;
}
type StringFormat<T extends StructDataFormat<T>> = Format<T> &
    StringOptions & {
        encoding: string;
    };
export interface FixedOptions {
    /** Integer size in bytes */
    size: number;
    /** Fixed point precision */
    point: number;
    /** Whether the number is signed */
    signed: boolean;
}
type FixedFormat<T extends StructDataFormat<T>> = Format<T> & FixedOptions;

export interface RawOptions {
    /** Size of the raw data in bytes */
    size: number;
}
type RawFormat<T extends StructDataFormat<T>> = Format<T> & RawOptions;

export interface PaddingOptions {
    /** Size of the padding in bytes */
    size: number;
}

type PaddingFormat<T extends StructDataFormat<T>> = Format<T> & PaddingOptions;

export const nativeEndianness: "big" | "little" = (() => {
    const b = new ArrayBuffer(4);
    const a = new Uint32Array(b);
    const c = new Uint8Array(b);
    a[0] = 0xdeadbeef;
    if (c[0] == 0xef) return "little";
    if (c[0] == 0xde) return "big";
    return "little";
})();

class OutOfRangeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "OutOfRangeError";
    }
}

/**
 * Decodes an integer from a byte array
 * @param format The IntFormat object
 * @param data The byte array to decode
 * @param endianness The endianness of the integer
 * @returns The decoded integer
 */
export function decodeInt(
    format: IntFormat<any>,
    data: Uint8Array,
    endianness: "big" | "little"
): bigint {
    let value = 0n;
    const start = endianness === "little" ? format.size - 1 : 0;
    const end = endianness === "little" ? -1 : format.size;
    const step = endianness === "little" ? -1 : 1;
    for (let i = start; i !== end; i += step) {
        value = value * 256n + BigInt(data[i]);
    }
    if (format.signed) {
        const max = 1n << (BigInt(format.size) * 8n);
        if (value >= max / 2n) {
            value = value - max;
        }
    }
    return value;
}

/**
 * Encodes an integer to a byte array
 * @param format The IntFormat object
 * @param value The integer to encode
 * @param endianness The endianness of the integer
 * @returns The encoded byte array
 */
export function encodeInt(
    format: IntFormat<any>,
    value: number | bigint,
    endianness: "big" | "little"
): Uint8Array {
    const out = new Uint8Array(format.size);
    let num = value;
    if (format.signed && num < 0) {
        if (num < -(1 << (format.size * 8))) {
            throw new Error(`Integer ${String(format.key)} out of range`);
        }
        if (typeof num === "bigint") {
            num = (num >> 0n) + (1n << BigInt(format.size * 8));
        } else {
            num = (num >>> 0) + (1 << (format.size * 8));
        }
    }
    for (let i = 0; i < format.size; i++) {
        if (typeof value === "bigint") {
            out[i] = Number(value & 0xffn);
            value = value >> 8n;
        } else {
            out[i] = value & 0xff;
            value = value >> 8;
        }
    }
    if (endianness === "big") {
        out.reverse();
    }
    return out;
}

/** Parser for structured binary data */
export class StructuredDataParser<T extends StructDataFormat<T>> {
    public readonly formatList: Format<T>[];
    protected endianness: "little" | "big";

    /** If undefined the final size is unknown (e.g. zero terminated string) */
    public readonly size: number | undefined;

    /**
     * Creates a new structured data parser
     * @param formatList The format list
     */
    constructor(formatList: Format<T>[]) {
        this.formatList = formatList;
        this.endianness = nativeEndianness;
        let size: number | undefined = 0;
        for (const format of formatList) {
            if (format.size < 0) {
                size = undefined;
                break;
            }
            size += format.size;
        }
        this.size = size;
    }

    verifyDecoded(decoded: Partial<T>): asserts decoded is T {
        for (const format of this.formatList) {
            if (
                decoded[format.key] == null &&
                !format.name.endsWith("endian")
            ) {
                throw new Error(
                    `Incomplete data: Key ${String(format.key)} not found`
                );
            }
        }
    }

    /**
     * Decodes binary data into structured data
     * @param inputData The binary data to decode
     * @returns The structured data
     * @throws If the data is invalid
     * @throws If the data is incomplete
     * @throws If a value is out of range
     * @throws If the data is too large
     */
    decode(inputData: Uint8Array | string | ArrayLike<number>): T {
        let data: Uint8Array;
        if (typeof inputData == "string")
            data = new TextEncoder().encode(inputData);
        else if (!(inputData instanceof Uint8Array))
            data = new Uint8Array(inputData);
        else data = inputData;
        const decoded: Partial<T> = {};
        let offset = 0;
        this.endianness = nativeEndianness;

        for (const format of this.formatList) {
            offset = this.decodeDataFormat(format, data, decoded, offset);
        }

        this.verifyDecoded(decoded);

        return decoded;
    }

    /**
     * Decodes binary data into structured data
     * @param inputData The binary data to decode
     * @returns The structured data
     * @throws If the data is invalid
     * @throws If the data is incomplete
     * @throws If a value is out of range
     * @throws If the data is too large
     */
    async decodeWaitForData(inputData: ArrayBuffer, pollInterval = 5): Promise<T> {
        const decoded: Partial<T> = {};
        let offset = 0;
        this.endianness = nativeEndianness;

        for (const format of this.formatList) {
            while (true) {
                try {
                    offset = this.decodeDataFormat(format, new Uint8Array(inputData), decoded, offset);
                }
                catch (e) {
                    if (e instanceof OutOfRangeError) {
                        const oldLength = inputData.byteLength;
                        while (format.size == null ? inputData.byteLength == oldLength : inputData.byteLength < offset + format.size) {
                            await new Promise((resolve) => setTimeout(resolve, pollInterval));
                        }
                        continue;
                    }
                    throw e;
                }
                break;
            }
        }

        this.verifyDecoded(decoded);
        
        return decoded;
    }

    protected decodeDataFormat(
        format: Format<T>,
        data: Uint8Array,
        decoded: Partial<T>,
        offset: number
    ): number {
        switch (format.name) {
            case "native-endian": {
                this.endianness = nativeEndianness;
                break;
            }
            case "little-endian": {
                this.endianness = "little";
                break;
            }
            case "big-endian": {
                this.endianness = "big";
                break;
            }
            case "integer": {
                const intFormat = format as IntFormat<T>;
                if (offset + intFormat.size - 1 >= data.length) {
                    throw new OutOfRangeError("Integer out of range");
                }
                const slice = data.subarray(
                    offset,
                    (offset += intFormat.size)
                );
                let result: bigint | number = decodeInt(
                    intFormat,
                    slice,
                    this.endianness
                );
                if (
                    result <= Number.MAX_SAFE_INTEGER &&
                    result >= Number.MIN_SAFE_INTEGER
                ) {
                    result = Number(result);
                }
                decoded[intFormat.key] = result as T[keyof T];
                break;
            }
            case "string": {
                const stringFormat = format as StringFormat<T>;
                const decode = function (slice: Uint8Array): string {
                    return new TextDecoder(stringFormat.encoding).decode(slice);
                };
                switch (stringFormat.type) {
                    case "zero-terminated": {
                        const slice = data.subarray(offset);
                        let size = 0;
                        while (true) {
                            if (size >= slice.length) {
                                throw new OutOfRangeError(
                                    "Unterminated zero-terminated string"
                                );
                            }
                            const b = slice[size];
                            if (b === 0) {
                                decoded[stringFormat.key] = decode(
                                    slice.subarray(0, size)
                                ) as T[keyof T];
                                offset += size + 1;
                                break;
                            }
                            size++;
                        }
                        break;
                    }
                    case "fixed": {
                        if (stringFormat.length == null) {
                            throw new Error(
                                "Fixed string length must be specified"
                            );
                        }
                        if (offset + stringFormat.length - 1 >= data.length) {
                            throw new OutOfRangeError("Fixed string out of range");
                        }
                        const slice = data.subarray(
                            offset,
                            (offset += stringFormat.length)
                        );
                        decoded[stringFormat.key] = decode(
                            slice
                        ) as T[keyof T];
                        break;
                    }
                    default: {
                        throw new Error(
                            `Unknown string type: ${stringFormat.type}`
                        );
                    }
                }
                break;
            }
            case "float": {
                if (offset + 4 - 1 >= data.length) {
                    throw new OutOfRangeError("Float out of range");
                }
                decoded[format.key] = new DataView(data.buffer).getFloat32(
                    offset,
                    this.endianness === "little"
                ) as T[keyof T];
                offset += 4;
                break;
            }
            case "double": {
                if (offset + 8 - 1 >= data.length) {
                    throw new OutOfRangeError("Double out of range");
                }
                decoded[format.key] = new DataView(data.buffer).getFloat64(
                    offset,
                    this.endianness === "little"
                ) as T[keyof T];
                offset += 8;
                break;
            }
            case "fixed": {
                const fixedFormat = format as FixedFormat<T>;
                if (offset + fixedFormat.size - 1 >= data.length) {
                    throw new OutOfRangeError("Fixed out of range");
                }
                const slice = data.subarray(
                    offset,
                    (offset += fixedFormat.size)
                );
                const value = decodeInt(
                    { ...fixedFormat, name: "integer" },
                    slice,
                    this.endianness
                );
                if (value > Number.MAX_SAFE_INTEGER) {
                    throw new Error("Fixed point too large");
                }
                const divisor = Math.pow(2, fixedFormat.point);
                const result = Number(value) / divisor;
                if (!Number.isFinite(result)) {
                    throw new Error("Resulting float is too large");
                }
                decoded[fixedFormat.key] = result as T[keyof T];
                break;
            }
            case "raw": {
                const rawFormat = format as RawFormat<T>;
                if (offset + rawFormat.size - 1 >= data.length) {
                    throw new OutOfRangeError("Fixed out of range");
                }
                const slice = data.subarray(
                    offset,
                    (offset += rawFormat.size)
                );
                decoded[rawFormat.key] = slice as T[keyof T];
                break;
            }
            case "padding": {
                const paddingFormat = format as PaddingFormat<T>;
                offset += paddingFormat.size;
                break;
            }
            default: {
                throw new Error(`Unknown format: ${format.name}`);
            }
        }
        return offset;
    }
    /**
     * Validates the data against the format
     * @param data The data to validate
     * @returns Whether the data is valid and an error message if not
     */
    validate(data: T): [true] | [false, string] {
        for (const format of this.formatList) {
            const value = data[format.key as keyof T];
            if (value == null && !format.name.endsWith("endian")) {
                return [false, `Key ${String(format.key)} not found in data`];
            }
        }
        return [true];
    }
    /**
     * Encodes structured data into binary data
     * @param data The structured data to encode
     * @returns The binary data
     * @throws If the data does not match the format
     */
    encode(data: T): Uint8Array {
        let out = new Uint8Array(256);
        let offset = 0;
        this.endianness = nativeEndianness;
        /** Checks that the data can fit into the buffer otherwise expands it
         * @param add The number of bytes to add
         */
        function checkSize(add: number) {
            if (offset + add >= out.length) {
                let newLength = out.length;
                while (offset + add >= newLength) {
                    newLength *= 2;
                }
                const newOut = new Uint8Array(newLength);
                newOut.set(out);
                out = newOut;
            }
        }
        const [valid, error] = this.validate(data);
        if (!valid) {
            throw new Error(`Data does not match format: ${error}`);
        }
        for (const format of this.formatList) {
            const value = data[format.key as keyof T];
            if (
                value == null &&
                !format.name.endsWith("endian") &&
                format.name !== "padding"
            ) {
                throw new Error(`Key ${String(format.key)} not found in data`);
            }
            switch (format.name) {
                case "native-endian": {
                    this.endianness = nativeEndianness;
                    break;
                }
                case "little-endian": {
                    this.endianness = "little";
                    break;
                }
                case "big-endian": {
                    this.endianness = "big";
                    break;
                }
                case "integer": {
                    if (
                        typeof value !== "number" &&
                        typeof value !== "bigint"
                    ) {
                        throw new Error(
                            `Key ${String(format.key)} is not a number`
                        );
                    }
                    if (typeof value !== "bigint" && value % 1 !== 0) {
                        throw new Error(
                            `Key ${String(format.key)} is not an integer`
                        );
                    }
                    const intFormat = format as IntFormat<T>;
                    checkSize(intFormat.size);
                    out.set(
                        encodeInt(intFormat, value, this.endianness),
                        offset
                    );
                    offset += intFormat.size;
                    break;
                }
                case "string": {
                    if (typeof value !== "string") {
                        throw new Error(
                            `Key ${String(format.key)} is not a string`
                        );
                    }
                    const str = value as string;
                    const stringFormat = format as StringFormat<T>;
                    let padLength = str.length;
                    if (
                        stringFormat.type === "fixed" &&
                        stringFormat.length == null
                    ) {
                        throw new Error("Invalid fixed length");
                    } else if (stringFormat.length) {
                        padLength = stringFormat.length;
                    }
                    if (
                        stringFormat.type === "fixed" &&
                        str.length > padLength
                    ) {
                        throw new Error(
                            `String ${String(format.key)} is too long`
                        );
                    }
                    const encoding = stringFormat.encoding || "utf-8";
                    if (!iconv.encodingExists(encoding)) {
                        throw new Error("Invalid encoding: " + encoding);
                    }
                    const encodedValue =
                        stringFormat.type === "zero-terminated"
                            ? str + "\0"
                            : str.padEnd(padLength, " ");
                    const encoded = new Uint8Array(
                        iconv.encode(encodedValue, encoding)
                    );

                    checkSize(encoded.length);
                    out.set(encoded, offset);
                    offset += encoded.length;
                    break;
                }
                case "float": {
                    if (typeof value !== "number") {
                        throw new Error(
                            `Key ${String(format.key)} is not a number`
                        );
                    }
                    checkSize(4);
                    new DataView(out.buffer).setFloat32(
                        offset,
                        value,
                        this.endianness === "little"
                    );
                    offset += 4;
                    break;
                }
                case "double": {
                    if (typeof value !== "number") {
                        throw new Error(
                            `Key ${String(format.key)} is not a number`
                        );
                    }
                    checkSize(8);
                    new DataView(out.buffer).setFloat64(
                        offset,
                        value,
                        this.endianness === "little"
                    );
                    offset += 8;
                    break;
                }
                case "fixed": {
                    if (typeof value !== "number") {
                        throw new Error(
                            `Key ${String(format.key)} is not a number`
                        );
                    }
                    const fixedFormat = format as FixedFormat<T>;
                    const fixedValue = Math.floor(
                        value * (1 << fixedFormat.point)
                    );
                    const [minValue, maxValue] = [
                        -(1 << (fixedFormat.size * 8 - 1)),
                        (1 << (fixedFormat.size * 8 - 1)) - 1,
                    ];
                    if (fixedValue < minValue || fixedValue > maxValue) {
                        throw new Error(
                            `Fixed value ${String(format.key)} out of range. Value ${value}, Fixed value ${fixedValue}`
                        );
                    }
                    checkSize(fixedFormat.size);
                    out.set(
                        encodeInt(
                            { ...fixedFormat, name: "integer" },
                            fixedValue,
                            this.endianness
                        ),
                        offset
                    );
                    offset += fixedFormat.size;
                    break;
                }
                case "raw": {
                    if (!((value as any) instanceof Uint8Array)) {
                        throw new Error(
                            `Key ${String(format.key)} is not a Uint8Array!`
                        );
                    }
                    const array = value as Uint8Array;
                    const rawFormat = format as RawFormat<T>;
                    if (array.byteLength > rawFormat.size) {
                        throw new Error("Provided Uint8Array is too big!");
                    }
                    checkSize(rawFormat.size);
                    const newarray = new Uint8Array(rawFormat.size).fill(0);
                    newarray.set(array);
                    out.set(newarray, offset);
                    offset += rawFormat.size;
                    break;
                }
                case "padding": {
                    const paddingFormat = format as PaddingFormat<T>;
                    checkSize(paddingFormat.size);
                    out.set(new Uint8Array(paddingFormat.size).fill(0));
                    offset += paddingFormat.size;
                    break;
                }
                default: {
                    throw new Error("Unknown format " + format.name);
                }
            }
        }
        return out.subarray(0, offset);
    }
}
export class StructuredParserBuilder<T extends StructDataFormat<T>> {
    private formatList: Format<any>[] = [];

    integer(key: keyof T, options: IntOptions): this {
        this.formatList.push({
            name: "integer",
            key: key,
            ...options,
        });
        return this;
    }

    uint8(key: keyof T): this {
        return this.integer(key, {
            size: 1,
            signed: false,
        });
    }

    int8(key: keyof T) {
        return this.integer(key, {
            size: 1,
            signed: true,
        });
    }
    uint16(key: keyof T) {
        return this.integer(key, {
            size: 2,
            signed: false,
        });
    }
    int16(key: keyof T) {
        return this.integer(key, {
            size: 2,
            signed: true,
        });
    }
    uint32(key: keyof T) {
        return this.integer(key, {
            size: 4,
            signed: false,
        });
    }
    int32(key: keyof T) {
        return this.integer(key, {
            size: 4,
            signed: true,
        });
    }
    uint64(key: keyof T) {
        return this.integer(key, {
            size: 8,
            signed: false,
        });
    }
    int64(key: keyof T) {
        return this.integer(key, {
            size: 8,
            signed: true,
        });
    }

    float(key: keyof T): this {
        this.formatList.push({
            name: "float",
            key: key,
            size: 4,
        });
        return this;
    }

    double(key: keyof T): this {
        this.formatList.push({
            name: "double",
            key: key,
            size: 8,
        });
        return this;
    }

    fixed(key: keyof T, options: FixedOptions): this {
        if (options.point > options.size * 8) {
            throw new Error("Fixed point out of range");
        }
        this.formatList.push({
            name: "fixed",
            key: key,
            ...options,
        });
        return this;
    }

    string(key: keyof T, options: StringOptions): this {
        const format: StringFormat<T> = {
            name: "string",
            key: key,
            ...options,
            encoding: options.encoding ?? "ascii",
            size: options.length ?? -1,
        };
        this.formatList.push(format);
        return this;
    }

    zeroTerminatedString(key: keyof T, encoding?: string): this {
        return this.string(key, {
            type: "zero-terminated",
            encoding: encoding,
        });
    }

    fixedString(key: keyof T, length: number, encoding?: string): this {
        return this.string(key, {
            type: "fixed",
            length: length,
            encoding: encoding,
        });
    }
    raw(key: keyof T, size: number) {
        const format: RawFormat<T> = {
            size: size,
            name: "raw",
            key: key,
        };
        this.formatList.push(format);
        return this;
    }
    padding(size: number) {
        this.formatList.push({
            size,
            key: "",
            name: "padding",
        });
    }
    nativeEndian(): this {
        this.formatList.push({
            name: "native-endian",
            key: "",
            size: 0,
        });
        return this;
    }

    littleEndian(): this {
        this.formatList.push({
            name: "little-endian",
            key: "",
            size: 0,
        });
        return this;
    }

    bigEndian(): this {
        this.formatList.push({
            name: "big-endian",
            key: "",
            size: 0,
        });
        return this;
    }

    build(): StructuredDataParser<T> {
        return new StructuredDataParser<T>(this.formatList);
    }
}
