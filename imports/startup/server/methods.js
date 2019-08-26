import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { RequestedUsers } from '/imports/api/users/users.js';
import { emptyTypeAnnotation } from '@babel/types';

Meteor.methods({
    deleteAccount() {
        // console.log(`Tasked to delete following account\n${this.userId}`);
        Meteor.users.remove({"_id":this.userId});
        return true;
    },
    
    adminCreated() {
        if (Meteor.users.find().count() > 0) {
            return true;
        }
        return false;
    },

    handleAccountRequest(email, password) {
        // console.log(`Handling request for ${email}:${password}`);
        let alreadyRequested = RequestedUsers.find({"email":{$eq: email}}).count();
        // console.log(alreadyRequested);
        if(alreadyRequested === 0){
            RequestedUsers.insert({'email':email,'password':password,'approved':false,'enabled':false});
            return true;
        }
        return false;
    },

    handleApproveAccountRequest(email) {
        if (Roles.userIsInRole(this.userId, 'admin')) {
            // console.log(`Approving... ${email}`);
            // Need to look up the requested user from requestedUsers
            const requestedUser = RequestedUsers.findOne({'email':{$eq:email}});
            console.log(requestedUser);
            const dataForSub = {
                email:requestedUser.email,
                password:requestedUser.password
            }
            // Add the account per normal accounts request
            const res = Accounts.createUser(dataForSub)
            console.log(res);
            // If no error then also mark the account approved in requested accounts (and enabled as well)
            if(res){
                RequestedUsers.update({'email':{$eq:email}},{$set:{'approved':true,'enabled':true,'password':"placeholdernotrealpassword"}});
                return true
            }
            throw Error("Unable to create requested acount");
        } 
        return true
    },

    rejectAccountRequest(email) {
        if (Roles.userIsInRole(this.userId, 'admin')) {
            // console.log(`Rejecting... ${email}`);
            // Need to look up the requested user from requestedUsers
            RequestedUsers.remove({'email':{$eq:email}})
        } 
        return true
    },

    toggleAccountValidity(email) {
        if (Roles.userIsInRole(this.userId, 'admin')) {
            // console.log(`Toggling... ${email}`);
            // Need to look up the requested user from requestedUsers
            const requestedUser = RequestedUsers.findOne({'email':{$eq:email}});
            const accountReference = Meteor.users.findOne({'emails':{$elemMatch:{'address':email}}});
            // console.log(requestedUser);
            if(requestedUser.enabled){
                // Perform DISABLE logic
                Roles.addUsersToRoles(accountReference, ['disabled'],Roles.GLOBAL_GROUP);
                Meteor.users.update({ _id: accountReference._id }, { $set: { "services.resume.loginTokens": [] } });
                // console.log(`Disable`);
            } else {
                // Perform ENABLE logic
                Roles.removeUsersFromRoles(accountReference, ['disabled'],Roles.GLOBAL_GROUP);
                // console.log(`Enable`);
            }
            // Update our book-keeping for this user
            RequestedUsers.update({'email':{$eq:email}},{$set:{'enabled':!requestedUser.enabled}});
            // console.log(res);
            // // If no error then also mark the account approved in requested accounts (and enabled as well)
            // if(res){
                
            // }
            // throw Error("Unable to create requested acount");
        } 
        return true
    },

    deleteOtherAccount(email) {
        if (Roles.userIsInRole(this.userId, 'admin')) {
            // console.log(`Toggling... ${email}`);
            // Need to look up the requested user from requestedUsers
            // const requestedUser = RequestedUsers.findOne({'email':{$eq:email}});
            const accountReference = Meteor.users.findOne({'emails':{$elemMatch:{'address':email}}});
            // console.log(requestedUser);
            Meteor.users.remove({ _id: accountReference._id });
            RequestedUsers.remove({'email':{$eq:email}});
        } 
        return true
    },
});