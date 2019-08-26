/* eslint-disable no-undef, no-underscore-dangle */
// Tests for the behavior of the collection
// https://guide.meteor.com/testing.html

import { Meteor } from 'meteor/meteor';
import { assert } from 'meteor/practicalmeteor:chai';
import Counters from './counters.js';

if (Meteor.isServer) {
  describe('counters collection', function() {
    it('inserts correctly', function() {
      const counterId = Counters.insert({
        _id: this.userId,
        count: 0,
      });
      const added = Counters.find({ _id: counterId });
      const collectionName = added._getCollectionName();
      const count = added.count();

      assert.equal(collectionName, 'counters');
      assert.equal(count, 1);
    });
  });
}
