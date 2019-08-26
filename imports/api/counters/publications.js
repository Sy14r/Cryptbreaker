// Publications send to the client

import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import Counters from './counters.js';

if (Meteor.isServer) {
  Meteor.publish('counters.all', function() {
    if (Roles.userIsInRole(this.userId, 'admin')) {
      return Counters.find();
    }
    return this.ready();
  });

  Meteor.publish('counters.user', function() {
    if (!this.userId) {
      return this.ready();
    }
    return Counters.find({ _id: this.userId });
  });
}
