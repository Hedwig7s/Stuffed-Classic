/*
    Registry for services or other objects that need to be accessed by name
    Allows for providing specific services without necessarily depending on them
*/

export class ServiceRegistry<ServiceMap extends Partial<ServiceMap> = any> {
    private services = new Map<
        keyof ServiceMap,
        ServiceMap[keyof ServiceMap]
    >();

    public register<K extends keyof ServiceMap>(
        name: K,
        service: ServiceMap[K]
    ): void {
        this.services.set(name, service);
    }

    public assertGet<K extends keyof ServiceMap>(name: K): ServiceMap[K] {
        const service = this.services.get(name);
        if (!service) throw new Error(`Service ${String(name)} not found`);
        return service as ServiceMap[K];
    }

    public get<K extends keyof ServiceMap>(name: K): ServiceMap[K] | undefined {
        return this.services.get(name) as ServiceMap[K] | undefined;
    }

    public registerMultiple(services: Partial<ServiceMap>): void {
        for (const [name, service] of Object.entries(services)) {
            this.register(
                name as keyof ServiceMap,
                service as ServiceMap[keyof ServiceMap]
            );
        }
    }
    constructor(services?: Partial<ServiceMap>) {
        if (services) {
            this.registerMultiple(services);
        }
    }
}
