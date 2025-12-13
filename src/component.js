import { Templater, ModelEvent, Model, Collection } from "./index.js";

export class Component extends HTMLElement {
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
        this.render();
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