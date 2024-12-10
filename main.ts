import { ContextManager } from "contextmanager";

export function main() {
    const contextManager = new ContextManager();

    const mainConfig = contextManager.config.main.config;

    contextManager.server.start(mainConfig.server.host, mainConfig.server.port);
}
if (import.meta.main) {
    main();
}
