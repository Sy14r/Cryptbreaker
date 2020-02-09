/**
 * Deny write access on users collection from client
 */

import { Meteor } from 'meteor/meteor';

export const APICollection = new Mongo.Collection('api');