// Publications to the client

import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { Hashes, HashFiles, HashCrackJobs } from '/imports/api/hashes/hashes.js';

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

  Meteor.publish('hashCrackJobs.all', function() {
    if (this.userId) {    
      return HashCrackJobs.find();
    }
    return this.ready();
  });


  // example friends publication
  // Meteor.publish('users.friends', function() {
  //   if (this.userId) {
  //     const user = Meteor.users.findOne(this.userId);
  //     if (user.friendIds) {
  //       return Meteor.users.find(
  //         { _id: { $inc: user.friendIds } },
  //         {
  //           fields: {
  //             emails: 1,
  //             profile: 1,
  //             status: 1,
  //           },
  //         },
  //       );
  //     }
  //     return this.ready();
  //   }
  //   return this.ready();
  // });
}
