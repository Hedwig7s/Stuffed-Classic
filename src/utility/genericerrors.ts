export class ValueError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValueError";
    }
}

export class OutOfRangeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "OutOfRangeError";
    }
}

export class OutOfCapacityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "OutOfCapacityError";
    }
}

export class InvalidArgumentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidArgumentError";
    }
}

export class NotImplementedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotImplementedError";
    }
}

export class InvalidOperationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidOperationError";
    }
}

export class PermissionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PermissionError";
    }
}


