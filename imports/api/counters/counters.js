// Collection definition

import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

// define collection
const Counters = new Mongo.Collection('counters');

// define schema
const Schema = new SimpleSchema({
  _id: {
    type: String,
  },
  count: {
    type: SimpleSchema.Integer,
  },
});

// attach schema
Counters.attachSchema(Schema);

export default Counters;
