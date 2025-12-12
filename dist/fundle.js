class Model extends EventTarget {
    static fields = {};
    static instanceCache = new Map();
    static classEventTarget = new EventTarget();

    fieldChanges = {};
    get changeDelta() { return Object.entries(this.fieldChanges).reduce((acc, [k, v]) => { acc[k] = v.newValue; return acc; }, {}); }

    constructor(data = {}) {
        super();

        this.initializeFields();

        const primaryKeyValue = data[this.constructor.primaryField];
        if (primaryKeyValue && this.constructor.instanceCache.has(primaryKeyValue)) {
            const existingModel = this.constructor.instanceCache.get(primaryKeyValue);
            existingModel.assign(data);
            return existingModel;
        }

        this.assign(data);
    }

    initializeFields() { // do casting in here (all field logic / verifiaction)
        Object.keys(this.constructor.fields).forEach(field => {
            const privateFieldName = `_${field}`;
            this[privateFieldName] = undefined;

            Object.defineProperty(this, field, {
                get() { return this[privateFieldName]; },
                set(newValue) {
                    const oldValue = this[privateFieldName];
                    if (newValue === oldValue) return;
                    this[privateFieldName] = newValue;

                    if (this.fieldChanges[field]) this.fieldChanges[field].newValue = newValue;
                    else this.fieldChanges[field] = { oldValue, newValue };
                },
                enumerable: true,
                configurable: true
            });
        });
    }

    async save() {
        let updatedData;
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
        if (!this.primaryKey) return;
        this.constructor.instanceCache.delete(this.primaryKey);
        const deleteEvent = ModelEvent.delete(this);
        this.dispatchEvent(deleteEvent);
        this.constructor.dispatchEvent(deleteEvent);
    }

    assign(data = {}) {
        Object.entries(this.constructor.fields).forEach(([field, { type }]) => {
            if (field in data) {
                this[field] = this.constructor.castFieldValue(data[field], type);
            }
        });
        const primaryKeyValue = data[this.constructor.primaryField];
        if (primaryKeyValue && !this.constructor.instanceCache.has(primaryKeyValue)) {
            this.constructor.instanceCache.set(primaryKeyValue, this);
            this.constructor.dispatchEvent(ModelEvent.new(this));
        }
        if (Object.keys(this.fieldChanges).length) {
            this.dispatchEvent(ModelEvent.change(this, this.changeDelta));
        }
        this.fieldChanges = {};
    }

    get primaryKey() { return this[this.constructor.primaryField]; }
    static get primaryField() {
        const primaryField = Object.keys(this.fields).find(field => this.fields[field].primary_key);
        if (primaryField) return primaryField;
        if ('id' in this.fields) return 'id';
        throw new Error("Model must have a primary key or 'id' field defined.");
    }

    static dispatchEvent(event) { this.classEventTarget.dispatchEvent(event); }
    static addEventListener(type, callback) { this.classEventTarget.addEventListener(type, callback); }
    static removeEventListener(type, callback) { this.classEventTarget.removeEventListener(type, callback); }

    static castFieldValue(value, type) {
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
        Object.keys(this.constructor.fields).forEach((key) => {
            const value = this[key];
            if (value !== null && value !== undefined) jsonObject[key] = value instanceof Date ? value.toISOString() : value;
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
                            const elementForCallback = resolveElements(fullSelector)[0] || targetElement;
                            targetElement.removeEventListener(eventType, (event) => callback(elementForCallback, event));
                            targetElement.addEventListener(eventType, (event) => callback(elementForCallback, event));
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
    static currentRoute = null;

    static route(path, callback) { this.routes.push({ path, callback }); }

    static navigate(path) {
        const route = this.matchRoute(path || window.location.pathname);
        if (!route) this.go('/', replace = true);

        this.currentRoute = route;
        route.callback(route.params, route.queryParams);
    }

    static matchRoute(path) {
        for (const route of this.routes) {
            const match = this.matchPath(path, route.path);
            if (match) return { ...route, params: match.params, queryParams: match.queryParams };
        }
        return null;
    }

    static matchPath(path, routePattern) {
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

    static go(path, replace = false) {
        if (replace) history.replaceState({}, '', path);
        else history.pushState({}, '', path);
        this.navigate(path);
    }
}
window.addEventListener('popstate', () => Router.navigate(location.pathname));

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