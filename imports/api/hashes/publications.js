// Publications to the client

import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { Hashes, HashFiles, HashCrackJobs, HashFileUploadJobs } from '/imports/api/hashes/hashes.js';

if (Meteor.isServer) {
  // all users publication (admin only)
  Meteor.publish('hashes.all', function(limit) {
    if (this.userId) {
      let options = {}
      if (Roles.userIsInRole(this.userId, 'admin')) {
        options = {
          sort: {data: -1},
          limit: limit,
          fields:{
            data:1,
            'meta.type':1,
            'meta.source':1,
            'meta.attempted':1,
            'meta.cracked':1,
            'meta.plaintext':1,
            'meta.username':1,
            'meta.lists':1
          }
        };
      } else {
        options = {
          sort: {data: -1},
          limit: limit,
          fields:{
            data:1,
            'meta.type':1,
            'meta.source':1,
            'meta.attempted':1,
            'meta.cracked':1,
            'meta.username':1,
            'meta.lists':1
          }
        };
      }
      return Hashes.find({},options);


    }
    return this.ready();
  });

  Meteor.publish('hashes.inSources', function(sources, limit) {
    if (this.userId) {
      const options = {
        sort: {data: -1},
        limit: limit,
        fields:{
          data:1,
          'meta.type':1,
          'meta.source':1,
          'meta.attempted':1,
          'meta.cracked':1,
        }
      };
    
      let queryDoc = [];
      _.each(sources, (fileID) => {
          queryDoc.push({
              'meta.source':fileID
          })
      })

      return Hashes.find({"meta.type":{$or:queryDoc}},options);
    }
    return this.ready();
  });

  Meteor.publish('hashFiles.all', function() {
    if (this.userId) {    
      return HashFiles.find();
    }
    return this.ready();
  });

  Meteor.publish('hashFileUploadJobs.all', function() {
    if (this.userId) {    
      return HashFileUploadJobs.find();
    }
    return this.ready();
  });

  Meteor.publish('hashCrackJobs.all', function() {
    if (this.userId) {    
      return HashCrackJobs.find();
    }
    return this.ready();
  });

  Meteor.publish('hashCrackJobs.running', function() {
    if (this.userId) {    
      return HashCrackJobs.find({status:{$ne: "Job Completed"}});
    }
    return this.ready();
  });

}
