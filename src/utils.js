export class Templater {
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

export class Router {
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

export class API {
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