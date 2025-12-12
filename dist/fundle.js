class Component extends HTMLElement {
    bindings = {};
    static tagName = null;
    static template = null;

    // Model
    #model;
    #onModelChange = () => this.render();
    #onModelDelete = () => this.remove();
    get model() { return this.#model; }
    set model(modelInstance) {
        if (this.#model) {
            this.#model.removeEventListener(ModelEvent.CHANGE, this.#onModelChange);
            this.#model.removeEventListener(ModelEvent.DELETE, this.#onModelDelete);
        }
        if (!modelInstance instanceof Model) throw new Error(`The model must be an instance of Model.`);
        this.#model = modelInstance;
        if (this.#model) {
            this.#model.addEventListener(ModelEvent.CHANGE, this.#onModelChange);
            this.#model.addEventListener(ModelEvent.DELETE, this.#onModelDelete);
        }
    }

    // Collection
    #collection;
    #onCollectionChange = () => this.render();
    get collection() { return this.#collection; }
    set collection(collectionInstance) {
        if (this.#collection) {
            this.#collection.removeEventListener(ModelEvent.NEW, this.#onCollectionChange);
            this.#collection.removeEventListener(ModelEvent.CHANGE, this.#onCollectionChange);
        }
        if (!collectionInstance instanceof Collection) throw new Error(`The collection must be an instance of Collection.`);
        this.#collection = collectionInstance;

        if (this.#collection) {
            this.#collection.addEventListener(ModelEvent.NEW, this.#onCollectionChange);
            this.#collection.addEventListener(ModelEvent.CHANGE, this.#onCollectionChange);
        }
    }

    render() { Templater.bind(this, this.bindings); }

    connectedCallback() {
        if (this.constructor.template) {
            this.innerHTML = "";
            const clone = Templater.clone(this.constructor.template);
            this.appendChild(clone);
        }
        this.render();
    }
    disconnectedCallback() {
        this.model = null;
        this.collection = null;
    }

    static define(tagName) {
        this.tagName = tagName;
        customElements.define(tagName, this);
    }
    static new(model, collection) {
        if (!this.tagName) throw new Error(`Component has no tagName defined. Call .define(tagName) first.`);
        const element = document.createElement(this.tagName);
        if (model) element.model = model;
        else if (collection) element.collection = collection;
        return element;
    }
}

class Collection extends EventTarget {
    #items = [];
    #onModelChange = (e) => this.dispatchEvent(ModelEvent.change(e.detail.target, e.detail.delta));

    constructor(modelClass, ...initial) {
        super();
        this.modelClass = modelClass;
        initial.forEach(item => this.push(item));
        modelClass.addEventListener('new', e => this.push(e.detail)); // make use event.target
    }

    fromArray(array) {
        array.forEach(item => this.push(item));
        return this;
    }

    push(item) {
        if (!(item instanceof this.modelClass)) item = new this.modelClass(item);
        if (this.includes(item)) return;

        item.addEventListener('delete', e => this.remove(item));
        item.addEventListener('change', this.#onModelChange);

        this.#items.push(item);
        this.dispatchEvent(ModelEvent.new(item));
    }

    remove(item) {
        const index = this.indexOf(item);
        if (index === -1) return;

        item.removeEventListener('change', this.#onModelChange);

        this.splice(index, 1);
        this.dispatchEvent(ModelEvent.delete(item));
    }

    sort(compareFn) { return this.#items.sort(compareFn); }
    indexOf(searchElement, fromIndex) { return this.#items.indexOf(searchElement, fromIndex); }
    includes(searchElement, fromIndex) { return this.#items.includes(searchElement, fromIndex); }
    forEach(callbackfn) { this.#items.forEach(callbackfn); }

    map(callbackfn) { return new Collection(this.modelClass).fromArray(this.#items.map(callbackfn)); }
    filter(predicate) { return new Collection(this.modelClass).fromArray(this.#items.filter(predicate)); }
    splice(start, deleteCount) { return new Collection(this.modelClass).fromArray(this.#items.splice(start, deleteCount)); }
    flatMap(callback) { return new Collection(this.modelClass).fromArray(this.#items.flatMap(callback)); }
}

class Model extends EventTarget {
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

class ModelEvent extends CustomEvent {
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

class Templater {
    static clone(template) {
        if (typeof template === 'string') template = document.querySelector(template);
        if (!template || !(template instanceof HTMLTemplateElement)) {
            throw new Error(`Templater: No valid HTMLTemplateElement found for selector/input: ${template}`);
        }
        return template.content.cloneNode(true);
    }

    static bind(element, bindings) {
        const resolveElements = (selectorPart) => {
            if (selectorPart.trim() === ":this") return [element];
            if (selectorPart.trim().startsWith(':this')) selectorPart = selectorPart.replace(':this', '');
            return element.querySelectorAll(selectorPart);
        };

        Object.entries(bindings).forEach(([rawSelector, callback]) => {
            const individualSelectors = rawSelector.split(/,(?![^(]*\))/g).map(s => s.trim());
            individualSelectors.forEach(selector => {
                const eventMatch = selector.match(/^(.*?)::([a-zA-Z]+)\s*(.*)$/);
                if (eventMatch) {
                    const [, beforeEvent, eventType, afterEvent] = eventMatch;
                    const fullSelector = [beforeEvent, afterEvent].join(' ');

                    const targetElements = resolveElements(beforeEvent);
                    if (targetElements.length > 0) {
                        targetElements.forEach(targetElement => {
                            // dont reapply event listeners
                            if (!targetElement._eventListeners) targetElement._eventListeners = new Set();
                            if (!targetElement._eventListeners.has(rawSelector)) {
                                const elementForCallback = resolveElements(fullSelector)[0] || targetElement;
                                targetElement.addEventListener(eventType, (event) => callback(elementForCallback, event));
                                targetElement._eventListeners.add(rawSelector);
                            }
                        });
                    } else console.warn(`Templater: Event target element(s) not found for base selector: "${beforeEvent}"`);
                } else {
                    const targetElements = resolveElements(selector);
                    if (targetElements.length > 0) targetElements.forEach(targetElement => callback(targetElement));
                    else console.warn(`Templater: Data binding target element(s) not found for selector: "${selector}"`);
                }

            });
        });
    }
}

class Router {
    static routes = [];
    static defaultPath = '/';

    static route(path, callback) { this.routes.push({ path, callback }); }

    static go(path, replace = false) {
        if (replace) history.replaceState({}, '', path);
        else history.pushState({}, '', path);
        this.#navigate(path);
    }

    static init() {
        this.#navigate();
        window.addEventListener('popstate', () => this.#navigate());
    }

    static #navigate(path) {
        const route = this.#matchRoute(path || window.location.pathname);
        if (!route) return this.go(this.defaultPath, true);
        route.callback(route.params, route.queryParams);
    }

    static #matchRoute(path) {
        for (const route of this.routes) {
            const match = this.#matchPath(path, route.path);
            if (match) return { ...route, params: match.params, queryParams: match.queryParams };
        }
        return null;
    }

    static #matchPath(path, routePattern) {
        const [urlPath, queryString] = path.split('?');
        const queryParams = new URLSearchParams(queryString);

        const pathParts = urlPath.split('/').filter(Boolean);
        const patternParts = routePattern.split('/').filter(Boolean);
        if (pathParts.length !== patternParts.length) return null;

        const params = {};
        for (let i = 0; i < pathParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                const paramName = patternParts[i].slice(1);
                params[paramName] = pathParts[i];
            } else if (pathParts[i] !== patternParts[i]) {
                return null;
            }
        }
        return { params, queryParams };
    }
}

class API {
    static baseUrl = "/api";
    static set baseUrl(url) { this.baseUrl = url }

    static async request(endpoint, options = {}) {
        var url = (endpoint.startsWith('/') ? this.baseUrl : '') + endpoint;
        if (!["DELETE", "PATCH"].includes(options.method)) url = !url.endsWith('/') ? url + '/' : url;

        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
        if (!res.ok) throw new Error(`API Error: ${res.status} - ${await res.text()}`);
        return res.json();
    }

    static get(url) { return this.request(url); }
    static post(url, data) { return this.request(url, { method: 'POST', body: JSON.stringify(data) }); }
    static patch(url, data) { return this.request(url, { method: 'PATCH', body: JSON.stringify(data) }); }
    static delete(url) { return this.request(url, { method: 'DELETE' }); }

    // für Multipart-Form-Daten (Dateien)
    static postFile(url, data) {
        // 'Content-Type' nicht setzen, damit der Browser es selbst macht
        return this.request(url, { method: 'POST', body: data, headers: {} });
    }
}