/**
 * Client DDP Connection
 * Connect to existing meteor server using ddp
 *
 * See Profile component in 'pages' directory for HOC data fetching example
 */

import { DDP } from 'meteor/ddp-client';

// establish ddp connection
const remoteUrl = '';
const Remote = DDP.connect(remoteUrl);
Remote.onReconnect = (...args) => console.log('reconnected to ddp...', args);

export default Remote;

// example: call a remote server method (use in place of Meteor.call)
/*
Remote.call('someMethod', (err) => {
  // 'someMethod' is run on the remote meteor server
  if (err) {
    return console.log('error calling method over ddp');
  }
  console.log('successfully called method over ddp!');
});
*/
