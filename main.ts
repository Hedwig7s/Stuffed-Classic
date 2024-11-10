import { ContextManager } from 'contextmanager';


function main() {
    const contextManager = new ContextManager();
    for (const config of Object.values(contextManager.config)) {
        config.load();
    }
    
    const mainConfig = contextManager.config.main.config;
    
    contextManager.server.start(mainConfig.server.host, mainConfig.server.port);
}
if (import.meta.main) {
    main();
}