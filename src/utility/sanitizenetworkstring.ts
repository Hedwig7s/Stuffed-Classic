/*
    Simple function to trim the end of a network string
*/

export function sanitizeNetworkString(str: string): string {
    let end = str.length;
    while (end > 0 && str[end - 1] === " ") end--;
    return str.slice(0, end);
}
