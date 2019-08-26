// Remote Collection definition

import { Meteor } from 'meteor/meteor';
import Remote from './ddp';

const Users = new Meteor.Collection('users', { connection: Remote });

export default Users;
