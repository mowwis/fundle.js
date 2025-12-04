# fundle.js
Reactive Frontend Library


# Data Models

## Model with backend Synchronisation
```js
import { Model } from 'fundle.js';

class User extends Model {
    static endpoint = '/users';

    static fields = {
        id: { type: Number, primary_key: true },
        createdAt: Date,
        name: String,
        email: String,
    }
}
```

## Client only Model
```js
import { Model } from 'fundle.js';

class User extends Model {
    static fields = {
        id: { type: Number, primary_key: true },
        createdAt: Date,
        name: String,
        email: String,
    }
}
```

# Model Collections

# UI Components
```html
<template id="person-template">
    <input class="name-input" type="text" placeholder="Name">
    <input class="email-input" type="text" placeholder="E-Mail">
    <button>Delete</button>
</template>
```

## Component for Data Models
```js
import { Component } from 'fundle.js';

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

## Component for Collections
```js
import { Component } from 'fundle.js';

class PersonContainer extends Component {
    bindings = {
        "button::click": async (el, e) => {
            const newPerson = new Person({
                name: "Name",
                email: "",
            });
            await newPerson.save();
        },
        "input::input": (el, e) => this.renderCollection(),
    }

    collection = async () => await Person.all();

    renderCollection() {
        this.listElement.innerHTML = "";
        const query = this.querySelector('input').value;
        this.collection
            .filter(person => person.name.toLowerCase().includes(query.toLowerCase()))
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
            .forEach(person => {
                const item = document.createElement("person-item");
                item.model = person;
                this.listElement.appendChild(item);
            });
    }
}
customElements.define('person-container', PersonContainer);
```

## Pure Components (no data reactivity)
```js
import { Component } from 'fundle.js';

class Button extends Component {
    bindings = {
        ":this": (el) => el.innerText = 'Click Me!';,
        ":this::click": (e) => console.log('Clicked!'),
    }
}
customElements.define('my-button', Button);
```


# Router
```js
import { Router } from 'fundle.js';

Router.route('/', () => element1.classList.add('visible'));
Router.route('/user/:id', (params) => element1.classList.add('visible'));
Router.navigate();


element3.addEventListener('click', () => Router.go('/'));
element4.addEventListener('click', () => Router.go('/group/1'));
```

# API

# Template Binder