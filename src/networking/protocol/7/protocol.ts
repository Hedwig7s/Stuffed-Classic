import type { Protocol } from "networking/protocol/protocol";
import { PACKETS } from "./packets";

export const protocol7: Protocol = {
    version: 7,
    packets: PACKETS,
    checkIdentifier(identifier: Uint8Array): boolean {
        return identifier[0] === this.version;
    },
};
export default protocol7;