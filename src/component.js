import { Templater, ModelEvent, Model, Collection } from "./index.js";

export class Component extends HTMLElement {
    bindings = {};
    static tagName = null;
    static template = null;

    // Model
    #onModelChange = () => this.render();
    #onModelDelete = () => this.remove();
    get model() { return this._model; }
    set model(modelInstance) {
        if (this._model) {
            this._model.removeEventListener(ModelEvent.CHANGE, this.#onModelChange);
            this._model.removeEventListener(ModelEvent.DELETE, this.#onModelDelete);
        }
        if (!modelInstance instanceof Model) throw new Error(`The model must be an instance of Model.`);
        this._model = modelInstance;
        if (this._model) {
            this._model.addEventListener(ModelEvent.CHANGE, this.#onModelChange);
            this._model.addEventListener(ModelEvent.DELETE, this.#onModelDelete);
        }
    }

    // Collection
    #onCollectionChange = () => this.render();
    get collection() { return this._collection; }
    set collection(collectionInstance) {
        if (this._collection) {
            this._collection.removeEventListener(ModelEvent.NEW, this.#onCollectionChange);
            this._collection.removeEventListener(ModelEvent.CHANGE, this.#onCollectionChange);
        }
        if (!collectionInstance instanceof Collection) throw new Error(`The collection must be an instance of Collection.`);
        this._collection = collectionInstance;
        if (this._collection) {
            this._collection.addEventListener(ModelEvent.NEW, this.#onCollectionChange);
            this._collection.addEventListener(ModelEvent.CHANGE, this.#onCollectionChange);
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