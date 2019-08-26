/**
 * Deny write access on users collection from client
 */

import { Meteor } from 'meteor/meteor';

// This fixes default writable profile field:
// https://guide.meteor.com/accounts.html#dont-use-profile
Meteor.users.deny({
  update() {
    return true;
  },
});

export const RequestedUsers = new Mongo.Collection('requestedUsers');

