/* eslint-disable no-undef */
// Tests for methods
// https://guide.meteor.com/testing.html

import { Meteor } from 'meteor/meteor';
import { assert } from 'meteor/practicalmeteor:chai';
import Counters from './counters.js';
import { countersInsert, countersIncrease } from './methods.js';

if (Meteor.isServer) {
  describe('counters method', function() {
    before(function() {
      Counters.remove({});
      Meteor.users.remove({});
    });

    // use same counter id for all tests
    let counterId = null;

    it('can add a counter', async function(done) {
      assert.equal(Counters.find().count(), 0);
      countersInsert.call((err, result) => {
        if (err) {
          console.log(err);
          return done();
        }
        counterId = result;
        assert.equal(Counters.find().count(), 1);
        return done();
      });
    });

    it('can increase a counter', async function() {
      assert.equal(Counters.findOne(counterId).count, 0);
      // create user and assign to 'user' role
      const stubbedUserId = Accounts.createUser({
        email: 'test@user.com',
        password: 'test',
      });
      Roles.addUsersToRoles(stubbedUserId, 'user');
      await countersIncrease.run.call(
        { userId: stubbedUserId },
        { _id: counterId }
      );
      assert.equal(Counters.findOne(counterId).count, 1);
    });

    it('cannot increase a counter if not in "user" role', async function() {
      const counter = Counters.findOne(counterId);
      // should still be 1 from previous test
      assert.equal(counter.count, 1);
      // create user *without* assigning a role
      const stubbedUserId = Accounts.createUser({
        email: 'not@in.com',
        password: 'user-role',
      });
      assert.throws(
        () =>
          countersIncrease.run.call(
            { userId: stubbedUserId },
            { _id: counterId }
          ),
        Error,
        'You are not allowed to call this method [not-allowed]'
      );
      // should remain 1
      assert.equal(counter.count, 1);
    });
  });
}
