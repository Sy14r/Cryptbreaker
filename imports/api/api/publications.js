// Publications to the client
import { Meteor } from 'meteor/meteor';
import { APICollection } from '/imports/api/api/api.js'


if (Meteor.isServer) {
  // all users publication (admin only)
  Meteor.publish('api.getKeys', function() {
    if (!this.userId) {
      return this.ready();
    }
    return APICollection.find({userID:`${this.userId}`});
  });
}
