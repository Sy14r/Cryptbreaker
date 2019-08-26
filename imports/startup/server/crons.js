import { Meteor } from 'meteor/meteor';
//import { CronJob } from 'cron';
import { checkForCrackResults } from './crons/checkForCrackResults.js';

// Function/File to load all crons (detailed cron logig contained in the corresponding crons folder)
Meteor.startup(function() {
  SyncedCron.add({
    name: 'Check for Cracked Results',
    schedule: function(parser) {
      // parser is a later.parse object
      return parser.text('every 30 seconds');
    },
    job: function() {
      checkForCrackResults();
    }
  });

//   SyncedCron.add({
//     name: 'Schedule System Surveys',
//     schedule: function(parser) {
//       // parser is a later.parse object
//       return parser.text('every 24 hours');
//       // return parser.text('every 1 minutes');
//     },
//     job: function() {
//       scheduleSurveys();
//     }
//   });

  SyncedCron.start();
});
