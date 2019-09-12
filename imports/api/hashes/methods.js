/* eslint-disable no-unused-vars */
/**
 * Meteor methods
 */

import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { Hashes, HashFiles, HashCrackJobs } from './hashes.js';
import { AWSCOLLECTION } from '/imports/api/aws/aws.js';
var AWS = require('aws-sdk');

import _ from 'lodash';

const bound = Meteor.bindEnvironment((callback) => {callback();});


function generateHashesFromLine(line) {
    let hashes = [];
    let splitLine = line.split(':');
    // First check for hashdump format...
    if(splitLine.length - 1 === 6){
        // console.log("HASHDUMP");
        // console.log(splitLine[0].replace('\\\\','\\'))
        if(splitLine[2].length > 0){
            // We have a LM password
            hashes.push({
                data:splitLine[2],
                meta: {
                    username: [splitLine[0].replace('\\\\','\\')],
                    type:"LM",
                }
            });
        }
        if(splitLine[3].length > 0){
            // We have an NTLM password
            hashes.push({
                data:splitLine[3],
                meta: {
                    username: [splitLine[0].replace('\\\\','\\')],
                    type:"NTLM",
                }
            });
        }
        return hashes;
    }
    // NEED TO ADD LOGIC HERE FOR NON HASHDUMP FORMATTED OUTPUT...

    return hashes;
}

function updateHashesFromPotfile(fileData){
    let data = fileData.split(',')[1];
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    let hashFilesUpdated = []
    _.each(text.split('\n'), (line) => {
        // Remove empty lines and comments
        if(line.length > 0 && line[0] !== "#"){
            let hash = line.split(':')[0]
            let plaintext = line.split(':').slice(1)[0].trimRight('\n')
            // console.log(`${hash} -> ${plaintext}`)
            // console.log(plaintext.length)
            let hashData = Hashes.findOne({"data":hash})
            let wasCracked = hashData.meta.cracked
            Hashes.update({"data":hash},{$set:{'meta.cracked':true,'meta.plaintext':plaintext}})
            _.each(hashData.meta.source, (eachSource) => {
                // Make note of which hashFiles will need to have password length stats recalculated
                hashFilesUpdated.includes(eachSource) ? null : hashFilesUpdated.push(eachSource)
                // Update the crackCount for this hashFile
                let theHashFile = HashFiles.findOne({"_id":eachSource})
                // If the hash wasn't previously marked as cracked we need to modify the crackCounts
                if(!wasCracked) {
                    HashFiles.update({"_id":eachSource},{$set:{'crackCount':theHashFile.crackCount + 1}})
                }
            })
        }
    })
    // console.log(hashFilesUpdated)
    // recalculate stats for each of the hash files that we modified...
    _.each(hashFilesUpdated, (hashFileID) => {
        let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`}]};
        let $project = {"length":{$strLenCP:"$meta.plaintext"}}
        let $group = {_id:"$length",count:{$sum:1}}
        let $sort = {_id:1}
        try {
            (async () => {
                const stats = await Hashes.rawCollection().aggregate([
                    { 
                    $match
                    },
                    {
                    $project, 
                    },
                    {
                    $group,
                    },
                    {
                    $sort
                    }
                ]).toArray();
                //console.log(stats);
                //return orderedItems;
                HashFiles.update({"_id":`${hashFileID}`},{$set:{'passwordLengthStats':stats}})
            })();
    
        } catch (err) {
        throw new Meteor.Error('E1234', err.message);
        }
    })

}

async function processUpload(fileName, fileData){
    const date = new Date();
    // console.log(`Tasked to delete following account\n${this.userId}`);
    // console.log(fileName);
    if(fileName.endsWith('potfile')) {
        // console.log("POTFILE UPLOAD")
        updateHashesFromPotfile(fileData)
    } else {
        // console.log(fileData);
        let data = fileData.split(',')[1];
        let buff = new Buffer(data, 'base64');
        let text = buff.toString('ascii');

        // console.log(text);
        let counter = 0;
        let differentHashes = 0;
        let alreadyCrackedCount = 0;
        let totalHashes = [];
        _.each(text.split('\n'), (line) => {
            // Remove empty lines and comments
            if(line.length > 0 && line[0] !== "#"){
                let hashesToAdd = generateHashesFromLine(line);
                totalHashes.push(hashesToAdd);
            }

        })
        if(totalHashes.length > 0){
            const hashFileID = HashFiles.insert({name:fileName,hashCount:0,crackCount:0,uploadDate:date})
            // NEED TO ADD HASHES
            _.each(totalHashes, (hashesToAdd) => {
                _.each(hashesToAdd,(hash)=>{
                    let newUsername = false;
                    let newFile = false;
                    hash.meta.source = [hashFileID];
                    // console.log(JSON.stringify(hash))
                    // Check if we already have the exact hash - source, account, and data are all the same
                    let storedHash = Hashes.findOne({data:{$eq:hash.data}})
                    // If we already have the hash,
                    if(storedHash) {
                        // console.log(JSON.stringify(storedHash))
                        // If we have the hash but from a different upload or for a different user then we update the existing hash entry   
                        if(storedHash.meta.cracked) {
                            alreadyCrackedCount += 1;
                        }
                        if(typeof storedHash.meta.username[hashFileID] === 'undefined' || !storedHash.meta.username[hashFileID].includes(hash.meta.username[0])){
                            newUsername = true
                        }
                        if(!storedHash.meta.source.includes(hash.meta.source[0])){
                            newFile = true
                        }
                        // let updatedValue;
                        let usernameKey = `meta.username.${hashFileID}`
                        if(newUsername && newFile)
                        {
                            // First username vs new username for already added source
                            if(typeof storedHash.meta.username[hashFileID] === 'undefined') {
                                updatedValue = Hashes.update({"_id":storedHash._id},{$set:{[usernameKey]:hash.meta.username,'meta.source':storedHash.meta.source.concat(hash.meta.source)}});
                            } else {
                                updatedValue = Hashes.update({"_id":storedHash._id},{$set:{[usernameKey]:storedHash.meta.username[hashFileID].concat(hash.meta.username),'meta.source':storedHash.meta.source.concat(hash.meta.source)}});
                            }
                            differentHashes += 1

                        }
                        else if(newUsername && !newFile)
                        {
                            // First username vs new username for already added source
                            if(typeof storedHash.meta.username[hashFileID] === 'undefined') {
                                updatedValue = Hashes.update({"_id":storedHash._id},{$set:{[usernameKey]:hash.meta.username}});

                            } else {
                                updatedValue = Hashes.update({"_id":storedHash._id},{$set:{[usernameKey]:storedHash.meta.username[hashFileID].concat(hash.meta.username)}});
                            }
                        }
                        else if(!newUsername && newFile)
                        {
                            updatedValue = Hashes.update({"_id":storedHash._id},{$set:{'meta.source':storedHash.meta.source.concat(hash.meta.source)}});
                        }
                        // if(!updatedValue){
                        //     throw Error("Error inserting hash into database");
                        // }
                        counter += 1;

                    } else {
                        // If we didn't have the hash we add it if it isn't the blank lm/ntlm hash
                        if(hash.data !== "aad3b435b51404eeaad3b435b51404ee" && hash.data !== "31d6cfe0d16ae931b73c59d7e0c089c0"){
                            let usernames = hash.meta.username
                            delete hash.meta.username
                            hash.meta.username = { [hashFileID]: usernames }
                            // console.log(JSON.stringify(hash))
                            let insertedVal = Hashes.insert(hash);
                            if(!insertedVal){
                                throw Error("Error inserting hash into database");
                            }
                            counter +=1
                            differentHashes += 1
                        }

                    }
                })
            })
            HashFiles.update({_id:hashFileID},{$set:{hashCount:counter, distinctCount:differentHashes, crackCount:alreadyCrackedCount}});
            // Calculate Cracked stats if we already have info...
            let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`}]};
            let $project = {"length":{$strLenCP:"$meta.plaintext"}}
            let $group = {_id:"$length",count:{$sum:1}}
            let $sort = {_id:1}
            try {
                (async () => {
                    const stats = await Hashes.rawCollection().aggregate([
                        { 
                        $match
                        },
                        {
                        $project, 
                        },
                        {
                        $group,
                        },
                        {
                        $sort
                        }
                    ]).toArray();
                    //console.log(stats);
                    //return orderedItems;
                    HashFiles.update({"_id":`${hashFileID}`},{$set:{'passwordLengthStats':stats}})
                })();
            
            } catch (err) {
            throw new Meteor.Error('E1234', err.message);
            }
            // Calcualte reuse stats
            let hashFileUsersKey = `$meta.username.${hashFileID}`
            $match = {'meta.source':hashFileID};
            $project = {"hash":"$data","count":{$size:[hashFileUsersKey]}}
            $sort = {count:-1}
            try {
                (async () => {
                    const stats = await Hashes.rawCollection().aggregate([
                        { 
                        $match
                        },
                        {
                        $project, 
                        },
                        {
                        $sort
                        },
                        {
                        $limit:20
                        }
                    ]).toArray();
                    //console.log(stats);
                    //return orderedItems;
                    HashFiles.update({"_id":`${hashFileID}`},{$set:{'passwordReuseStats':stats}})
                })();
            
            } catch (err) {
            throw new Meteor.Error('E1234', err.message);
            }
        }
        else {
            throw Error("No valid hashes parsed from upload, please open an issue on GitHub");
        }
        return true;
    }    
}

async function processGroupsUpload(fileName, fileData, hashFileID){
    // const date = new Date();
    // console.log(`Tasked to delete following account\n${this.userId}`);
    // console.log(fileName);
    // console.log(fileData);
    let data = fileData.split(',')[1];
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    let usersInGroup = []
    //console.log(hashFileID)
    let group = fileName.replace(".txt","")

    _.each(text.split('\n'), (line) => {
        usersInGroup.push(line.trim())
    })
    //console.log(usersInGroup)
    // We have the hashFileID, the Key (filename) for groups, and the Value (usersInGroup array)
    let theHashFile = HashFiles.findOne({"_id":hashFileID})
    if(theHashFile){
        // WILL NEED FOR BREACH AND LIST STATS
        let categoriesStats = {
            commonCredentials: {
                label:"Common Credentials",
                count:0
            },
            defaultCredentials: {
                label:"Default Credentials",
                count:0
            }
            ,
            malware: {
                label:"Used by Malware",
                count:0
            }
            ,
            crackingTools: {
                label:"Included with Cracking Tool",
                count:0
            },
            leaksAndBreaches: {
                label:"Located in Leak or Breach",
                count:0
            },
        }
        let breachListStats = {
            b1:{
                label:"000 Webhost",
                count:0
            },
            b2:{
                label:"Ashley Madison",
                count:0
            },
            b3:{
                label:"Lizzard Squad",
                count:0
            },
            b4:{
                label:"Adobe",
                count:0
            },
            b5:{
                label:"Alleged GMail",
                count:0
            },
            b6:{
                label:"Carders CC",
                count:0
            },
            b7:{
                label:"Elite Hacker",
                count:0
            },
            b8:{
                label:"Faith Writers",
                count:0
            },
            b9:{
                label:"Hotmail",
                count:0
            },
            b10:{
                label:"MD5 Decrypter",
                count:0
            },
            b11:{
                label:"MySpace",
                count:0
            },
            b12:{
                label:"PHP Bulletin Board",
                count:0
            },
            b13:{
                label:"Adult Site",
                count:0
            },
            b14:{
                label:"RockYou",
                count:0
            },
            b15:{
                label:"Singles.org",
                count:0
            },

        }
        // theHashFile is equal to source in the stats logic from cron job...
        if(theHashFile.groups){
            // we have the hashFile to update, need to check if this group is already defined....
            if(theHashFile.groups[group]) {
                // We have the group already and have to delete and replace...
                //console.log("Need to update a group.")
                let doc = {}
                let key = `groups.${group}.data`
                doc[group] = usersInGroup
                // console.log(doc)
                HashFiles.update({"_id":hashFileID},{$set:{[key]:usersInGroup}})
                // NEED TO REFACTOR THIS OUT EVENTUALLY
                // Calculate some stats for use...
                let lookupKey = `meta.username.${hashFileID}`
                let totalHashes = usersInGroup.length
                let crackedTotal = 0
                let crackedUsers = []
                let passReuseStats = {}
                let crackedStatOverview = []
                // console.log(lookupKey)
                let hashesForUsers = Hashes.find({[lookupKey]:{$in:usersInGroup}}).fetch()
                // console.log(hashesForUsers)
                if(hashesForUsers.length > 0){
                // console.log(hashesForUsers);
                _.each(hashesForUsers, (userHash) => {
                    if(typeof userHash.meta.cracked !== 'undefined' && userHash.meta.cracked) {
                        let filteredUsersLength = _.filter(userHash.meta.username[hashFileID], function(val){
                            return usersInGroup.includes(val);
                        })
                        // passReuseStats[userHash.data] = userHash.meta.username[hashFileID].length
                        passReuseStats[userHash.data] = filteredUsersLength.length
                        crackedTotal += filteredUsersLength.length
                        _.each(filteredUsersLength, (crackedAccount) => {
                            crackedUsers.push(crackedAccount)
                            // console.log(crackedAccount)
                        })
                    }
                })
                crackedStatOverview.push({
                    "name":"Cracked",
                    "label":"Cracked",
                    "value":crackedTotal
                })
                crackedStatOverview.push({
                    "name":"Uncracked",
                    "label":"Uncracked",
                    "value":totalHashes-crackedTotal
                })
                let $match = {$and:[{'meta.cracked':true},{'meta.source':`${theHashFile._id}`},{[lookupKey]:{$in:usersInGroup}}]};
            let $project = {"length":{$strLenCP:"$meta.plaintext"}}
            let $group = {_id:"$length",count:{$sum:1}}
            let $sort = {_id:1}
            // PASSWORD LENGTH STATS FIRST
            try {
                (async () => {
                    const stats = await Hashes.rawCollection().aggregate([
                        { 
                        $match
                        },
                        {
                        $project, 
                        },
                        {
                        $group,
                        },
                        {
                        $sort
                        }
                    ]).toArray();
                    // console.log(stats);
                    //return orderedItems;
                    doc = { 
                        passReuseStats: passReuseStats,
                        crackedStatOverview: crackedStatOverview,
                        crackedUsers: crackedUsers,
                        passwordLengthStats:stats,
                        categoriesStats:categoriesStats,
                        breachListStats:breachListStats
                    }
                    let key = `groups.${group}.stats`
                    //doc[group] = usersInGroup
                    // console.log(doc)
                    // THEN CALCULATE THE WORDLIST STATS
                    HashFiles.update({"_id":hashFileID},{$set:{[key]:doc}})
                    // HashFiles.update({"_id":`${source}`},{$set:{'passwordLengthStats':stats}})
                })().then(()=>{
                    // THEN UPDATE CATEGORIES SOURCE STATS
                    for (let [key, value] of Object.entries(categoriesStats)) {
                        bound(() =>{
                            let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`},{'meta.listCategories':`${categoriesStats[key].label}`},{[lookupKey]:{$in:usersInGroup}}]};
                            try {
                            (async () => {
                                const stats = await Hashes.rawCollection().aggregate([
                                    { 
                                    $match
                                    },
                                    {
                                    $count:"data"
                                    }
                                ]).toArray();
                                if(typeof stats[0] !== 'undefined'){
                                    // console.log(`FOUND ${key} ${stats[0].data}`)
                                    let updateKey = `groups.${group}.stats.categoriesStats.${key}.count`
                                    HashFiles.update({"_id":`${hashFileID}`},{$set:{[updateKey]:stats[0].data}})
                                }
                                //console.log(stats[0].data);
                            })().then(() => {
                                for (let [key, value] of Object.entries(breachListStats)) {
                                    bound(() =>{
                                        let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`},{'meta.breachesObserved':`${breachListStats[key].label}`},{[lookupKey]:{$in:usersInGroup}}]};
                                        try {
                                        (async () => {
                                            const stats = await Hashes.rawCollection().aggregate([
                                                { 
                                                $match
                                                },
                                                {
                                                $count:"data"
                                                }
                                            ]).toArray();
                                            if(typeof stats[0] !== 'undefined'){
                                                // console.log(`FOUND ${key} ${stats[0].data}`)
                                                let updateKey = `groups.${group}.stats.breachListStats.${key}.count`
                                                HashFiles.update({"_id":`${hashFileID}`},{$set:{[updateKey]:stats[0].data}})
                                            }
                                            //console.log(stats[0].data);
                                        })().then(() => {
                                            let updateKey = `groups.${group}.stats.complete`
                                            HashFiles.update({"_id":`${hashFileID}`},{$set:{[updateKey]:true}})
                                        });
                                    } catch (err) {
                                        throw new Meteor.Error('E2345', err.message);
                                        }
                                    })
                                }
                            });
                        } catch (err) {
                            throw new Meteor.Error('E2345', err.message);
                            }
                        })
                    }
                });
            
            } catch (err) {
                throw new Meteor.Error('E1234', err.message);
            }
                }
            } else {
                // This is a new group
                // console.log("New Group Upload")
                let doc = {}
                let key = `groups.${group}.data`
                doc[group] = usersInGroup
                // console.log(doc)
                HashFiles.update({"_id":hashFileID},{$set:{[key]:usersInGroup}})
                // Calculate some stats for use...
                let lookupKey = `meta.username.${hashFileID}`
                let totalHashes = usersInGroup.length
                let crackedTotal = 0
                let crackedUsers = []
                let passReuseStats = {}
                let crackedStatOverview = []
                // console.log(lookupKey)
                let hashesForUsers = Hashes.find({[lookupKey]:{$in:usersInGroup}}).fetch()
                // console.log(hashesForUsers)
                if(hashesForUsers.length > 0){
                // console.log(hashesForUsers);
                _.each(hashesForUsers, (userHash) => {
                    if(typeof userHash.meta.cracked !== 'undefined' && userHash.meta.cracked) {
                        let filteredUsersLength = _.filter(userHash.meta.username[hashFileID], function(val){
                            return usersInGroup.includes(val);
                        })
                        // passReuseStats[userHash.data] = userHash.meta.username[hashFileID].length
                        passReuseStats[userHash.data] = filteredUsersLength.length
                        crackedTotal += filteredUsersLength.length
                        _.each(filteredUsersLength, (crackedAccount) => {
                            crackedUsers.push(crackedAccount)
                            // console.log(crackedAccount)
                        })
                    }
                })
                crackedStatOverview.push({
                    "name":"Cracked",
                    "label":"Cracked",
                    "value":crackedTotal
                })
                crackedStatOverview.push({
                    "name":"Uncracked",
                    "label":"Uncracked",
                    "value":totalHashes-crackedTotal
                })
                let $match = {$and:[{'meta.cracked':true},{'meta.source':`${theHashFile._id}`},{[lookupKey]:{$in:usersInGroup}}]};
            let $project = {"length":{$strLenCP:"$meta.plaintext"}}
            let $group = {_id:"$length",count:{$sum:1}}
            let $sort = {_id:1}
            try {
                (async () => {
                    const stats = await Hashes.rawCollection().aggregate([
                        { 
                        $match
                        },
                        {
                        $project, 
                        },
                        {
                        $group,
                        },
                        {
                        $sort
                        }
                    ]).toArray();
                    // console.log(stats);
                    //return orderedItems;
                    doc = { 
                        passReuseStats: passReuseStats,
                        crackedStatOverview: crackedStatOverview,
                        crackedUsers: crackedUsers,
                        passwordLengthStats:stats,
                        categoriesStats:categoriesStats,
                        breachListStats:breachListStats
                    }
                    let key = `groups.${group}.stats`
                    //doc[group] = usersInGroup
                    // console.log(doc)
                    HashFiles.update({"_id":hashFileID},{$set:{[key]:doc}})
                    // HashFiles.update({"_id":`${source}`},{$set:{'passwordLengthStats':stats}})
                })().then(() => {
                    // THEN UPDATE CATEGORIES SOURCE STATS
                    for (let [key, value] of Object.entries(categoriesStats)) {
                        bound(() =>{
                            let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`},{'meta.listCategories':`${categoriesStats[key].label}`},{[lookupKey]:{$in:usersInGroup}}]};
                            try {
                            (async () => {
                                const stats = await Hashes.rawCollection().aggregate([
                                    { 
                                    $match
                                    },
                                    {
                                    $count:"data"
                                    }
                                ]).toArray();
                                if(typeof stats[0] !== 'undefined'){
                                    // console.log(`FOUND ${key} ${stats[0].data}`)
                                    let updateKey = `groups.${group}.stats.categoriesStats.${key}.count`
                                    HashFiles.update({"_id":`${hashFileID}`},{$set:{[updateKey]:stats[0].data}})
                                }
                                //console.log(stats[0].data);
                            })().then(() => {
                                for (let [key, value] of Object.entries(breachListStats)) {
                                    bound(() =>{
                                        let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`},{'meta.breachesObserved':`${breachListStats[key].label}`},{[lookupKey]:{$in:usersInGroup}}]};
                                        try {
                                        (async () => {
                                            const stats = await Hashes.rawCollection().aggregate([
                                                { 
                                                $match
                                                },
                                                {
                                                $count:"data"
                                                }
                                            ]).toArray();
                                            if(typeof stats[0] !== 'undefined'){
                                                // console.log(`FOUND ${key} ${stats[0].data}`)
                                                let updateKey = `groups.${group}.stats.breachListStats.${key}.count`
                                                HashFiles.update({"_id":`${hashFileID}`},{$set:{[updateKey]:stats[0].data}})
                                            }
                                            //console.log(stats[0].data);
                                        })().then(() => {
                                            let updateKey = `groups.${group}.stats.complete`
                                            HashFiles.update({"_id":`${hashFileID}`},{$set:{[updateKey]:true}})
                                        });;
                                    } catch (err) {
                                        throw new Meteor.Error('E2345', err.message);
                                        }
                                    })
                                }
                            });
                        } catch (err) {
                            throw new Meteor.Error('E2345', err.message);
                            }
                        })
                    }
                });
            
            } catch (err) {
                throw new Meteor.Error('E1234', err.message);
            }

                }
            }
        } else {
            // This is a new group (and the first group)
            // console.log("First Group Upload")
            let doc = {}
            doc[group] = {data: usersInGroup}
            //  console.log(doc)
            HashFiles.update({"_id":hashFileID},{$set:{groups:doc}})
            // Calculate some stats for use...
            let lookupKey = `meta.username.${hashFileID}`
            let totalHashes = usersInGroup.length
            let crackedTotal = 0
            let crackedUsers = []
            let passReuseStats = {}
            let crackedStatOverview = []
            // console.log(lookupKey)
            let hashesForUsers = Hashes.find({[lookupKey]:{$in:usersInGroup}}).fetch()
            // console.log(hashesForUsers)
            if(hashesForUsers.length > 0){
            // console.log(hashesForUsers);
            _.each(hashesForUsers, (userHash) => {
                if(typeof userHash.meta.cracked !== 'undefined' && userHash.meta.cracked) {
                    let filteredUsersLength = _.filter(userHash.meta.username[hashFileID], function(val){
                        return usersInGroup.includes(val);
                    })
                    // passReuseStats[userHash.data] = userHash.meta.username[hashFileID].length
                    passReuseStats[userHash.data] = filteredUsersLength.length
                    crackedTotal += filteredUsersLength.length
                    _.each(filteredUsersLength, (crackedAccount) => {
                        crackedUsers.push(crackedAccount)
                        // console.log(crackedAccount)
                    })
                }
            })
            crackedStatOverview.push({
                "name":"Cracked",
                "label":"Cracked",
                "value":crackedTotal
            })
            crackedStatOverview.push({
                "name":"Uncracked",
                "label":"Uncracked",
                "value":totalHashes-crackedTotal
            })
            let $match = {$and:[{'meta.cracked':true},{'meta.source':`${theHashFile._id}`},{[lookupKey]:{$in:usersInGroup}}]};
            let $project = {"length":{$strLenCP:"$meta.plaintext"}}
            let $group = {_id:"$length",count:{$sum:1}}
            let $sort = {_id:1}
            try {
                (async () => {
                    const stats = await Hashes.rawCollection().aggregate([
                        { 
                        $match
                        },
                        {
                        $project, 
                        },
                        {
                        $group,
                        },
                        {
                        $sort
                        }
                    ]).toArray();
                    // console.log(stats);
                    //return orderedItems;
                    doc = { 
                        passReuseStats: passReuseStats,
                        crackedStatOverview: crackedStatOverview,
                        crackedUsers: crackedUsers,
                        passwordLengthStats:stats,
                        categoriesStats:categoriesStats,
                        breachListStats:breachListStats
                    }
                    let key = `groups.${group}.stats`
                    //doc[group] = usersInGroup
                    // console.log(doc)
                    // console.log("Updating initial for group...")
                    HashFiles.update({"_id":hashFileID},{$set:{[key]:doc}})
                    // HashFiles.update({"_id":`${source}`},{$set:{'passwordLengthStats':stats}})
                })().then(() => {
                    // THEN UPDATE CATEGORIES SOURCE STATS
                    for (let [key, value] of Object.entries(categoriesStats)) {
                        bound(() =>{
                            let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`},{'meta.listCategories':`${categoriesStats[key].label}`},{[lookupKey]:{$in:usersInGroup}}]};
                            try {
                            (async () => {
                                const stats = await Hashes.rawCollection().aggregate([
                                    { 
                                    $match
                                    },
                                    {
                                    $count:"data"
                                    }
                                ]).toArray();
                                if(typeof stats[0] !== 'undefined'){
                                    // console.log(`FOUND ${key} ${stats[0].data}`)
                                    let updateKey = `groups.${group}.stats.categoriesStats.${key}.count`
                                    HashFiles.update({"_id":`${hashFileID}`},{$set:{[updateKey]:stats[0].data}})
                                }
                                //console.log(stats[0].data);
                            })().then(() => {
                                for (let [key, value] of Object.entries(breachListStats)) {
                                    bound(() =>{
                                        let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`},{'meta.breachesObserved':`${breachListStats[key].label}`},{[lookupKey]:{$in:usersInGroup}}]};
                                        try {
                                        (async () => {
                                            const stats = await Hashes.rawCollection().aggregate([
                                                { 
                                                $match
                                                },
                                                {
                                                $count:"data"
                                                }
                                            ]).toArray();
                                            if(typeof stats[0] !== 'undefined'){
                                                // console.log(`FOUND ${key} ${stats[0].data}`)
                                                let updateKey = `groups.${group}.stats.breachListStats.${key}.count`
                                                HashFiles.update({"_id":`${hashFileID}`},{$set:{[updateKey]:stats[0].data}})
                                            }
                                            //console.log(stats[0].data);
                                        })().then(() => {
                                            let updateKey = `groups.${group}.stats.complete`
                                            HashFiles.update({"_id":`${hashFileID}`},{$set:{[updateKey]:true}})
                                        });;
                                    } catch (err) {
                                        throw new Meteor.Error('E2345', err.message);
                                        }
                                    })
                                }
                            });
                        } catch (err) {
                            throw new Meteor.Error('E2345', err.message);
                            }
                        })
                    }
                });
            
            } catch (err) {
                throw new Meteor.Error('E1234', err.message);
            }
            
            
            }
        }
        
    }
    return
}

function deleteHashesFromID(id){
    // First remove all hashes where this is the sole source...
    Hashes.remove({'meta.source':{$eq:[id]}})
    // Then need to remove references where there were double
    let hashList = Hashes.find({'meta.source':id}).fetch()
    _.each(hashList, (entry) => {
        let filtered = entry.meta.source.filter(function(value, index, arr){
            return value != id;
        });
        Hashes.update({"_id":entry._id},{$set:{'meta.source':filtered}})
    })
    // Then remove the files:
    HashFiles.remove({"_id":id})
}


  

Meteor.methods({
    async uploadHashData(fileName,fileData) {
        processUpload(fileName, fileData);
        return true;
    },

    async deleteHashes(fileIDArray){
        if(Roles.userIsInRole(Meteor.userId(),['admin','files.delete'])){
            _.each(fileIDArray, (fileID) => {
                deleteHashesFromID(fileID)
            })
            return true
        }
        throw new Meteor.Error(401,'401 Unauthorized','Your account is not authorized to delete hashes/hash files')
    },

    async crackHashes(data){
        if(Roles.userIsInRole(Meteor.userId(), ['admin','hashes.crack'])){
            let creds = AWSCOLLECTION.findOne({type:'creds'})
            if(creds){
                let awsSettings = AWSCOLLECTION.findOne({'type':"settings"})
                if(!awsSettings){
                    throw new Meteor.Error(500, 'AWS Settings Not Configured','The Application Admin has not run the initial configuration of all AWS resources yet so cracking cannot occur.')
                }
                let fileIDArray = data.ids
                // {redactionNone: true, redactionCharacter: false, redactionLength: false, redactionFull: false}
                let redactionValue = data.maskingOption;
                // console.log(redactionValue)
                const AWS = require('aws-sdk');
                AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
                const s3 = new AWS.S3({
                    accessKeyId: creds.accessKeyId,
                    secretAccessKey: creds.secretAccessKey
                });
                
                let queryDoc = [];
                _.each(fileIDArray, (fileID) => {
                    queryDoc.push({
                        'meta.source':fileID
                    })
                })

                var raw = Hashes.rawCollection();
                var distinct = Meteor.wrapAsync(raw.distinct, raw);
                const hashTypes = distinct("meta.type",{$or:queryDoc},{fields:{data:1}});
                const uuidv4 = require('uuid/v4');
                const randomVal = uuidv4();
                _.each(hashTypes, (type) => {
                    let hashes = Hashes.find({$and:[{$or:queryDoc},{'meta.type':{$eq: type}},{'meta.plaintext':{$exists:false}}]},{fields:{data:1}}).fetch()
                    let hashArray = [];
                    _.each(hashes, (hash) => {
                        hashArray.push(hash.data)
                    })
                    // this is the hashArray to upload to the s3 bucket with a uuid name...
                    // console.log(hashArray.join('\n'));
                    const params = {
                        Bucket: `${awsSettings.bucketName}`, // pass your bucket name
                        Key: `${randomVal}.${type}.credentials`, 
                        Body:hashArray.join('\n'),
                        // Body: JSON.stringify(hashArray, null, 2)
                    };
                    s3.upload(params, function(s3Err, data) {
                        if (s3Err) throw s3Err
                        // console.log(`File uploaded successfully at ${data.Location}`)
                    });
                })
                let properInstanceType = ""
                switch (data.instanceType){
                    case "p3_2xl":
                        properInstanceType = "p3.2xlarge"
                        break
                    case "p3_8xl":
                        properInstanceType = "p3.8xlarge"
                        break
                    case "p3_16xl":
                        properInstanceType = "p3.16xlarge"
                        break
                    case "p3dn_24xl":
                        properInstanceType = "p3dn.24xlarge"
                        break
                }
                // console.log(data);
                let crackJobID = HashCrackJobs.insert({uuid:randomVal,types:hashTypes,status:'Hashes Uploaded',sources:fileIDArray, duration:data.duration, instanceType:properInstanceType,availabilityZone:data.availabilityZone})
                if(crackJobID){
                    // We will add .25 to the rate chosen, and will allow this to be user controlled eventually...
                    let price = (parseFloat(data.rate) + 0.25).toFixed(2)
                    let userDataString = `#!/bin/bash
sudo systemctl stop sshd.service
sudo systemctl disable sshd.service
sudo DEBIAN_FRONTEND=noninteractive apt-get -yq update
sudo DEBIAN_FRONTEND=noninteractive apt-get -yq install build-essential linux-headers-$(uname -r) unzip p7zip-full linux-image-extra-virtual 
sudo DEBIAN_FRONTEND=noninteractive apt-get -yq install python3-pip
pip3 install psutil
sudo DEBIAN_FRONTEND=noninteractive apt-get -yq install awscli

sudo touch /etc/modprobe.d/blacklist-nouveau.conf
sudo bash -c "echo 'blacklist nouveau' >> /etc/modprobe.d/blacklist-nouveau.conf"
sudo bash -c "echo 'blacklist lbm-nouveau' >> /etc/modprobe.d/blacklist-nouveau.conf"
sudo bash -c "echo 'options nouveau modeset=0' >> /etc/modprobe.d/blacklist-nouveau.conf"
sudo bash -c "echo 'alias nouveau off' >> /etc/modprobe.d/blacklist-nouveau.conf"
sudo bash -c "echo 'alias lbm-nouveau off' >> /etc/modprobe.d/blacklist-nouveau.conf"

sudo touch /etc/modprobe.d/nouveau-kms.conf
sudo bash -c "echo 'options nouveau modeset=0' >>  /etc/modprobe.d/nouveau-kms.conf"
sudo update-initramfs -u

cat << EOF > /home/ubuntu/driver-and-hashcat-install.sh
#!/bin/bash
cd /home/ubuntu
echo "Configuring Drivers" > status.txt
aws s3 cp ./status.txt s3://${awsSettings.bucketName}/${randomVal}.status

wget http://us.download.nvidia.com/tesla/410.104/NVIDIA-Linux-x86_64-410.104.run
sudo /bin/bash NVIDIA-Linux-x86_64-410.104.run --ui=none --no-questions --silent -X

echo "Installing Hashcat" > status.txt
aws s3 cp ./status.txt s3://${awsSettings.bucketName}/${randomVal}.status

wget https://hashcat.net/files/hashcat-5.1.0.7z
7za x hashcat-5.1.0.7z

git clone https://github.com/praetorian-code/Hob0Rules.git
cd /home/ubuntu/Hob0Rules/wordlists
gunzip *.gz
crontab -r

cd /home/ubuntu
git clone https://github.com/danielmiessler/SecLists.git
cd /home/ubuntu/SecLists/Passwords
rm -f ./Leaked-Databases/rockyou* 
rm -f ./*/*withcount*
rm -f ./Leaked-Databases/phpbb-cleaned-up.txt
rm -f ./Leaked-Databases/youporn2012-raw.txt
cd /tmp
tar xvf /home/ubuntu/SecLists/Passwords/SCRABBLE-hackerhouse.tgz
mv /tmp/SCRABBLE/Merriam-Webster-SCRABBLE-4thEdition.txt /home/ubuntu/SecLists/Passwords/
cd /home/ubuntu/SecLists/Passwords
cp /home/ubuntu/Hob0Rules/wordlists/rockyou.txt ./Leaked-Databases/rockyou.txt 
cp /home/ubuntu/Hob0Rules/wordlists/english.txt ./english.txt 
cat \\$(find . -iname "*.txt") | uniq -u > /home/ubuntu/COMBINED-PASS.txt 
cd /home/ubuntu
`
if(hashTypes.includes("NTLM")){
    userDataString +=`
    # download file from s3
    aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.NTLM.credentials .
    aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.NTLM.credentials
    
    echo "Cracking NTLM Passwords" > status.txt
    aws s3 cp ./status.txt s3://${awsSettings.bucketName}/${randomVal}.status
    `
    // Building towards basic and advanced cracking
    userDataString += `
    sudo ./hashcat-5.1.0/hashcat64.bin -a 0 -m 1000 ./${randomVal}.NTLM.credentials ./COMBINED-PASS.txt -r ./Hob0Rules/d3adhob0.rule -o crackedNTLM.txt -O -w 3
    sudo ./hashcat-5.1.0/hashcat64.bin -a 3 -m 1000 ./${randomVal}.NTLM.credentials -o brute7.txt -i ?a?a?a?a?a?a?a -O -w 3
    `
}

if(hashTypes.includes("LM")){
    userDataString +=`
    # download file from s3
    aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.LM.credentials .
    aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.LM.credentials
    
    echo "Cracking LM Passwords" > status.txt
    aws s3 cp ./status.txt s3://${awsSettings.bucketName}/${randomVal}.status
    `
    // Building towards basic and advanced cracking
    userDataString += `    
    sudo ./hashcat-5.1.0/hashcat64.bin -a 0 -m 3000 ./${randomVal}.LM.credentials ./COMBINED-PASS.txt -r ./Hob0Rules/d3adhob0.rule -o crackedLM.txt -O -w 3
    sudo ./hashcat-5.1.0/hashcat64.bin -a 3 -m 3000 ./${randomVal}.LM.credentials -o brute7.txt -i ?a?a?a?a?a?a?a -O -w 3
    `
}
// Logic for character swap
// #while read line; do echo -n $line | cut -d ':' -f1 | tr -d '\n'; echo -n ":"; echo $line | cut -d':' -f2 | sed -e 's/[A-Z]/U/g' -e's/[a-z]/l/g' -e 's/[0-9]/0/g' -e 's/[[:punct:]]/*/g'; done < ./hashcat-5.1.0/hashcat.potfile
// Logic for Length swap
// #while read line; do echo -n $line | cut -d ':' -f1 | tr -d '\n'; echo -n ":"; echo $line | cut -d':' -f2 | sed -e 's/[A-Z]/*/g' -e's/[a-z]/*/g' -e 's/[0-9]/*/g' -e 's/[[:punct:]]/*/g'; done < ./hashcat-5.1.0/hashcat.potfile
// Logic for Full swap
// #while read line; do echo -n $line | cut -d ':' -f1 | tr -d '\n'; echo -n ":"; echo cracked; done < /tmp/fake.potfile
userDataString += `
sudo chown ubuntu:ubuntu ./hashcat-5.1.0/hashcat.potfile
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.status

# upload files after cracking
if [ -f ./hashcat-5.1.0/hashcat.potfile ]
then

while read line; do echo -n \\$(echo \\$line | cut -d':' -f1 | tr -d '\\n') >> new.potfile; echo -n \":\" >> new.potfile; hit=\\$(egrep -l \"^\\$(echo \\$line | cut -d':' -f2)$\" \\$(find ./SecLists/Passwords/ -iname \"*.txt\") | tr '\\n' ','); if [ \"\\$hit\" != \"\" ]; then echo -n \"\\$(echo \\$line | cut -d':' -f2):\" >> new.potfile; echo \"\\$hit\" >> new.potfile;else echo -n \"\\$(echo \\$line | cut -d':' -f2)\" >> new.potfile; echo \":\" >> new.potfile; fi; done <./hashcat-5.1.0/hashcat.potfile
`
if(redactionValue.redactionCharacter){
    userDataString += `
    while read line; do echo -n \\$line | cut -d ':' -f1 | tr -d '\\n' >> ./new2.potfile; echo -n \":\" >> ./new2.potfile; echo -n \\$line | cut -d':' -f2 | sed -e 's/[A-Z]/U/g' -e's/[a-z]/l/g' -e 's/[0-9]/0/g' -e 's/[[:punct:]]/*/g' | tr -d '\\n' >> ./new2.potfile; echo -n \":\" >> ./new2.potfile; echo \\$line | cut -d':' -f3 >> ./new2.potfile; done < ./new.potfile
    `
} else if(redactionValue.redactionLength) {
    userDataString += `
    while read line; do echo -n \\$line | cut -d ':' -f1 | tr -d '\\n' >> ./new2.potfile; echo -n \":\" >> ./new2.potfile; echo -n \\$line | cut -d':' -f2 | sed -e 's/[A-Z]/*/g' -e's/[a-z]/*/g' -e 's/[0-9]/*/g' -e 's/[[:punct:]]/*/g' | tr -d '\\n' >> ./new2.potfile; echo -n \":\" >> ./new2.potfile; echo \\$line | cut -d':' -f3 >> ./new2.potfile; done < ./new.potfile
`
} else if(redactionValue.redactionFull){ 
    userDataString += `
    while read line; do echo -n \\$line | cut -d ':' -f1 | tr -d '\\n' >> ./new2.potfile; echo -n \":\" >> ./new2.potfile; echo -n cracked >> ./new2.potfile; echo -n \":\" >> ./new2.potfile; echo \\$line | cut -d':' -f3 >> ./new2.potfile; done < ./new.potfile
`
} else {
    userDataString +=`
cp new.potfile new2.potfile`
}
userDataString += `
    aws s3 cp ./new2.potfile s3://${awsSettings.bucketName}/${randomVal}.hashcat.potfile

    # Self Terminate on completion
    instanceId=\$(curl http://169.254.169.254/latest/meta-data/instance-id/)
    region=\$(curl http://169.254.169.254/latest/dynamic/instance-identity/document | grep region | awk '{print \$3}' | sed  's/"//g'|sed 's/,//g')

    aws ec2 terminate-instances --instance-ids \$(curl http://169.254.169.254/latest/meta-data/instance-id/) --region \$(curl http://169.254.169.254/latest/dynamic/instance-identity/document | grep region | awk '{print \$3}' | sed  's/"//g'|sed 's/,//g')
fi
EOF

chmod +x /home/ubuntu/driver-and-hashcat-install.sh
chown ubuntu:ununtu /home/ubuntu/driver-and-hashcat-install.sh

echo "@reboot ( sleep 15; su -c \"/home/ubuntu/driver-and-hashcat-install.sh\" -s /bin/bash ubuntu )" | crontab -
sudo reboot`;

                    let buff = new Buffer(userDataString);
                    let userData = buff.toString('base64');
                    // console.log(userData)

                    // console.log(data.availabilityZone.replace(/[a-z]$/g, ''))
                    AWS.config.update({region: data.availabilityZone.replace(/[a-z]$/g, '')});
                    let ec2 = new AWS.EC2()

                    var params = {
                        Filters: [
                          {
                            Name: "name",
                            Values: [
                                "ubuntu/images/hvm-ssd/ubuntu-bionic-18.04-amd64-server-20190722.1*" 
                            ],
                          },
                          { 
                              Name:"architecture",
                              Values:[
                                  "x86_64"
                              ]
                          }
                        // {
                        //     Name:"image-id",
                        //     Values: [
                        //         "ami-05c1fa8df71875112"
                        //     ]
                        // }
                          /* more items */
                        ],
                      };
                      ec2.describeImages(params, function(err, data) {
                        if (err) console.log(err, err.stack); // an error occurred
                        else {
                            // console.log(data)
                            imageID = data.Images[0].ImageId
                            //imageID = "ami-05c1fa8df71875112"
                            // We've started our bookkeeping, now to make the spot instance request...
                            var params = {
                                InstanceCount: 1, 
                                LaunchSpecification: {
                                // Will want to get this ARN dynamically in the future (and in fact actually set everything up (roles/etc))
                                IamInstanceProfile: {
                                Arn: `${awsSettings.instanceProfile.Arn}`,
                                }, 
                                // Hardcoded ubuntu 18.04 64bit AMI
                                ImageId: imageID, 
                                InstanceType: properInstanceType, 
                                Placement: {
                                // Need to send this in data as well...
                                AvailabilityZone: data.availabilityZone
                                },
                                UserData: userData, 
                                }, 
                                SpotPrice: `${price}`, 
                                Type: "one-time",
                            };
                            ec2.requestSpotInstances(params, function(err, data) 
                            {
                                bound(() => {
                                    if (err) {
                                        // Remove the HashCrackJob and Delete Files from S3
                                        _.each(hashTypes, (type) => {
                                            const params = {
                                                Bucket: `${awsSettings.bucketName}`, // pass your bucket name
                                                Key: `${randomVal}.${type}.credentials`, 
                                            };
                                            s3.deleteObject(params, function(err2, data2) {
                                                if (err2) console.log(err2, err2.stack); // an error occurred
                                                else {
                                                    bound(() => {
                                                        // Here we have the outer data being what we want
                                                        if(err.code == "MaxSpotInstanceCountExceeded") {
                                                            console.log("Need to tell user that they need to request spot instances of this type for all regions that they can")
                                                            HashCrackJobs.update({uuid:randomVal},{$set:{'status':'Job Failed - Need to Configure Spot Instances in AWS (Click for Details)'}})
                                                        } else {
                                                            console.log(`New Error! ${JSON.stringify(err)}`)
                                                            HashCrackJobs.remove({uuid:randomVal})
                                                        }
                                                    })
                                                }   
                                              });  
                                        })
                                        throw new Meteor.Error(err.statusCode,err.code,err.message); // an error occurred
                                    }
                                    else  {
                                        let update = HashCrackJobs.update({uuid:randomVal},{$set:{spotInstanceRequest:data.SpotInstanceRequests[0]}});
                                    }    
                                })
                            })              
                      }
                    return true
                    
                        /*
                        data = {
                        }
                        */
                    })
                    return true
                }
                throw new Meteor.Error(500,'500 Internal Server Error','Error saving HashCrackJob information');
    
            }
            throw new Meteor.Error(401,'401 Unauthorized','Your account does not appear to have AWS credentials configured')
        }
        throw new Meteor.Error(401,'401 Unauthorized','Your account is not authorized to crack hashes/hash files')
    },

    async uploadGroupFile(fileName,fileData, hashFileID) {
        processGroupsUpload(fileName, fileData, hashFileID);
        return true;
    },

    async removeGroupFile(groupName,hashFileID) {
        // we have a hashFileID and groupName to remove...
        let key =`groups.${groupName}`
        HashFiles.update({"_id":hashFileID},{$unset:{[key]:""}})
        return true;
    },
    
});