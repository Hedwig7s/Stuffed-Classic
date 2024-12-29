import { getServerContext } from "servercontext";

export async function main() {
    const serverContext = await getServerContext();
    const server = serverContext.server;
    const configRecord = serverContext.config;
    const host = configRecord.server.config.server.host;
    const port = configRecord.server.config.server.port;
    server.start(host, port);
}
if (import.meta.main) {
    main();
}
