'use strict';

class Expense {
    constructor(user, amount, description, timestamp, category, ref) {
        this.user = user;
        this.category = category;
        this.subcategory = subcategory;
        this.description = description;
        this.timestamp = timestamp;
        this.ref = ref
    }

    toString(noTimestamp) {
        let d = new Date(this.timestamp);
        return `${!noTimestamp ? d.toLocaleDateString('en') + ' – ' : ''}${this.description}${this.subcategory ? ' - ' + this.subcategory : ''} ${this.category ? ' - ' + this.category : ''} ${this.ref ? '(🔁)' : ''}`
    }
}

module.exports = Expense;