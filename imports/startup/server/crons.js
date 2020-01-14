import { Meteor } from 'meteor/meteor';
import { checkForCrackResults } from './crons/checkForCrackResults.js';
import { clearFinishedFileUploadJobs } from './crons/clearFinishedFileUploadJobs.js';

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
  SyncedCron.add({
    name: 'Clear Sucessful/Failed File Uploads',
    schedule: function(parser) {
      // parser is a later.parse object
      return parser.text('every 15 minutes');
    },
    job: function() {
      clearFinishedFileUploadJobs();
    }
  });

  SyncedCron.start();
});
