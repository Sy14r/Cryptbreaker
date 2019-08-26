/**
 * Accounts Setup
 */

import { Accounts } from 'meteor/accounts-base';
import Counters from '../../api/counters/counters.js';

Accounts.validateLoginAttempt(function(attempt) {
  if(Roles.userIsInRole(attempt.user._id, ['disabled'])) {
    attempt.allowed = false;
    throw new Meteor.Error(403, "User account is inactive!");
  }
  return true;
});


Accounts.onCreateUser((options, user) => {
  // init counter at 0
  Counters.insert({
    _id: user._id,
    count: Number(0),
  });
  return user;
});

