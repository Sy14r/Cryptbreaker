import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { APICollection } from './api.js';
import _ from 'lodash';

const bound = Meteor.bindEnvironment((callback) => {callback();});

Meteor.methods({
    async createKey(data) {
        console.log("CREATE KEY")
        return true; 
    },
});