export function mapIndexOf<K, V>(map: Map<K, V>, value: V): K | undefined {
    for (const [key, val] of map) {
        if (val === value) {
            return key;
        }
    }
    return undefined;
}
