import { Collection } from "./index.js";

export class Model extends EventTarget {
    static fields = {};
    static endpoint = null;
    static _instanceCache = new Map();
    static _classEventTarget = new EventTarget();

    fieldChanges = {};
    get changeDelta() { return Object.entries(this.fieldChanges).reduce((acc, [k, v]) => { acc[k] = v.newValue; return acc; }, {}); }

    constructor(data = {}) {
        super();

        this.#initializeFields();

        const primaryKeyValue = data[this.constructor.primaryField];
        if (primaryKeyValue && this.constructor._instanceCache.has(primaryKeyValue)) {
            const existingModel = this.constructor._instanceCache.get(primaryKeyValue);
            existingModel.assign(data);
            return existingModel;
        }

        this.assign(data);
    }

    #initializeFields() {
        Object.entries(this.constructor.fields).forEach(([field, parameters]) => {
            var type;
            if (typeof parameters === 'object') ({ type } = parameters);
            else type = parameters;

            const privateFieldName = `#${field}`;
            this[privateFieldName] = undefined;

            Object.defineProperty(this, field, {
                get() { return this[privateFieldName]; },
                set(newValue) {
                    const oldValue = this[privateFieldName];
                    this[privateFieldName] = this.constructor._castFieldValue(newValue, type);
                    if (this[privateFieldName] === oldValue) return;

                    if (this.fieldChanges[field]) this.fieldChanges[field].newValue = newValue;
                    else this.fieldChanges[field] = { oldValue, newValue };
                },
                enumerable: true,
                configurable: true
            });
        });
    }

    static async all(params = {}) {
        let data;
        if (!this.endpoint) data = [...this._instanceCache.values()];
        else {
            var endpoint = this.endpoint;
            Object.entries(params).forEach(([k, v]) => endpoint = endpoint.replace(`:${k}`, String(v)));
            data = await api.get(endpoint);
        }
        return new Collection(this).fromArray(data);
    }

    // async fetchById(id) { ... } ??

    async save() {
        if (!this.endpoint) return this.assign();

        let updatedData;
        if (!this.primaryKey) updatedData = await api.post(this.endpoint, this);
        else if (Object.keys(this.fieldChanges).length) {
            updatedData = await api.patch(`${this.endpoint}/${this.primaryKey}`, this.changeDelta);
        }
        if (updatedData) this.assign(updatedData);
    }

    revert(...fields) {
        if (!Object.keys(this.fieldChanges).length) return;
        Object.entries(this.fieldChanges).forEach(([field, change]) => {
            if (fields.length != 0 && !fields.includes(field)) return;
            this[field] = change.oldValue;
            delete this.fieldChanges[field];
        });
        this.dispatchEvent(ModelEvent.change(this, this.changeDelta));
    }

    async delete() {
        if (this.primaryKey) this.constructor._instanceCache.delete(this.primaryKey);
        if (this.primaryKey && this.endpoint) await api.delete(`${this.endpoint}/${this.primaryKey}`);

        const deleteEvent = ModelEvent.delete(this);
        this.dispatchEvent(deleteEvent);
        this.constructor.dispatchEvent(deleteEvent);
    }

    assign(data = {}) {
        Object.keys(this.constructor.fields).forEach(field => {
            if (field in data) this[field] = data[field];
        });
        const primaryKeyValue = data[this.constructor.primaryField];
        if (primaryKeyValue && !this.constructor._instanceCache.has(primaryKeyValue)) {
            this.constructor._instanceCache.set(primaryKeyValue, this);
            this.constructor.dispatchEvent(ModelEvent.new(this));
        }
        if (Object.keys(this.fieldChanges).length) {
            this.dispatchEvent(ModelEvent.change(this, this.changeDelta));
        }
        this.fieldChanges = {};
    }

    get endpoint() {
        if (!this.constructor.endpoint) return;
        var endpoint = this.constructor.endpoint;
        Object.keys(this.constructor.fields).forEach(field => {
            endpoint = endpoint.replace(`:${field}`, String(this[field]));
        });
        return endpoint;
    }

    get primaryKey() { return this[this.constructor.primaryField]; }
    static get primaryField() {
        const primaryField = Object.keys(this.fields).find(field => this.fields[field].primaryKey);
        if (primaryField) return primaryField;
        if ('id' in this.fields) return 'id';
        throw new Error("Model must have a primary key or 'id' field defined.");
    }

    static dispatchEvent(event) { this._classEventTarget.dispatchEvent(event); }
    static addEventListener(type, callback) { this._classEventTarget.addEventListener(type, callback); }
    static removeEventListener(type, callback) { this._classEventTarget.removeEventListener(type, callback); }

    static _castFieldValue(value, type) {
        if (value === null || value === undefined) return value;
        switch (type) {
            case Date:
                return new Date(value);
            case Number:
            case String:
            case Boolean:
                return type(value);
            default:
                return value;
        }
    }

    toJSON() {
        const jsonObject = {};
        Object.keys(this.constructor.fields).forEach(field => {
            const value = this[field];
            if (value !== null && value !== undefined) jsonObject[field] = value instanceof Date ? value.toISOString() : value;
        });
        return jsonObject;
    }
}


export class ModelEvent extends CustomEvent {
    static NEW = 'new';
    static CHANGE = 'change';
    static DELETE = 'delete';

    constructor(type, detail) {
        const validEvents = [ModelEvent.NEW, ModelEvent.CHANGE, ModelEvent.DELETE];
        if (!validEvents.includes(type)) throw new Error(`Invalid event type: ${type}. Valid types are ${validEvents.join(', ')}.`);
        super(type, { detail, bubbles: true });
    }

    static new(target) { return new ModelEvent(ModelEvent.NEW, target); }
    static delete(target) { return new ModelEvent(ModelEvent.DELETE, target); }
    static change(target, delta) { return new ModelEvent(ModelEvent.CHANGE, { target, delta }); }
}

