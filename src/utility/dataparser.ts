import { InvalidArgumentError, OutOfRangeError, ValueError } from "utility/genericerrors";

interface Format {
    name:string,
    key:string,
}
export interface IntOptions {
    size: number,
    signed: boolean,
}
type IntFormat = Format & IntOptions;
export interface StringOptions {
    type: "fixed"|"zero-terminated"
    length?: number,
    encoding?: BufferEncoding,
}
type StringFormat = Format & StringOptions & {
    encoding: BufferEncoding
};
export interface FixedOptions {
    size: number,
    point: number,
    signed: boolean,
}
type FixedFormat = Format & FixedOptions

const nativeEndianness: "big"|"little" = (() => {
    const b = new ArrayBuffer(4);
    const a = new Uint32Array(b);
    const c = new Uint8Array(b);
    a[0] = 0xdeadbeef;
    if (c[0] == 0xef) return 'little';
    if (c[0] == 0xde) return 'big';
    throw new ValueError('unknown endianness');
})();
  
function parseInt(format: IntFormat, data: Uint8Array, endianness: "big" | "little"): number {
    let value = 0;
    const start = endianness === "little" ? format.size - 1 : 0;
    const end = endianness === "little" ? -1 : format.size;
    const step = endianness === "little" ? -1 : 1;
    for (let i = start; i !== end; i += step) {
        value = value * 256 + data[i];
    }
    if (format.signed) {
        const max = 1 << (format.size * 8);
        if (value >= max / 2) {
            value = value - max;
        }
    }
    return value;
  }


function encodeInt(format:IntFormat, value:number, endianness: "big"|"little"): Uint8Array {
    const out = new Uint8Array(format.size);
    let num = value;
    if (format.signed && num < 0) {
        if (num < -(1 << (format.size * 8))) {
            throw new OutOfRangeError(`Integer ${format.key} out of range`);
        }
        num = (num >>> 0) + (1 << (format.size * 8));
    }
    for (let i = 0; i < format.size; i++) {
        out[i] = value & 0xff;
        value = value >> 8;
    }
    if (endianness === "big") {
        out.reverse();
    }
    return out;
}

export class BinaryParser<T extends object> {
    private readonly formatList: Format[];
    private endianness: "little" | "big";

    constructor(formatList: Format[]) {
        this.formatList = formatList;
        this.endianness = nativeEndianness;
    }

    parse(data: Uint8Array): T {
        const parsed: Record<string, number|string> = {};
        let offset = 0;
        this.endianness = nativeEndianness;
        for (const format of this.formatList) {
            switch (format.name) {
                case 'native-endian': {
                    this.endianness = nativeEndianness;
                    break;
                }
                case 'little-endian': {
                    this.endianness = "little";
                    break;
                }
                case 'big-endian': {
                    this.endianness = "big";
                    break;
                }
                case 'integer': {
                    const intFormat = format as IntFormat;
                    if (offset + intFormat.size - 1 >= data.length) {
                        throw new OutOfRangeError("Integer out of range");
                    }
                    const slice = data.subarray(offset, offset += intFormat.size);
                    parsed[intFormat.key] = parseInt(intFormat, slice, this.endianness);
                    break;
                }
                case 'string': {
                    const stringFormat = format as StringFormat;
                    function decode(slice: Uint8Array) : string {
                        return new TextDecoder(stringFormat.encoding).decode(slice);
                    }
                    switch(stringFormat.type) {
                        case "zero-terminated": {
                            const slice = data.subarray(offset);
                            let size = 0;
                            while(true) {
                                if (size >= slice.length) {
                                    throw new OutOfRangeError("Unterminated zero-terminated string");
                                }
                                const b = slice[size];
                                if(b === 0) {
                                    parsed[stringFormat.key] = decode(slice.subarray(0, size));
                                    offset += size + 1;
                                    break;
                                }
                                size++;
                            }
                            break;
                        }
                        case "fixed": {
                            if (stringFormat.length == null) {
                                throw new InvalidArgumentError("Fixed string length must be specified");
                            }
                            if (offset + stringFormat.length - 1 >= data.length) {
                                throw new OutOfRangeError("Fixed string out of range");
                            }
                            const slice = data.subarray(offset, offset += stringFormat.length);
                            parsed[stringFormat.key] = decode(slice);
                            break;
                        }
                        default: {
                            throw new InvalidArgumentError(`Unknown string type: ${stringFormat.type}`);
                        }
                    }
                    break;
                }
                case "float": {
                    if (offset + 4 - 1 >= data.length) {
                        throw new OutOfRangeError("Float out of range");
                    }
                    parsed[format.key] = new DataView(data.buffer).getFloat32(offset, this.endianness === "little");
                    offset += 4;
                    break;
                }
                case "double": {
                    if (offset + 8 - 1 >= data.length) {
                        throw new OutOfRangeError("Double out of range");
                    }
                    parsed[format.key] = new DataView(data.buffer).getFloat64(offset, this.endianness === "little");
                    offset += 8;
                    break;
                }
                case "fixed": {
                    const fixedFormat = format as FixedFormat;
                    if (offset + fixedFormat.size - 1 >= data.length) {
                        throw new OutOfRangeError("Fixed out of range");
                    }
                    const slice = data.subarray(offset, offset += fixedFormat.size);
                    const value = parseInt({...fixedFormat, name: "integer"}, slice, this.endianness);
                    parsed[fixedFormat.key] = value / (1 << fixedFormat.point);
                    break;
                }
                
                default: {
                    throw new InvalidArgumentError(`Unknown format: ${format.name}`);
                }
            }
        }
        for (const format of this.formatList) {
            if (parsed[format.key] == null && !format.name.endsWith("endian")) {
                throw new ValueError(`Incomplete data: Key ${format.key} not found`);
                break;
            }
        }

        return parsed as T;
    }
    encode(data: T): Uint8Array {
        let out = new Uint8Array(256);
        let offset = 0;
        this.endianness = nativeEndianness;
        function checkSize(add: number) {
            if (offset + add >= out.length) {
                const newOut = new Uint8Array(out.length * 2);
                newOut.set(out);
                out = newOut;
            }
        }
        for (const format of this.formatList) {
            const value = data[format.key as keyof T];
            if (value == null && !format.name.endsWith("endian")) {
                throw new InvalidArgumentError(`Key ${format.key} not found in data`);
            }
            switch (format.name) {
                case 'native-endian': {
                    this.endianness = nativeEndianness;
                    break;
                }
                case 'little-endian': {
                    this.endianness = "little";
                    break;
                }
                case 'big-endian': {
                    this.endianness = "big";
                    break;
                }
                case 'integer': {
                    if (typeof value !== "number") {
                        throw new InvalidArgumentError(`Key ${format.key} is not a number`);
                    }
                    if (value % 1 !== 0) {
                        throw new InvalidArgumentError(`Key ${format.key} is not an integer`);
                    }
                    const intFormat = format as IntFormat;
                    checkSize(intFormat.size);
                    out.set(encodeInt(intFormat, value, this.endianness), offset);
                    offset += intFormat.size;
                    break;
                }
                case 'string': {
                    if (typeof value !== "string") {
                        throw new InvalidArgumentError(`Key ${format.key} is not a string`); 
                    }
                    const stringFormat = format as StringFormat;
                    if (stringFormat.type == "fixed" && value.length > (stringFormat.length ?? value.length)) {
                        throw new InvalidArgumentError(`String ${format.key} is too long`);
                    }
                    const encoded = new Uint8Array(Buffer.from(stringFormat.type == "zero-terminated" ? value + "\0" 
                                                                : value.padEnd(stringFormat.length ?? value.length, " "), 
                                                                stringFormat.encoding));
                    checkSize(encoded.length);
                    out.set(encoded, offset);
                    offset += encoded.length;
                    break;
                }
                case 'float': {
                    if (typeof value !== "number") {
                        throw new InvalidArgumentError(`Key ${format.key} is not a number`);
                    }
                    checkSize(4);
                    new DataView(out.buffer).setFloat32(offset, value, this.endianness === "little");
                    offset += 4;
                    break;
                }
                case 'double': {
                    if (typeof value !== "number") {
                        throw new InvalidArgumentError(`Key ${format.key} is not a number`);
                    }
                    checkSize(8);
                    new DataView(out.buffer).setFloat64(offset, value, this.endianness === "little");
                    offset += 8;
                    break;
                }
                case 'fixed': {
                    if (typeof value !== "number") {
                        throw new InvalidArgumentError(`Key ${format.key} is not a number`);
                    }
                    const fixedFormat = format as FixedFormat;
                    const fixedValue = Math.floor(value * (1 << fixedFormat.point));
                    if (fixedValue < -(1 << (fixedFormat.size * 8 - 1)) || fixedValue >= (1 << (fixedFormat.size * 8 - 1))) {
                        throw new InvalidArgumentError(`Fixed value ${format.key} out of range`);
                    }
                    checkSize(fixedFormat.size);
                    out.set(encodeInt({...fixedFormat, name: "integer"}, fixedValue, this.endianness), offset);
                    offset += fixedFormat.size;
                    break;
                }
                default: {
                    throw new InvalidArgumentError("Unknown format "+format.name);
                }
            }

        }
        return out.subarray(0, offset);
    }
}

export class ParserBuilder<T extends object> {
    private formatList: Format[] = [];

    integer(key: string, options: IntOptions): this {
        this.formatList.push({
            name: 'integer',
            key: key,
            ...options,
        });
        return this;
    }

    uint8(key: string): this {
        return this.integer(key, {
            size: 1,
            signed: false,
        });
    }

    int8(key: string) {
        return this.integer(key, {
            size: 1,
            signed: true,
        });
    }
    uint16(key: string) {
        return this.integer(key, {
            size: 2,
            signed: false,
        });
    }
    int16(key: string) {
        return this.integer(key, {
            size: 2,
            signed: true,
        });
    }
    uint32(key: string) {
        return this.integer(key, {
            size: 4,
            signed: false,
        });
    }
    int32(key: string) {
        return this.integer(key, {
            size: 4,
            signed: true,
        });
    }
    uint64(key: string) {
        return this.integer(key, {
            size: 8,
            signed: false,
        });
    }
    int64(key: string) {
        return this.integer(key, {
            size: 8,
            signed: true,
        });
    }

    float(key: string): this {
        this.formatList.push({
            name: 'float',
            key: key,
        });
        return this;
    }

    double(key: string): this {
        this.formatList.push({
            name: 'double',
            key: key,
        });
        return this;
    }

    fixed(key: string, options: FixedOptions): this {
        if (options.point > options.size * 8) {
            throw new OutOfRangeError("Fixed point out of range");
        }
        this.formatList.push({
            name: 'fixed',
            key: key,
            ...options,
        });
        return this;
    }

    string(key: string, options: StringOptions): this {
        const format: StringFormat = {
            name: 'string',
            key: key,
            ...options,
            encoding: options.encoding ?? "ascii"
        };
        this.formatList.push(format);
        return this;
    }

    zeroTerminatedString(key: string, encoding?: BufferEncoding): this {
        return this.string(key, {
            type: "zero-terminated",
            encoding: encoding,
        });
    }

    fixedString(key: string, length: number, encoding?: BufferEncoding): this {
        return this.string(key, {
            type: "fixed",
            length: length,
            encoding: encoding,
        });
    }

    nativeEndian(): this {
        this.formatList.push({
            name: 'native-endian',
            key: '',
        });
        return this;
    }

    littleEndian(): this {
        this.formatList.push({
            name: 'little-endian',
            key: '',
        });
        return this;
    }

    bigEndian(): this {
        this.formatList.push({
            name: 'big-endian',
            key: '',
        });
        return this;
    }

    build(): BinaryParser<T> {
        return new BinaryParser<T>(this.formatList);
    }
}