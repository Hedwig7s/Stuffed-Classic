/**
 * A registry for services or other objects that need to be accessed by name
 * Allows for providing specific services without necessarily depending on them
 */
export class ServiceRegistry<ServiceMap extends Partial<ServiceMap> = any> {
    private services = new Map<
        keyof ServiceMap,
        ServiceMap[keyof ServiceMap]
    >();
    /**
     * Register a service with the registry
     * @param name The name of the service
     * @param service The service to register
     */
    public register<K extends keyof ServiceMap>(
        name: K,
        service: ServiceMap[K]
    ): void {
        this.services.set(name, service);
    }

    /**
     * Assert that a service is in the registry and return it
     * @param name The name of the service
     * @returns The service
     * @throws If the service is not found
     */
    public assertGet<K extends keyof ServiceMap>(name: K): ServiceMap[K] {
        const service = this.services.get(name);
        if (!service) throw new Error(`Service ${String(name)} not found`);
        return service as ServiceMap[K];
    }

    /**
     * Get a service from the registry
     * @param name The name of the service
     * @returns The service
     */
    public get<K extends keyof ServiceMap>(name: K): ServiceMap[K] | undefined {
        return this.services.get(name) as ServiceMap[K] | undefined;
    }

    /**
     * Register multiple services with the registry
     * @param services The services to register
     */
    public registerMultiple(services: Partial<ServiceMap>): void {
        for (const [name, service] of Object.entries(services)) {
            this.register(
                name as keyof ServiceMap,
                service as ServiceMap[keyof ServiceMap]
            );
        }
    }
    /**
     * Create a new service registry
     * @param services Services to register at creation
     */
    constructor(services?: Partial<ServiceMap>) {
        if (services) {
            this.registerMultiple(services);
        }
    }
}
