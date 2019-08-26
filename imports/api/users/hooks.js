/**
 * Collection Hooks
 */

import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

Meteor.users.after.insert(function(userId, doc) {
  if (!userId && Meteor.users.find().count() === 1) {
    console.log("new admin registered, added to 'admin' role", doc._id);
    return Roles.addUsersToRoles(doc._id, ['admin'], Roles.GLOBAL_GROUP);
  }
  if (!userId) {
    console.log("new user registered, added to 'user' role", doc._id);
    return Roles.addUsersToRoles(doc._id, ['user'], Roles.GLOBAL_GROUP);
  }
});
