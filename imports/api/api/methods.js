import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { APICollection } from './api.js';
import _ from 'lodash';

const bound = Meteor.bindEnvironment((callback) => {callback();});

Meteor.methods({
    async createKey(data) {
        const uuidv4 = require('uuid/v4');
        let randomVal = uuidv4();
        APICollection.insert({'secret':randomVal,'userID':this.userId,'status':'Created','creationDate':new Date()});
        return true; 
    },
    async delteAPIKeyByID(data) {
        let APIKey = APICollection.findOne({'_id':data,'userID':this.userId})
        typeof APIKey !== 'undefined' ? APICollection.remove(APIKey) : null
        return true; 
    },
});