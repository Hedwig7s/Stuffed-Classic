/*
    Main entry point for the server
*/

import { getServerContext } from "servercontext";

export async function main() {
    const serverContext = await getServerContext();
    const server = serverContext.server;
    const configRecord = serverContext.config;
    const host = configRecord.server.data.server.host;
    const port = configRecord.server.data.server.port;
    server.start(host, port);
    if (configRecord.server.data.heartbeat.enabled) {
        serverContext.heartbeat.start();
    }
}
if (import.meta.main) {
    main();
}
