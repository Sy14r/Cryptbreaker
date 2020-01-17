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

export const Hashes = new Mongo.Collection('hashes');
export const HashFiles = new Mongo.Collection('hashFiles');
export const HashCrackJobs = new Mongo.Collection('hashCrackJobs');
export const HashFileUploadJobs = new Mongo.Collection('hashFileUploadJobs');
