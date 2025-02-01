/*
    Metadata for protocol version 7
*/

import type { Protocol } from "networking/protocol/protocol";
import { PACKETS } from "./packets";

export const protocol7: Protocol = {
    version: 7,
    packets: PACKETS,
    checkIdentifier(identifier: Uint8Array): boolean {
        return identifier[1] === this.version;
    },
};
export default protocol7;
