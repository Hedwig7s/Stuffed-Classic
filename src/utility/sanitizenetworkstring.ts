export function sanitizeNetworkString(str: string): string {
    return str.replace(/ *$/, "");
}
