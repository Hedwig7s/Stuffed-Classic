/*
    Simple function to trim the end of a network string
*/

/**
 * Sanitize a network string
 * @param str The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeNetworkString(str: string): string {
    let end = str.length;
    while (end > 0 && str[end - 1] === " ") end--;
    return str.slice(0, end);
}
