/* eslint-disable no-undef */
// Tests for publications
// https://guide.meteor.com/testing.html

import { Random } from 'meteor/random';
import { assert } from 'meteor/practicalmeteor:chai';
import { PublicationCollector } from 'meteor/johanbrook:publication-collector';

import Counters from './counters.js';
import './publications.js';

if (Meteor.isServer) {
  describe('counters publications', function() {
    before(function() {
      Counters.remove({});
      _.times(7, () => {
        Counters.insert({
          _id: Random.id(),
          count: 0,
        });
      });
    });

    describe('counters.all', function() {
      it('sends all counters', function(done) {
        const collector = new PublicationCollector();
        collector.collect('counters.all', () => {
          assert.notEqual(Counters.find().count(), 6);
          assert.equal(Counters.find().count(), 7);
          assert.notEqual(Counters.find().count(), 8);
          done();
        });
      });
    });
  });
}
