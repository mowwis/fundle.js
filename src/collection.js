import { ModelEvent } from "./index.js"

export class Collection extends EventTarget {
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