# fundle.js
fundle automatically syncs data models with the backend and updates UI components on changes, with zero boilerplate.


```html
<template id="person-template">
    <input class="name-input" type="text" placeholder="Name">
    <input class="email-input" type="text" placeholder="E-Mail">
    <button>Delete</button>
</template>
```

```js
import { Model, Component } from 'fundle.js';

class Person extends Model {
    static endpoint = '/persons';

    static fields = {
        id: { type: Number, primary_key: true },
        createdAt: Date,
        name: String,
        email: String,
    }
}

class PersonItem extends Component {
    static template = '#person-template';

    bindings = {
        ".name-input": (el) => { el.value = this.model.name; },
        ".email-input": (el) => { el.value = this.model.email; },
        ".name-input::blur": async (e) => {
            this.model.name = e.currentTarget.value;
            await this.model.save();
        },
        ".email-input::blur": async (e) => {
            this.model.email = e.currentTarget.value;
            await this.model.save();
        },
        "button::click": (e) => this.model.delete(),
    }
}
customElements.define('person-item', PersonItem);
```