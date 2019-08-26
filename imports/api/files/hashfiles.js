import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

const HashFiles = new FilesCollection({
  collectionName: 'HashFiles',
  allowClientCode: false, // Disallow remove files from Client
  onBeforeUpload(file) {
    console.log(`Received File ${file.size}`);
  }
});

if (Meteor.isClient) {
  Meteor.subscribe('files.hashes.all');
}

if (Meteor.isServer) {
  Meteor.publish('files.hashes.all', function () {
    return HashFiles.find().cursor;
  });
}

export default HashFiles;