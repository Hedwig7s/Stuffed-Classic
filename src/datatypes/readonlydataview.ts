export class ReadonlyDataView {
    private dataView: DataView;
    public get buffer() {
        return structuredClone(this.dataView.buffer);
    }

    constructor(buffer: ArrayBufferLike) {
        this.dataView = new DataView(buffer);
    }

    // Getter methods to access the DataView
    getInt8(byteOffset: number): number {
        return this.dataView.getInt8(byteOffset);
    }

    getUint8(byteOffset: number): number {
        return this.dataView.getUint8(byteOffset);
    }

    getInt16(byteOffset: number, littleEndian?: boolean): number {
        return this.dataView.getInt16(byteOffset, littleEndian);
    }

    getUint16(byteOffset: number, littleEndian?: boolean): number {
        return this.dataView.getUint16(byteOffset, littleEndian);
    }

    getInt32(byteOffset: number, littleEndian?: boolean): number {
        return this.dataView.getInt32(byteOffset, littleEndian);
    }

    getUint32(byteOffset: number, littleEndian?: boolean): number {
        return this.dataView.getUint32(byteOffset, littleEndian);
    }

    getFloat32(byteOffset: number, littleEndian?: boolean): number {
        return this.dataView.getFloat32(byteOffset, littleEndian);
    }

    getFloat64(byteOffset: number, littleEndian?: boolean): number {
        return this.dataView.getFloat64(byteOffset, littleEndian);
    }
}
export default ReadonlyDataView;
