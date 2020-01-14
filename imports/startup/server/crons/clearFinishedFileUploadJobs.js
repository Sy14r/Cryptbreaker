import { Meteor } from 'meteor/meteor';
import { HashFileUploadJobs } from '/imports/api/hashes/hashes.js';
// var AWS = require('aws-sdk');

import _ from 'lodash';

const bound = Meteor.bindEnvironment((callback) => {callback();});

function clearFinishedFileUploadJobs() {
    bound(() => {HashFileUploadJobs.remove({$or:[{'uploadStatus':{$gt:99}},{'uploadStatus':{$lt:0}}]})})
}

export {
    clearFinishedFileUploadJobs
}