# fundle.js
**fundle.js** is a lightweight JavaScript frontend library for building data-driven user interfaces using native **Web Components** and the **Model-View architecture**. It simplifies state management and rendering by automatically synchronizing the DOM with your data models and data models with you backend.


# Features
- **Native Web Components:** Built entirely on standard browser APIs.
- **Automatic Reactivity:** Components (`Component`) automatically update when underlying data (`Model`, `Collection`) changes.
- **Structured Data Management:** Dedicated classes for single data entries (`Model`) and lists (`Collection`), both extending `EventTarget` for observable changes.
- **API Ready:** Model includes built-in methods (`save()`, `all()`, `delete()`) designed to interact with RESTful APIs.
- **Declarative Binding:** Uses a `Templater` and bindings object to map model attributes to DOM properties using data-bind attributes.


# Installation
Fundle.js is designed as a small, dependency-free library. Include it via a script tag or as a module import in your project.

```html
<!-- Latest release via script tag -->
<script src="https://github.com/mowwis/fundle.js/releases/latest/download/fundle.min.js"></script>

<!-- Specific version via script tag -->
<script src="https://github.com/mowwis/fundle.js/releases/download/v0.0-alpha/fundle.min.js"></script>
```


# Usage

## Defining a Model
A `Model` represents a single data record with defined fields. It manages data fetching, saving, and deletion.

```js
class Task extends Model {
    static endpoint = '/tasks';

    static fields = {
        id: { type: Number, primaryKey: true },
        createdAt: Date,
        title: String,
        completed: Boolean,
    };
}
```
**[Further Documentation](https://github.com/mowwis/fundle.js/blob/main/docs/model.md)**

## Defining and Using a Component
`Component` is the base class for Web Components. It connects the DOM to the data layer.


```html
<template id="task-template">
    <input type="checkbox">
    <span></span>
    <button>Delete</button>
</template>
```

```js
class TaskItemComponent extends Component {
    static template = '#task-template';

    bindings = {
        "input": (el) => el.checked = this.model.completed,
        "input::change": (el, e) => {
            this.model.completed = el.checked;
            this.model.save();
        },

        "span": (el) => el.innerText = this.model.title,

        "button::click": (el, e) => this.model.delete(),
    }
}
TaskItemComponent.define('task-item');
```
**[Further Documentation](https://github.com/mowwis/fundle.js/blob/main/docs/component.md)**

# Resources
- **[Full Documentation](https://github.com/mowwis/fundle.js/blob/main/docs/index.md)** - Complete guide and API reference
- **[GitHub Issues](https://github.com/mowwis/fundle.js/issues)** - Report bugs or request features

# License
AGPL-3.0 - see [LICENSE](LICENSE) for details.