// Publications to the client

import { Meteor } from 'meteor/meteor';
import { AWSCOLLECTION } from '/imports/api/aws/aws.js';
import { Roles } from 'meteor/alanning:roles';


if (Meteor.isServer) {
  // all users publication (admin only)
  Meteor.publish('aws.getCreds', function() {
    if (this.userId) {    
      return AWSCOLLECTION.find({type:'creds'},{fields:{type:1,accessKeyId:1}});
    }
    return this.ready();
  });

  Meteor.publish('aws.getPricing', function() {
    if (this.userId) {    
      return AWSCOLLECTION.find({type:'pricing'});
    }
    return this.ready();
  });

  Meteor.publish('aws.getBestPricing', function() {
    if (this.userId) {    
      return AWSCOLLECTION.find({type:'bestPricing'});
    }
    return this.ready();
  });

  Meteor.publish('aws.getRegions', function() {
    if (this.userId) {    
      return AWSCOLLECTION.find({type:'regions'});
    }
    return this.ready();
  });

  Meteor.publish('aws.getSettings', function() {
    if (Roles.userIsInRole(this.userId, ['admin','hashes.crack'])) {    
      return AWSCOLLECTION.find({type:'settings'});
    }
    return this.ready();
  })


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
