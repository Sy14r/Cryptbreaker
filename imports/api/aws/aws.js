/**
 * Deny write access on users collection from client
 */

import { Meteor } from 'meteor/meteor';




// define schema
// const Schema = new SimpleSchema({
//   _id: {
//     type: String,
//   },
//   count: {
//     type: SimpleSchema.Integer,
//   },
// });

// // attach schema
// Counters.attachSchema(Schema);

export const AWSCOLLECTION = new Mongo.Collection('aws');