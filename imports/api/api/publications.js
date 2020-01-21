// Publications to the client

import { Meteor } from 'meteor/meteor';
import { APICollection } from '/imports/api/api/api.js';
import { Roles } from 'meteor/alanning:roles';


if (Meteor.isServer) {
  // all users publication (admin only)
  Meteor.publish('api.getKeys', function() {
    if (this.userId) {    
      return AWSCOLLECTION.find({userID:this.userId});
    }
    return this.ready();
  });
}
