export function sanitizeNetworkString(str: string): string {
    let end = 1;
    while (end <= str.length && str[end-1] !== " ") end++;
    return str.slice(1,end);
}
