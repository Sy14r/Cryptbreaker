/* eslint-disable no-unused-vars */
/**
 * Meteor methods
 */

import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { Hashes, HashFiles, HashCrackJobs, HashFileUploadJobs } from './hashes.js';
import { AWSCOLLECTION } from '/imports/api/aws/aws.js';
var AWS = require('aws-sdk');
var fs = require('fs');
var path = require("path");
var StreamZip = require('node-stream-zip');

import _ from 'lodash';

const bound = Meteor.bindEnvironment((callback) => {callback();});

function deleteAllFilesWithPrefix(prefix, s3obj){
    let awsSettings = AWSCOLLECTION.findOne({'type':"settings"})
    let params = {
        Bucket:`${awsSettings.bucketName}`,
        Prefix: prefix
    }
    s3obj.listObjects(params, function(err, data) {
        bound(() => {
            if (err) console.log(err, err.stack); // an error occurred
            else {        
                _.each(data.Contents, (result) => {
                    // filename is result.Key
                    // Once we've updated all the plaintext we can delete the S3 object
                    let params = {
                        Bucket: `${awsSettings.bucketName}`,
                        Key: result.Key
                    }
                    s3obj.deleteObject(params, function(err, data) {
                        if (err) console.log(err, err.stack); // an error occurred
                        // else {
                        //     bound(() => {
                        //         HashCrackJobs.update({"_id":job._id},{$set:{'status':'Job Completed'}})
                        //     })
                        // }   
                    });                                    
                })
            }   
        })
    })
}

function generateHashesFromLine(line) {
    let hashes = [];
    let splitLine = line.split(':');
    // First check for hashdump format...
    if(splitLine.length - 1 === 6){
        // console.log("HASHDUMP");
        // console.log(splitLine[0].replace('\\\\','\\'))
        if(typeof splitLine[0] === 'string' && splitLine[0].toLowerCase() !== 'krbtgt'){
            if(splitLine[2].length > 0){
                // We have a LM password
                hashes.push({
                    data:splitLine[2].toUpperCase(),
                    meta: {
                        username: [splitLine[0].replace('\\\\','\\')],
                        type:"LM",
                    }
                });
            }
            if(splitLine[3].length > 0){
                // We have an NTLM password
                hashes.push({
                    data:splitLine[3].toUpperCase(),
                    meta: {
                        username: [splitLine[0].replace('\\\\','\\')],
                        type:"NTLM",
                    }
                });
            }
            return hashes;
        }        
    } else if(splitLine.length - 1 === 5){
        // This is responder format...
        let data = splitLine.slice(3).join(":").toUpperCase()
        let username = ""
        if(splitLine[2].length > 0){
            username += `${splitLine[2]}\\`
        }
        if(splitLine[0].length > 0){
            username += `${splitLine[0]}`
        }
        hashes.push({
            data:`${splitLine[0]}:${splitLine[1]}:${splitLine[2]}:${data}`,
            meta: {
                username: [username],
                type:"NTLMv2",
            }
        });
        return hashes;
    }
    // NEED TO ADD LOGIC HERE FOR NON HASHDUMP FORMATTED OUTPUT...
    return hashes;
}

function updateHashesFromPotfile(fileName, fileData){
    let hashFileUploadJobID
    let hashType = ""
    if(fileName.toUpperCase().endsWith("-NTLM.POTFILE")){
        hashFileUploadJobID = HashFileUploadJobs.insert({name:fileName,uploadStatus:0,description:"Uploading Potfile"})
        hashType = "NTLM"
    } else if(fileName.toUpperCase().endsWith("-LM.POTFILE")) {
        hashFileUploadJobID = HashFileUploadJobs.insert({name:fileName,uploadStatus:0,description:"Uploading Potfile"})
        hashType = "LM"
    } else {
        hashFileUploadJobID = HashFileUploadJobs.insert({name:fileName,uploadStatus:-1,description:"Potfile Uploads MUST end in -ntlm.potfile or -lm.potfile"})
        return
    }
    let data = fileData.split(',')[1];
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    let hashFilesUpdated = []
    let count = 0
    let splitData = text.split('\n')
    _.each(splitData, (line) => {
        // Remove empty lines and comments
        if(line.length > 0 && line[0] !== "#"){
            let hash = line.split(':')[0]
            let plaintext = line.split(':').slice(1)[0].trim()
            // console.log(`${hash} -> ${plaintext}`)
            // console.log(plaintext.length)
            let textToEvaluate = plaintext
            if(plaintext.includes('[space]')){
                textToEvaluate = plaintext.replace(/\[space\]/g," ")
            }
            let plaintextStats = {
                length: textToEvaluate.length,
                upperCount: (textToEvaluate.match(/[A-Z]/g) || []).length,
                lowerCount: (textToEvaluate.match(/[a-z]/g) || []).length,
                numberCount: (textToEvaluate.match(/[0-9]/g) || []).length,
                symbolCount: (textToEvaluate.match(/[-!$%^&*()@_+|~=`{}\[\]:";'<>?,.\/\ ]/g) || []).length,
            }
            let hashData = Hashes.findOne({"data":hash})
            // if we don't have the hash need to skip it or we add it without type? just have hash data, meta no source no type? it then do meta info... else just update it
            if(typeof hashData === 'undefined'){
                hashData = Hashes.insert({
                    data:hash,
                    meta: {
                        type: hashType,
                        source: [],
                        cracked: true,
                        plaintext: plaintext,
                        plaintextStats: plaintextStats,
                        username: {}
                    }
                })
            } else {
                let wasCracked = hashData.meta.cracked
                Hashes.update({"data":hash},{$set:{'meta.cracked':true,'meta.plaintext':plaintext,'meta.plaintextStats':plaintextStats}})
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
            
        }
        count++
        if(count % 100 == 0){
            bound(() =>{HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:(count/splitData.length)*100}})})
        }

    })
    bound(() =>{HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:100,description:"Potfile Uploaded Successfully"}})})

    // console.log(hashFilesUpdated)
    // recalculate stats for each of the hash files that we modified...
    _.each(hashFilesUpdated, (hashFileID) => {
        // First stat is the length of cracked plaintext passwords
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
            })().then(() => {
                // Calcualte reuse stats
                let hashFileUsersKey = `$meta.username.${hashFileID}`
                let plaintextFilter = "$meta.plaintext"
                $match = {$and: [{'meta.source':hashFileID},{'meta.cracked':true}]};
                $project = {"hash":plaintextFilter,"count":{$size:[hashFileUsersKey]}}
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
                            $limit:10
                            }
                        ]).toArray();
                        // console.log(stats);
                        //return orderedItems;
                        HashFiles.update({"_id":`${hashFileID}`},{$set:{'passwordReuseStatsCracked':stats}})
                    })();
                } catch (err) {
                    throw new Meteor.Error('E1235',err.message);
                }
                
            });
    
        } catch (err) {
        throw new Meteor.Error('E1234', err.message);
        }
        // if there are password policies then update the violates policy here as well...
        let hashFile = HashFiles.findOne({"_id":hashFileID})
        if(typeof hashFile.passwordPolicy !== 'undefined'){
            let policyDoc = hashFile.passwordPolicy
            let crackedHashes = Hashes.find({$and:[{"meta.source":hashFileID},{'meta.cracked':true}]}).fetch()
            let violations = []

            if(crackedHashes.length > 0){
                _.each(crackedHashes, (hash) => {
                    
                    let textToEvaluate = hash.meta.plaintext
                    if(textToEvaluate.includes('[space]')){
                        textToEvaluate = textToEvaluate.replace(/\[space\]/g," ")
                    }
                    let wasInvalid = false
                    if(policyDoc.hasLengthRequirement === true){
                        if(textToEvaluate.length < policyDoc.lengthRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasUpperRequirement  === true){
                        if((textToEvaluate.match(/[A-Z]/g) || []).length < policyDoc.upperRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasLowerRequirement === true){
                        if((textToEvaluate.match(/[a-z]/g) || []).length < policyDoc.lowerRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasSymbolsRequirement === true){
                        if((textToEvaluate.match(/[-!$%^&*()@_+|~=`{}\[\]:";'<>?,.\/\ ]/g) || []).length < policyDoc.symbolsRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasNumberRequirement === true){
                        if((textToEvaluate.match(/[0-9]/g) || []).length < policyDoc.numberRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasUsernameRequirement === true){
                        _.each(hash.meta.username[hashFileID], (username) => {
                            if(!wasInvalid){
                                let accountName = username
                                let domainName = ""
                                if(username.includes("\\")){
                                    let splitVal = username.split("\\")
                                    accountName = splitVal[1]
                                    domainName = splitVal[0]
                                }
                                if(!wasInvalid && domainName !== ""){
                                    if(textToEvaluate.toLowerCase().includes(domainName.toLowerCase())){
                                        violations.push(hash._id)
                                        wasInvalid = true
                                    }
                                }
                                if(!wasInvalid && accountName !== ""){
                                    if(textToEvaluate.toLowerCase().includes(accountName.toLowerCase())){
                                        violations.push(hash._id)
                                        wasInvalid = true
                                    }
                                }
                            }        
                        })
                    }

                })
            }
            HashFiles.update({"_id":hashFileID},{$set:{'policyViolations':violations}})
        }
        
    })

}

async function processNTDSZip(fileName, fileData, date){
    
    const hashFileID = HashFiles.insert({name:`${fileName}`,uploadStatus:0,hashCount:0,crackCount:0,uploadDate:date})
    const hashFileUploadJobID = HashFileUploadJobs.insert({name:fileName,uploadStatus:0,hashFileID:hashFileID,description:"Processing ZIP File"})
    let data = fileData.split(',')[1];
    let buff = new Buffer(data, 'base64');

    var fsWriteFileSync = Meteor.wrapAsync(fs.writeFile,fs);
    fs.mkdirSync(`/tmp/${fileName}`)
    fsWriteFileSync(`/tmp/${fileName}/${fileName}`,buff);
    // we have the file in /tmp
    bound(() =>{HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:10, description:"Extracting ZIP"}})})
    var zip = new StreamZip({
        file: `/tmp/${fileName}/${fileName}`
      , storeEntries: true
    });
    zip.on('error', function(err) { 
        bound(() =>{HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:-1, description:"Error Extracting ZIP"}})})
        console.error('[ERROR]', err); 
    });

    zip.on('ready', function () {
    // console.log('All entries read: ' + zip.entriesCount);
    // console.log(zip.entries());
    });
    let total = 0
    let count = 0
    let pathsToMake = []
    zip.on('entry', function (entry) {
        var pathname = path.resolve(`/tmp/${fileName}/`, entry.name);
        // console.log(pathname)
        if (/\.\./.test(path.relative(`/tmp/${fileName}/`, pathname))) {
            // console.warn("[zip warn]: ignoring maliciously crafted paths in zip file:", entry.name);
            total++
            return;
        }
        if ('/' === entry.name[entry.name.length - 1]) {
          console.log('[DIR]', entry.name);
        //   fs.mkdirSync(pathname)
          return;
        } else {
            console.log('[FILE]', entry.name);
            let splitVal = pathname.split("/")
            let dirPathFromFile = splitVal.slice(0,splitVal.length - 1).join("/")
            if(!pathsToMake.includes(dirPathFromFile)){
                pathsToMake.push(dirPathFromFile)
                fs.mkdirSync(dirPathFromFile)
            }
            console.log(`[PATH] ${dirPathFromFile}`)
            total++
        }
      
        // console.log('[FILE]', entry.name);
        zip.stream(entry.name, function (err, stream) {
          if (err) { console.error('Error:', err.toString()); return; }
      
          stream.on('error', function (err) { console.log('[ERROR]', err); return; });
      
          // example: print contents to screen
          //stream.pipe(process.stdout);
      
          // example: save contents to file
        //   console.log(pathname)
          fs.stat(pathname, function(err) {
            if (err != null){
                stream.pipe(fs.createWriteStream(`${pathname}`));
                count++
                if(count==total){
                    bound(() =>{HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:20, description:"Recovering Secrets"}})})
                    // console.log("ZIP PROCESSED")
                    // console.log("Recovering Secrets...")
                    const util = require('util');
                    const exec = util.promisify(require('child_process').exec);

                    //also look here for recovering histoy in the future...
                    async function waitExec() {
                    const { stdout, stderr } = await exec(`secretsdump.py -system /tmp/${fileName}/registry/SYSTEM -ntds "/tmp/${fileName}/Active Directory/ntds.dit" LOCAL -outputfile /tmp/${fileName}/customer 2>&1 >/dev/null`);
                        // console.log('stdout:', stdout);
                        // console.error('stderr:', stderr);
                        bound(() =>{HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:30}})})
                        // console.log(`Secret Recovery Complete...`)
                        // we now have the /tmp/${fileName}/customer.ntds file in the format we want...                      
                        fs.readFile(`/tmp/${fileName}/customer.ntds`, 'utf8', function(err, contents) {
                            // console.log(contents);
                            exec(`rm -rf /tmp/${fileName}`)
                            bound(() =>{HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:45, description:"Adding Hashes to DB"}})})
                            processUpload(fileName, contents, false, hashFileID)
                            return true;
                        });
                    }
                    waitExec();   
                }
            }})
        });
      })
      
}

async function processRawHashFile(fileName, fileData, date){
    let data = fileData.split(',')[1];
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    let differentHashes = 0;
    let alreadyCrackedCount = 0;
    let totalHashes = [];
    let hashType = fileName.split(".")[1].toUpperCase()
    _.each(text.split('\n'), (line) => {
        if(line.length > 0 && !line.startsWith("#")){
            totalHashes.push({
                data:line.trim().toUpperCase(),
                meta:{
                    username: [],
                    type: hashType
            }})        
        }
    })
    if(totalHashes.length > 0){
        // console.log(JSON.stringify(totalHashes))
        // return
        let hashFileID = HashFiles.insert({name:fileName,hashCount:0,crackCount:0,uploadDate:date})
        let hashFileUploadJobID = HashFileUploadJobs.insert({name:fileName,uploadStatus:20,hashFileID:hashFileID,description:"Optimizing DB Load"})
        let hashDict = {};
        let counter = 0
        _.each(totalHashes,(hash)=>{
            if(hashDict[`${hash.data}-${hash.meta.type}`]){
                hashDict[`${hash.data}-${hash.meta.type}`].meta.username = hashDict[`${hash.data}-${hash.meta.type}`].meta.username.concat(hash.meta.username)
            } else {
                hashDict[`${hash.data}-${hash.meta.type}`] = hash
            }
        })
        // console.log(`Original Hash Length: ${totalHashes.length}`)
        // console.log(`Hash Dict Length: ${Object.keys(hashDict).length}`)
        HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:25,description:"Adding Hashes to DB"}})
        // NEED TO ADD HASHES
        let dictKeys = Object.keys(hashDict)
        _.each(dictKeys, (dictKey) => {
            // _.each(hashesToAdd,(hash)=>{
                let hash = hashDict[dictKey]
                let newUsername = false;
                let newFile = false;
                hash.meta.source = [hashFileID];
                // console.log(JSON.stringify(hash))
                // Check if we already have the exact hash - source, account, and data are all the same
                let storedHash = Hashes.findOne({$and:[{data:{$eq:hash.data}},{'meta.type':hash.meta.type}]})
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
                    if(hash.meta.username.length === 0){
                        counter += 1;

                    } else {
                        counter += hash.meta.username.length;
                    }

                } else {
                    // If we didn't have the hash we add it if it isn't the blank lm/ntlm hash
                    // if(hash.data !== "aad3b435b51404eeaad3b435b51404ee" && hash.data !== "31d6cfe0d16ae931b73c59d7e0c089c0"){
                    let usernames = hash.meta.username
                    let usernameLegth = hash.meta.username.length
                    delete hash.meta.username
                    hash.meta.username = { [hashFileID]: usernames }
                    // console.log(JSON.stringify(hash))
                    let insertedVal = Hashes.insert(hash);
                    if(!insertedVal){
                        throw Error("Error inserting hash into database");
                    }
                    if(usernameLegth === 0){
                        counter += 1;

                    } else {
                        counter += usernameLegth;
                    }
                    differentHashes += 1
                    // }

                }
                if(differentHashes % 100 === 0) {
                    let val = ((differentHashes/dictKeys.length)*50) + 45
                    HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:val}})
                }
            // })
        })
        // console.log(`hashCount: ${counter} distinct:${differentHashes} cracked: ${alreadyCrackedCount}`)
        HashFiles.update({_id:hashFileID},{$set:{hashCount:counter, distinctCount:differentHashes, crackCount:alreadyCrackedCount}});
        HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:95,description:"Calculating Statistics"}})

        // Calculate Cracked stats if we already have info...
        let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`},{'data':{$not:/^31D6CFE0D16AE931B73C59D7E0C089C0$/}},{'data':{$not:/^AAD3B435B51404EEAAD3B435B51404EE$/}}]};
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
                HashFiles.update({"_id":`${hashFileID}`},{$set:{'passwordLengthStats':stats}})
                HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:97}})
            })().then(() => {
                // Calcualte reuse stats
                let hashFileUsersKey = `$meta.username.${hashFileID}`
                $match = {$and: [{'meta.source':hashFileID},{'data':{$not:/^31D6CFE0D16AE931B73C59D7E0C089C0$/}},{'data':{$not:/^AAD3B435B51404EEAAD3B435B51404EE$/}}]};
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
                        HashFiles.update({"_id":`${hashFileID}`},{$set:{'passwordReuseStats':stats,uploadStatus:100}})
                    })();

                } catch (err) {
                throw new Meteor.Error('E1234', err.message);
                }
                HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:100,description:"File Uploaded Successfully"}})
                // TODO: Move Remove of HashFileUploadJobs where the uploadStatus == 100 to a cron every 5 minutes
                // HashFileUploadJobs.remove({"_id":hashFileUploadJobID})
            });
        
        } catch (err) {
        throw new Meteor.Error('E1234', err.message);
        }
        
    }
    return
}

export async function processUpload(fileName, fileData, isBase64, providedID){
    const date = new Date();
    // console.log(`Tasked to delete following account\n${this.userId}`);
    // console.log(fileName);
    if(fileName.endsWith('.potfile')) {
        // console.log("POTFILE UPLOAD")
        updateHashesFromPotfile(fileName, fileData)
    } else if(fileName.endsWith('.zip') && isBase64) {
        // console.log("POTFILE UPLOAD")
        // console.log("NEED TO PROCESS ZIP")
        processNTDSZip(fileName,fileData, date)     
    } else if(fileName.endsWith('.lm') && isBase64) {
        // console.log("POTFILE UPLOAD")
        // console.log("NEED TO PROCESS ZIP")
        processRawHashFile(fileName,fileData, date)     
    } else if(fileName.endsWith('.ntlm') && isBase64) {
        // console.log("POTFILE UPLOAD")
        // console.log("NEED TO PROCESS ZIP")
        processRawHashFile(fileName,fileData, date)     
    } else { 
        let hashFileID = ''
        // console.log("'Normal' Upload")
        // console.log(fileData);
        let text = ""
        if(isBase64){
            let data = fileData.split(',')[1];
            let buff = new Buffer(data, 'base64');
            text = buff.toString('ascii');    
        } else {
            text = fileData
        }

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
            // console.log(JSON.stringify(totalHashes))
            // return
            let hashFileUploadJobID = ''
            if(isBase64) {
                hashFileID = HashFiles.insert({name:fileName,hashCount:0,crackCount:0,uploadDate:date})
                hashFileUploadJobID = HashFileUploadJobs.insert({name:fileName,uploadStatus:20,hashFileID:hashFileID,description:"Optimizing DB Load"})
            } else {
                hashFileID = providedID
                let hashFileUploadJob = HashFileUploadJobs.findOne({"hashFileID":hashFileID})
                hashFileUploadJobID = hashFileUploadJob._id
                HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:20,description:"Optimizing DB Load"}})
            }
            // Want to optimize DB load...
            /*
                { data: '94F7ED20172A594DC9E57A53BDC260EE',                
                meta: { username: [ 'FAKEDOMAIN\\105' ], type: 'NTLM' } }
            */
           let hashDict = {};
            _.each(totalHashes, (hashesToAdd) => {
                _.each(hashesToAdd,(hash)=>{
                   if(hashDict[`${hash.data}-${hash.meta.type}`]){
                        hashDict[`${hash.data}-${hash.meta.type}`].meta.username = hashDict[`${hash.data}-${hash.meta.type}`].meta.username.concat(hash.meta.username)
                   } else {
                        hashDict[`${hash.data}-${hash.meta.type}`] = hash
                   }
                })
            })
            // console.log(`Original Hash Length: ${totalHashes.length}`)
            // console.log(`Hash Dict Length: ${Object.keys(hashDict).length}`)
            HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:25,description:"Adding Hashes to DB"}})
            // NEED TO ADD HASHES
            let dictKeys = Object.keys(hashDict)
            _.each(dictKeys, (dictKey) => {
                // _.each(hashesToAdd,(hash)=>{
                    let hash = hashDict[dictKey]
                    let newUsername = false;
                    let newFile = false;
                    hash.meta.source = [hashFileID];
                    // console.log(JSON.stringify(hash))
                    // Check if we already have the exact hash - source, account, and data are all the same
                    let storedHash = Hashes.findOne({$and:[{data:{$eq:hash.data}},{'meta.type':hash.meta.type}]})
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
                        if(hash.meta.username.length === 0){
                            counter += 1;
    
                        } else {
                            counter += hash.meta.username.length;
                        }

                    } else {
                        // If we didn't have the hash we add it
                        let usernames = hash.meta.username
                        let usernameLegth = hash.meta.username.length
                        delete hash.meta.username
                        hash.meta.username = { [hashFileID]: usernames }
                        // console.log(JSON.stringify(hash))
                        let insertedVal = Hashes.insert(hash);
                        if(!insertedVal){
                            throw Error("Error inserting hash into database");
                        }
                        if(usernameLegth === 0){
                            counter += 1;
    
                        } else {
                            counter += usernameLegth;
                        }
                        differentHashes += 1
                        // }

                    }
                    if(differentHashes % 100 === 0) {
                        let val = ((differentHashes/dictKeys.length)*50) + 45
                        HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:val}})
                    }
                // })
            })
            // console.log(`hashCount: ${counter} distinct:${differentHashes} cracked: ${alreadyCrackedCount}`)
            HashFiles.update({_id:hashFileID},{$set:{hashCount:counter, distinctCount:differentHashes, crackCount:alreadyCrackedCount}});
            HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:95,description:"Calculating Statistics"}})

            // Calculate Cracked stats if we already have info...
            let $match = {$and:[{'meta.cracked':true},{'meta.source':`${hashFileID}`},{'data':{$not:/^31D6CFE0D16AE931B73C59D7E0C089C0$/}},{'data':{$not:/^AAD3B435B51404EEAAD3B435B51404EE$/}}]};
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
                    HashFiles.update({"_id":`${hashFileID}`},{$set:{'passwordLengthStats':stats}})
                    HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:97}})
                })().then(() => {
                    // Calcualte reuse stats
                    let hashFileUsersKey = `$meta.username.${hashFileID}`
                    $match = {$and: [{'meta.source':hashFileID},{'data':{$not:/^31D6CFE0D16AE931B73C59D7E0C089C0$/}},{'data':{$not:/^AAD3B435B51404EEAAD3B435B51404EE$/}}]};
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
                            HashFiles.update({"_id":`${hashFileID}`},{$set:{'passwordReuseStats':stats,uploadStatus:100}})
                        })();

                    } catch (err) {
                    throw new Meteor.Error('E1234', err.message);
                    }
                    HashFileUploadJobs.update({"_id":hashFileUploadJobID},{$set:{uploadStatus:100,description:"File Uploaded Successfully"}})
                    // TODO: Move Remove of HashFileUploadJobs where the uploadStatus == 100 to a cron every 5 minutes
                    // HashFileUploadJobs.remove({"_id":hashFileUploadJobID})
                }).then(() => {
                    // Calcualte reuse stats
                    let hashFileUsersKey = `$meta.username.${hashFileID}`
                    let plaintextFilter = "$meta.plaintext"
                    $match = {$and: [{'meta.source':hashFileID},{'meta.cracked':true}]};
                    $project = {"hash":plaintextFilter,"count":{$size:[hashFileUsersKey]}}
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
                                $limit:10
                                }
                            ]).toArray();
                            // console.log(stats);
                            //return orderedItems;
                            HashFiles.update({"_id":`${hashFileID}`},{$set:{'passwordReuseStatsCracked':stats}})
                            return hashFileID
                        })();
                    } catch (err) {
                        throw new Meteor.Error('E1235',err.message);
                    }
                });
            
            } catch (err) {
            throw new Meteor.Error('E1234', err.message);
            }
            
        }
        else {
            throw Error("No valid hashes parsed from upload, please open an issue on GitHub");
        }
        return hashFileID;
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
    // console.log(`Hashfile is ${hashFileID}`)
    let group = fileName.replace(".txt","")

    _.each(text.split('\n'), (line) => {
        if(line.length > 0) {
            usersInGroup.push(line.trim())
        }
    })
    // console.log(usersInGroup)
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
                let passReuseStats = []
                let crackedStatOverview = []
                // console.log(lookupKey)
                let hashesForUsers = Hashes.find({[lookupKey]:{$in:usersInGroup}}).fetch()
                // console.log(hashesForUsers)
                if(hashesForUsers.length > 0){
                // console.log(hashesForUsers);
                _.each(hashesForUsers, (userHash) => {
                    // console.log(userHash)
                    let hashContent = userHash.data;
                    if(typeof userHash.meta.cracked !== 'undefined' && userHash.meta.cracked) {
                        hashContent = userHash.meta.plaintext 
                    }
                    let filteredUsersLength = _.filter(userHash.meta.username[hashFileID], function(val){
                        return usersInGroup.includes(val);
                    })
                    // passReuseStats[userHash.data] = userHash.meta.username[hashFileID].length
                    if(filteredUsersLength.length > 1){
                        passReuseStats.push({"_id":`${userHash._id}`,"hash":hashContent,"count": filteredUsersLength.length})
                    }
                    if(typeof userHash.meta.cracked !== 'undefined' && userHash.meta.cracked) {
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
                let passReuseStats = []
                let crackedStatOverview = []
                // console.log(lookupKey)
                let hashesForUsers = Hashes.find({[lookupKey]:{$in:usersInGroup}}).fetch()
                // console.log(hashesForUsers)
                if(hashesForUsers.length > 0){
                // console.log(hashesForUsers);
                _.each(hashesForUsers, (userHash) => {
                    // console.log(userHash)
                    let hashContent = userHash.data;
                    if(typeof userHash.meta.cracked !== 'undefined' && userHash.meta.cracked) {
                        hashContent = userHash.meta.plaintext 
                    }
                    let filteredUsersLength = _.filter(userHash.meta.username[hashFileID], function(val){
                        return usersInGroup.includes(val);
                    })
                    // passReuseStats[userHash.data] = userHash.meta.username[hashFileID].length
                    if(filteredUsersLength.length > 1){
                        passReuseStats.push({"_id":`${userHash._id}`,"hash":hashContent,"count": filteredUsersLength.length})
                    }
                    if(typeof userHash.meta.cracked !== 'undefined' && userHash.meta.cracked) {
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
            let passReuseStats = []
            let crackedStatOverview = []
            // console.log(lookupKey)
            let hashesForUsers = Hashes.find({[lookupKey]:{$in:usersInGroup}}).fetch()
            // console.log(`Hashes for group ${hashesForUsers}`)
            if(hashesForUsers.length > 0){
            // console.log(hashesForUsers);
            _.each(hashesForUsers, (userHash) => {
                // console.log(userHash)
                let hashContent = userHash.data;
                if(typeof userHash.meta.cracked !== 'undefined' && userHash.meta.cracked) {
                    hashContent = userHash.meta.plaintext 
                }
                let filteredUsersLength = _.filter(userHash.meta.username[hashFileID], function(val){
                    return usersInGroup.includes(val);
                })
                // passReuseStats[userHash.data] = userHash.meta.username[hashFileID].length
                if(filteredUsersLength.length > 1){
                    passReuseStats.push({"_id":`${userHash._id}`,"hash":hashContent,"count": filteredUsersLength.length})
                }
                if(typeof userHash.meta.cracked !== 'undefined' && userHash.meta.cracked) {
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

export function deleteHashesFromID(id){
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
    return `Deleted Hashes for ${id}`;
}

export function queueCrackJob(data){
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
            let hashes = Hashes.find({$and:[{$or:queryDoc},{'meta.type':{$eq: type}},{'meta.plaintext':{$exists:false}},{'data':{$not:/^31D6CFE0D16AE931B73C59D7E0C089C0$/}},{'data':{$not:/^AAD3B435B51404EEAAD3B435B51404EE$/}}]},{fields:{data:1}}).fetch()
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
        let crackConfigDetails = {
            bruteLimit: data.bruteLimit,
            useDictionaries: data.useDictionaries,
            redactionValue: redactionValue
        }
        let crackJobID = HashCrackJobs.insert({uuid:randomVal,types:hashTypes,configDetails:crackConfigDetails,status:'Hashes Uploaded',sources:fileIDArray, duration:data.duration, instanceType:properInstanceType,availabilityZone:data.availabilityZone})
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

git clone https://github.com/Sy14r/HashWrap.git
chmod +x /home/ubuntu/HashWrap/hashwrap

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

let bruteMask = ""
// if there is a bruteLimit generate the mask for hashcat to use
if(data.bruteLimit !== "0" && data.bruteLimit !== "") {
let count = parseInt(data.bruteLimit,10)
for(let i = 0; i<count; i++){
bruteMask += "?a"
}
}

if(hashTypes.includes("NTLM")){
userDataString +=`
# download file from s3
aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.NTLM.credentials .
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.NTLM.credentials
`
// Building towards basic and advanced cracking
// temporarily removed from end:
if(data.useDictionaries) {
userDataString += `
sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin -a 0 -m 1000 --session ${randomVal} /home/ubuntu/${randomVal}.NTLM.credentials /home/ubuntu/COMBINED-PASS.txt -r /home/ubuntu/Hob0Rules/d3adhob0.rule -o crackedNTLM.txt -O -w 3 &
while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
do 
    aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
    if [ -f /home/ubuntu/hashwrap.pause ];
    then
        echo "Pausing NTLM Dictionary Attack" > /home/ubuntu/status.txt
        aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;
    else
        aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
    fi
    sleep 30; 
done
rm -f /home/ubuntu/hashcat.status
`
}
if(data.bruteLimit !== "0" && data.bruteLimit !== "") {
userDataString += `
if [ -f /home/ubuntu/hashwrap.pause ];
then
    echo "Skipping due to pause"        
else
    sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin -a 3 -m 1000 --session ${randomVal} /home/ubuntu/${randomVal}.NTLM.credentials -o bruteNTLM.txt -i ${bruteMask} -O -w 3 &
    while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
    do 
        aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
        if [ -f /home/ubuntu/hashwrap.pause ];
        then
            echo "Pausing NTLM Brute Force" > /home/ubuntu/status.txt
            aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;        
        else
            aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
        fi
        sleep 30; 
    done
    rm /home/ubuntu/hashcat.status
fi
`
}
}

if(hashTypes.includes("LM")){
userDataString +=`
# download file from s3
if [ -f /home/ubuntu/hashwrap.pause ];
then
echo "Skipping due to pause"
else
aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.LM.credentials .
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.LM.credentials
fi
`
// for LM hashes it doesn't matter the brute force limit is as bruteforcing 7 is always the best option and the speed is such that its also incredibly fast
userDataString += `
if [ -f /home/ubuntu/hashwrap.pause ];
then
    echo "Skipping due to pause"
else
    sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin -a 3 -m 3000 --session ${randomVal} /home/ubuntu/${randomVal}.LM.credentials -o bruteLM.txt -i ?a?a?a?a?a?a?a -O -w 3 &
    while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
    do 
        aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
        if [ -f /home/ubuntu/hashwrap.pause ];
        then
            echo "Pausing LM Brute Force" > /home/ubuntu/status.txt
            aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;        
        else
            aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
        fi
        sleep 30; 
    done
    rm /home/ubuntu/hashcat.status
fi
`

}

if(hashTypes.includes("NTLMv2")){
    // download the creds from S3
    userDataString +=`
    if [ -f /home/ubuntu/hashwrap.pause ];
    then
        echo "Skipping due to pause"
    else
        aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.NTLMv2.credentials .
        aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.NTLMv2.credentials
    fi
    `
    // Building towards basic and advanced cracking
    // temporarily removed from end:
    if(data.useDictionaries) {
    userDataString += `
    if [ -f /home/ubuntu/hashwrap.pause ];
    then
        echo "Skipping due to pause"
    else
        sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin -a 0 -m 5600 --session ${randomVal} /home/ubuntu/${randomVal}.NTLMv2.credentials /home/ubuntu/COMBINED-PASS.txt -r /home/ubuntu/Hob0Rules/d3adhob0.rule -o crackedNTLMv2.txt -O -w 3 &
        while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
        do 
            aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
            if [ -f /home/ubuntu/hashwrap.pause ];
            then
                echo "Pausing NTLMv2 Dictionary Attack" > /home/ubuntu/status.txt
                aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;
            else
                aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
            fi
            sleep 30; 
        done
        rm -f /home/ubuntu/hashcat.status
    fi
    `
    }
    if(data.bruteLimit !== "0" && data.bruteLimit !== "") {
    userDataString += `
    if [ -f /home/ubuntu/hashwrap.pause ];
    then
        echo "Skipping due to pause"        
    else
        sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin -a 3 -m 5600 --session ${randomVal} /home/ubuntu/${randomVal}.NTLMv2.credentials -o bruteNTLMv2.txt -i ${bruteMask} -O -w 3 &
        while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
        do 
            aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
            if [ -f /home/ubuntu/hashwrap.pause ];
            then
                echo "Pausing NTLMv2 Brute Force" > /home/ubuntu/status.txt
                aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;        
            else
                aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
            fi
            sleep 30; 
        done
        rm /home/ubuntu/hashcat.status
    fi
    `
    }
}
    
// Logic for character swap
// #while read line; do echo -n $line | cut -d ':' -f1 | tr -d '\n'; echo -n ":"; echo $line | cut -d':' -f2 | sed -e 's/[A-Z]/U/g' -e's/[a-z]/l/g' -e 's/[0-9]/0/g' -e 's/[[:punct:]]/*/g'; done < ./hashcat-5.1.0/hashcat.potfile
// Logic for Length swap
// #while read line; do echo -n $line | cut -d ':' -f1 | tr -d '\n'; echo -n ":"; echo $line | cut -d':' -f2 | sed -e 's/[A-Z]/*/g' -e's/[a-z]/*/g' -e 's/[0-9]/*/g' -e 's/[[:punct:]]/*/g'; done < ./hashcat-5.1.0/hashcat.potfile
// Logic for Full swap
// #while read line; do echo -n $line | cut -d ':' -f1 | tr -d '\n'; echo -n ":"; echo cracked; done < /tmp/fake.potfile
userDataString += `
sudo chown ubuntu:ubuntu ./hashcat-5.1.0/hashcat.potfile
sudo chown ubuntu:ubuntu ./hashcat-5.1.0/${randomVal}.restore
if [ -f /home/ubuntu/hashwrap.pause ]
then
aws s3 cp /home/ubuntu/hashcat-5.1.0/${randomVal}.restore s3://${awsSettings.bucketName}/${randomVal}.restore
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.pause
aws s3 cp /home/ubuntu/${randomVal}.NTLM.credentials s3://${awsSettings.bucketName}/${randomVal}.NTLM.credentials
aws s3 cp /home/ubuntu/${randomVal}.NTLMv2.credentials s3://${awsSettings.bucketName}/${randomVal}.NTLMv2.credentials
aws s3 cp /home/ubuntu/${randomVal}.LM.credentials s3://${awsSettings.bucketName}/${randomVal}.LM.credentials
aws s3 cp /home/ubuntu/COMBINED-PASS.txt s3://${awsSettings.bucketName}/${randomVal}.COMBINED-PASS.txt
aws s3 cp /home/ubuntu/Hob0Rules/d3adhob0.rule s3://${awsSettings.bucketName}/${randomVal}.d3adhob0.rule
echo "Exfiling Cracked Hashes prior to pause" > ./status.txt
else
echo "Finishing Up..." > ./status.txt
fi
# upload files after cracking
if [ -f ./hashcat-5.1.0/hashcat.potfile ]
then
aws s3 cp ./status.txt s3://${awsSettings.bucketName}/${randomVal}.status
`
// below while loop works for NonNTLMv2hashes... will see what we get for NTLMv2 Hashes... likely need to change.
// if NTLM/LM included in types lets process all that into a NTLM-LM.potfile
if(hashTypes.includes("NTLM") || hashTypes.includes("LM")){
    // Handle userdata for NTLM/LM
    userDataString += `
sudo chown ubuntu:ubuntu *.txt
cat crackedNTLM.txt bruteNTLM.txt bruteLM.txt > Cracked-LM-NTLM.txt
cat ./Cracked-LM-NTLM.txt | sed -e 's/ /\\[space\\]/g' > ./Cracked-LM-NTLM.txt.nospaces

while read line; do echo -n \\$(echo \\$line | cut -d':' -f1 | tr -d '\\n') >> NTLM-LM.potfile; echo -n \":\" >> NTLM-LM.potfile; hit=\\$(egrep -l \"^\\$(echo \\$line | cut -d':' -f2-)$\" \\$(find ./SecLists/Passwords/ -iname \"*.txt\") | tr '\\n' ','); if [ \"\\$hit\" != \"\" ]; then echo -n \"\\$hit\" >> NTLM-LM.potfile;echo -n \":\" >> NTLM-LM.potfile; echo \"\\$(echo \\$line | cut -d':' -f2-)\" >> NTLM-LM.potfile; else echo -n \":\" >> NTLM-LM.potfile; echo \"\\$(echo \\$line | cut -d':' -f2-)\" >> NTLM-LM.potfile; fi; done < ./Cracked-LM-NTLM.txt.nospaces
    `
    // At this point we have NTLM-LM.potfile with hash:hit1,hit2,hit3:plaintest or hash::plaintext
    // Handle redaction for NTLM/LM
    if(redactionValue.redactionCharacter){
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1 | tr -d '\\n' >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo -n \\$line | cut -d':' -f2 >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo \\$line | cut -d':' -f3- | sed -e 's/\\[space\\]/ /g' -e 's/[A-Z]/U/g' -e's/[a-z]/l/g' -e 's/[0-9]/0/g' -e 's/[[:punct:]]/*/g'  >> ./NTLM-LM-FINAL.potfile;   done < ./NTLM-LM.potfile
        `
        } else if(redactionValue.redactionLength) {
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1 | tr -d '\\n' >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo -n \\$line | cut -d':' -f2 >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo \\$line | cut -d':' -f3- | sed -e 's/\\[space\\]/ /g' -e 's/[A-Z]/*/g' -e's/[a-z]/*/g' -e 's/[0-9]/*/g' -e 's/[[:punct:]]/*/g'  >> ./NTLM-LM-FINAL.potfile;  done < ./NTLM-LM.potfile
        `
        } else if(redactionValue.redactionFull){ 
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1 | tr -d '\\n' >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo -n \\$line | cut -d':' -f2 >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo cracked >> ./NTLM-LM-FINAL.potfile;  done < ./NTLM-LM.potfile
        `
        } else {
        userDataString +=`
        cp NTLM-LM.potfile NTLM-LM-FINAL.potfile`
        }
    // ABSOLUTELY ENSURE WE HAVE A POTFILE TO SEND TO MARK COMPLETION...
    userDataString += `
    if [ -f ./NTLM-LM-FINAL.potfile ]; 
    then 
        sleep 1; 
    else 
        echo emptypotfile > ./NTLM-LM-FINAL.potfile; 
    fi
    `
}
if(hashTypes.includes("NTLMv2")){
    // Handle userdata for NTLMv2
    userDataString += `
    sudo chown ubuntu:ubuntu *.txt
    cat crackedNTLMv2.txt bruteNTLMv2.txt > Cracked-NTLMv2.txt
    cat ./Cracked-NTLMv2.txt | sed -e 's/ /\\[space\\]/g' > ./Cracked-NTLMv2.txt.nospaces
    while read line; do echo -n \\$(echo \\$line | cut -d':' -f1-6 | tr -d '\\n') >> NTLMv2.potfile; echo -n \":\" >> NTLMv2.potfile; hit=\\$(egrep -l \"^\\$(echo \\$line | cut -d':' -f7- | tr -d '\\n')$\" \\$(find ./SecLists/Passwords/ -iname \"*.txt\") | tr '\\n' ','); if [ \"\\$hit\" != \"\" ]; then echo -n \"\\$hit\" >> NTLMv2.potfile;echo -n \":\" >> NTLMv2.potfile; echo \"\\$(echo \\$line | cut -d':' -f7- | tr -d '\\n')\" >> NTLMv2.potfile; else echo -n \":\" >> NTLMv2.potfile; echo \"\\$(echo \\$line | cut -d':' -f7- | tr -d '\\n')\" >> NTLMv2.potfile; fi; done < ./Cracked-NTLMv2.txt.nospaces
    `
    // At this point we have NTLM-LM.potfile with hash:hit1,hit2,hit3:plaintest or hash::plaintext
    // Handle redaction for NTLM/LM
    if(redactionValue.redactionCharacter){
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1-6 | tr -d '\\n' >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo -n \\$line | cut -d':' -f7 >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo \\$line | cut -d':' -f8- | sed -e 's/\\[space\\]/ /g' -e 's/[A-Z]/U/g' -e's/[a-z]/l/g' -e 's/[0-9]/0/g' -e 's/[[:punct:]]/*/g' >> ./NTLMv2-FINAL.potfile;   done < ./NTLMv2.potfile
        `
        } else if(redactionValue.redactionLength) {
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1-6 | tr -d '\\n' >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo -n \\$line | cut -d':' -f7 >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo \\$line | cut -d':' -f8- | sed -e 's/\\[space\\]/ /g' -e 's/[A-Z]/*/g' -e's/[a-z]/*/g' -e 's/[0-9]/*/g' -e 's/[[:punct:]]/*/g'  >> ./NTLMv2-FINAL.potfile;  done < ./NTLMv2.potfile
        `
        } else if(redactionValue.redactionFull){ 
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1-6 | tr -d '\\n' >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo -n \\$line | cut -d':' -f7 >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo cracked >> ./NTLMv2-FINAL.potfile;  done < ./NTLMv2.potfile
        `
        } else {
        userDataString +=`
        cp NTLMv2.potfile NTLMv2-FINAL.potfile`
        }
    // ABSOLUTELY ENSURE WE HAVE A POTFILE TO SEND TO MARK COMPLETION...
    userDataString += `
    if [ -f ./NTLMv2-FINAL.potfile ]; 
    then 
        sleep 1; 
    else 
        echo emptypotfile > ./NTLMv2-FINAL.potfile; 
    fi
    `
}
// if NTLMv2 included in types lets process all that into a NTLMv2.potfile
// WORK TO COME ONCE UPDATES TO NTLM/LM PROVEN OK
// we now should have NTLM-LM-FINAL.potfile 
// COMMENTED OUT THE SELF TERMINATE FOR TESTING
if(hashTypes.includes("NTLM")||hashTypes.includes("LM")){
    userDataString += `
    aws s3 cp ./NTLM-LM-FINAL.potfile s3://${awsSettings.bucketName}/${randomVal}.hashcat-NTLM-LM.potfile
    `
}

if(hashTypes.includes("NTLMv2")){
    userDataString += `
    aws s3 cp ./NTLMv2-FINAL.potfile s3://${awsSettings.bucketName}/${randomVal}.hashcat-NTLMv2.potfile
    `
}
userDataString += `
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.status
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
              let chosenAZ = data.availabilityZone;
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
                            AvailabilityZone: chosenAZ
                            },
                            UserData: userData, 
                        }, 
                        SpotPrice: `${price}`, 
                        Type: "one-time",
                        // Remove once pause resume finished...
                    };
                    //console.log(params);
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
            return crackJobID
            
                /*
                data = {
                }
                */
            })
            return crackJobID
        }
        throw new Meteor.Error(500,'500 Internal Server Error','Error saving HashCrackJob information');

    }
    throw new Meteor.Error(401,'401 Unauthorized','Your account does not appear to have AWS credentials configured')
}

export function resumeCrackJob(data){
    let creds = AWSCOLLECTION.findOne({type:'creds'})
    if(creds){
        let awsSettings = AWSCOLLECTION.findOne({'type':"settings"})
        if(!awsSettings){
            throw new Meteor.Error(500, 'AWS Settings Not Configured','The Application Admin has not run the initial configuration of all AWS resources yet so cracking cannot occur.')
        }
        
        const AWS = require('aws-sdk');
        AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
        const s3 = new AWS.S3({
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey
        });

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
        let theHCJ = HashCrackJobs.findOne({"_id":data.id})     
        if(!theHCJ.requestedPause || !theHCJ.status === "Job Paused"){
            return `${data.id} - This job cannot be resumed`
        }
        if(theHCJ){
            let randomVal = theHCJ.uuid
            let crackConfigDetails = theHCJ.configDetails
            HashCrackJobs.update({"_id":theHCJ._id},{$set:{requestedPause:"false",status:"Resuming Job"}})
            // We will add .25 to the rate chosen, and will allow this to be user controlled eventually...
            let price = (parseFloat(data.rate) + 0.25).toFixed(2)
            let userDataString = `#!/bin/bash
sudo systemctl stop sshd.service
sudo systemctl disable sshd.service
echo "Upgrading and Installing Necessary Software" > ./status.txt
aws s3 cp ./status.txt s3://${awsSettings.bucketName}/${randomVal}.status

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

git clone https://github.com/Sy14r/HashWrap.git
chmod +x /home/ubuntu/HashWrap/hashwrap

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

aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.COMBINED-PASS.txt /home/ubuntu/COMBINED-PASS.txt
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.COMBINED-PASS.txt 
aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.d3adhob0.rule /home/ubuntu/Hob0Rules/d3adhob0.rule
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.d3adhob0.rule 
aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.restore /home/ubuntu/hashcat-5.1.0/${randomVal}.restore
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.restore 
cd /home/ubuntu
`

let bruteMask = ""
// if there is a bruteLimit generate the mask for hashcat to use
if(crackConfigDetails.bruteLimit !== "0" && crackConfigDetails.bruteLimit !== "") {
let count = parseInt(crackConfigDetails.bruteLimit,10)
for(let i = 0; i<count; i++){
bruteMask += "?a"
}
}

if(theHCJ.stepPaused.includes(" NTLM ")){
userDataString +=`
# download file from s3
aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.NTLM.credentials /home/ubuntu/${randomVal}.NTLM.credentials
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.NTLM.credentials
`
// Building towards basic and advanced cracking
// temporarily removed from end:
if(theHCJ.stepPaused.includes("NTLM Dictionary")) {
userDataString += `       
sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin --session ${randomVal} --restore &
while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
do 
    aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
    if [ -f /home/ubuntu/hashwrap.pause ];
    then
        echo "Pausing NTLM Dictionary Attack" > /home/ubuntu/status.txt
        aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;
    else
        aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
    fi
    sleep 30; 
done
rm -f /home/ubuntu/hashcat.status
`
}
if(theHCJ.stepPaused.includes("NTLM Brute") || (crackConfigDetails.bruteLimit !== "0" && crackConfigDetails.bruteLimit !== "")) {
userDataString += `
if [ -f /home/ubuntu/hashwrap.pause ];
then
    echo "Skipping due to pause"
else`
if(theHCJ.stepPaused.includes("NTLM Brute")){
    userDataString += `
    sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin --session ${randomVal} --restore &
    `
} else {
    userDataString += `
    sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin -a 3 -m 1000 --session ${randomVal} /home/ubuntu/${randomVal}.NTLM.credentials -o bruteNTLM.txt -i ${bruteMask} -O -w 3 &
    `
}
userDataString += `
while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
    do 
        aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
        if [ -f /home/ubuntu/hashwrap.pause ];
        then
            echo "Pausing NTLM Brute Force" > /home/ubuntu/status.txt
            aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;    
        else
            aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
        fi
        sleep 30; 
    done
    rm /home/ubuntu/hashcat.status
fi
`

}
}

if(theHCJ.stepPaused.includes(" LM ") || (theHCJ.stepPaused.includes(" NTLM ") && theHCJ.types.includes("LM"))){
userDataString +=`
# download file from s3
if [ -f /home/ubuntu/hashwrap.pause ];
then
echo "Skipping due to pause"
else
aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.LM.credentials .
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.LM.credentials
fi
`
// If an LM crack job was paused it was paused during the brute force phase
userDataString += `
if [ -f /home/ubuntu/hashwrap.pause ];
then
    echo "Skipping due to pause"
else
`
if(theHCJ.stepPaused.includes(" LM Brute")){
    userDataString += `
    sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin --session ${randomVal} --resume &
    `
} else {
    userDataString += `
    sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin -a 3 -m 3000 --session ${randomVal} /home/ubuntu/${randomVal}.LM.credentials -o bruteLM.txt -i ?a?a?a?a?a?a?a -O -w 3 &
    `
}
userDataString += `
    while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
    do 
        aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
        if [ -f /home/ubuntu/hashwrap.pause ];
        then
            echo "Pausing LM Brute Force" > /home/ubuntu/status.txt
            aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;
        else
            aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
        fi
        sleep 30; 
    done
    rm /home/ubuntu/hashcat.status
fi
`
}

if(theHCJ.stepPaused.includes(" NTLMv2 ") || theHCJ.types.includes("NTLMv2")){
    // download the creds from S3
    userDataString +=`
    if [ -f /home/ubuntu/hashwrap.pause ];
    then
        echo "Skipping due to pause"
    else
        aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.NTLMv2.credentials .
        aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.NTLMv2.credentials
    fi
    `
    if(theHCJ.stepPaused.includes("NTLMv2 Dictionary")) {
        userDataString += `       
        sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin --session ${randomVal} --restore &
        while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
        do 
            aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
            if [ -f /home/ubuntu/hashwrap.pause ];
            then
                echo "Pausing NTLMv2 Dictionary Attack" > /home/ubuntu/status.txt
                aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;
            else
                aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
            fi
            sleep 30; 
        done
        rm -f /home/ubuntu/hashcat.status
        `
        }
    if(theHCJ.stepPaused.includes("NTLMv2 Brute") || (crackConfigDetails.bruteLimit !== "0" && crackConfigDetails.bruteLimit !== "")) {
    userDataString += `
    if [ -f /home/ubuntu/hashwrap.pause ];
    then
        echo "Skipping due to pause"
    else`
    if(theHCJ.stepPaused.includes("NTLMv2 Brute")){
        userDataString += `
        sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin --session ${randomVal} --restore &
        `
    } else {
        userDataString += `
        sudo /home/ubuntu/HashWrap/hashwrap 10 /home/ubuntu/hashcat-5.1.0/hashcat64.bin -a 3 -m 5600 --session ${randomVal} /home/ubuntu/${randomVal}.NTLMv2.credentials -o bruteNTLMv2.txt -i ${bruteMask} -O -w 3 &
        `
    }
    userDataString += `
    while [ \\$(ps -ef | grep hashwrap | egrep -v grep | wc -l) -gt "0" ]; 
        do 
            aws s3 cp s3://${awsSettings.bucketName}/${randomVal}.pause /home/ubuntu/hashwrap.pause;
            if [ -f /home/ubuntu/hashwrap.pause ];
            then
                echo "Pausing NTLMv2 Brute Force" > /home/ubuntu/status.txt
                aws s3 cp /home/ubuntu/status.txt s3://${awsSettings.bucketName}/${randomVal}.status;    
            else
                aws s3 cp /home/ubuntu/hashcat.status s3://${awsSettings.bucketName}/${randomVal}.status;
            fi
            sleep 30; 
        done
        rm /home/ubuntu/hashcat.status
    fi
    `
    
    }
}
// Logic for character swap
// #while read line; do echo -n $line | cut -d ':' -f1 | tr -d '\n'; echo -n ":"; echo $line | cut -d':' -f2 | sed -e 's/[A-Z]/U/g' -e's/[a-z]/l/g' -e 's/[0-9]/0/g' -e 's/[[:punct:]]/*/g'; done < ./hashcat-5.1.0/hashcat.potfile
// Logic for Length swap
// #while read line; do echo -n $line | cut -d ':' -f1 | tr -d '\n'; echo -n ":"; echo $line | cut -d':' -f2 | sed -e 's/[A-Z]/*/g' -e's/[a-z]/*/g' -e 's/[0-9]/*/g' -e 's/[[:punct:]]/*/g'; done < ./hashcat-5.1.0/hashcat.potfile
// Logic for Full swap
// #while read line; do echo -n $line | cut -d ':' -f1 | tr -d '\n'; echo -n ":"; echo cracked; done < /tmp/fake.potfile
userDataString += `
sudo chown ubuntu:ubuntu ./hashcat-5.1.0/hashcat.potfile
sudo chown ubuntu:ubuntu ./hashcat-5.1.0/${randomVal}.restore
if [ -f /home/ubuntu/hashwrap.pause ]
then
aws s3 cp /home/ubuntu/hashcat-5.1.0/${randomVal}.restore s3://${awsSettings.bucketName}/${randomVal}.restore
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.pause
aws s3 cp /home/ubuntu/${randomVal}.LM.credentials s3://${awsSettings.bucketName}/${randomVal}.LM.credentials
aws s3 cp /home/ubuntu/${randomVal}.NTLM.credentials s3://${awsSettings.bucketName}/${randomVal}.NTLM.credentials
aws s3 cp /home/ubuntu/${randomVal}.NTLMv2.credentials s3://${awsSettings.bucketName}/${randomVal}.NTLMv2.credentials
aws s3 cp /home/ubuntu/COMBINED-PASS.txt s3://${awsSettings.bucketName}/${randomVal}.COMBINED-PASS.txt
aws s3 cp /home/ubuntu/Hob0Rules/d3adhob0.rule s3://${awsSettings.bucketName}/${randomVal}.d3adhob0.rule
echo "Exfiling Cracked Hashes prior to pause" > ./status.txt
else
echo "Finishing Up..." > ./status.txt
fi
# upload files after cracking
if [ -f ./hashcat-5.1.0/hashcat.potfile ]
then
aws s3 cp ./status.txt s3://${awsSettings.bucketName}/${randomVal}.status
`
if(theHCJ.types.includes("NTLM") || theHCJ.types.includes("LM")){
    // Handle userdata for NTLM/LM
    userDataString += `
sudo chown ubuntu:ubuntu *.txt
cat crackedNTLM.txt bruteNTLM.txt bruteLM.txt > Cracked-LM-NTLM.txt
cat ./Cracked-LM-NTLM.txt | sed -e 's/ /\\[space\\]/g' > ./Cracked-LM-NTLM.txt.nospaces

while read line; do echo -n \\$(echo \\$line | cut -d':' -f1 | tr -d '\\n') >> NTLM-LM.potfile; echo -n \":\" >> NTLM-LM.potfile; hit=\\$(egrep -l \"^\\$(echo \\$line | cut -d':' -f2-)$\" \\$(find ./SecLists/Passwords/ -iname \"*.txt\") | tr '\\n' ','); if [ \"\\$hit\" != \"\" ]; then echo -n \"\\$hit\" >> NTLM-LM.potfile;echo -n \":\" >> NTLM-LM.potfile; echo \"\\$(echo \\$line | cut -d':' -f2-)\" >> NTLM-LM.potfile; else echo -n \":\" >> NTLM-LM.potfile; echo \"\\$(echo \\$line | cut -d':' -f2-)\" >> NTLM-LM.potfile; fi; done < ./Cracked-LM-NTLM.txt.nospaces
    `
    // At this point we have NTLM-LM.potfile with hash:hit1,hit2,hit3:plaintest or hash::plaintext
    // Handle redaction for NTLM/LM
    if(theHCJ.configDetails.redactionValue.redactionCharacter){
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1 | tr -d '\\n' >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo -n \\$line | cut -d':' -f2 >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo \\$line | cut -d':' -f3- | sed -e 's/\\[space\\]/ /g' -e 's/[A-Z]/U/g' -e's/[a-z]/l/g' -e 's/[0-9]/0/g' -e 's/[[:punct:]]/*/g'  >> ./NTLM-LM-FINAL.potfile;   done < ./NTLM-LM.potfile
        `
        } else if(theHCJ.configDetails.redactionValue.redactionLength) {
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1 | tr -d '\\n' >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo -n \\$line | cut -d':' -f2 >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo \\$line | cut -d':' -f3- | sed -e 's/\\[space\\]/ /g' -e 's/[A-Z]/*/g' -e's/[a-z]/*/g' -e 's/[0-9]/*/g' -e 's/[[:punct:]]/*/g'  >> ./NTLM-LM-FINAL.potfile;  done < ./NTLM-LM.potfile
        `
        } else if(theHCJ.configDetails.redactionValue.redactionFull){ 
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1 | tr -d '\\n' >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo -n \\$line | cut -d':' -f2 >> ./NTLM-LM-FINAL.potfile; echo -n \":\" >> ./NTLM-LM-FINAL.potfile; echo cracked >> ./NTLM-LM-FINAL.potfile;  done < ./NTLM-LM.potfile
        `
        } else {
        userDataString +=`
        cp NTLM-LM.potfile NTLM-LM-FINAL.potfile
        `
        }

    // ABSOLUTELY ENSURE WE HAVE A POTFILE TO SEND TO MARK COMPLETION...
    userDataString += `
    if [ -f ./NTLM-LM-FINAL.potfile ]; 
    then 
        sleep 1; 
    else 
        echo emptypotfile > ./NTLM-LM-FINAL.potfile; 
    fi
    `
}
if(theHCJ.types.includes("NTLMv2")){
    // Handle userdata for NTLMv2
    userDataString += `
    sudo chown ubuntu:ubuntu *.txt
    cat crackedNTLMv2.txt bruteNTLMv2.txt > Cracked-NTLMv2.txt
    cat ./Cracked-NTLMv2.txt | sed -e 's/ /\\[space\\]/g' > ./Cracked-NTLMv2.txt.nospaces
    while read line; do echo -n \\$(echo \\$line | cut -d':' -f1-6 | tr -d '\\n') >> NTLMv2.potfile; echo -n \":\" >> NTLMv2.potfile; hit=\\$(egrep -l \"^\\$(echo \\$line | cut -d':' -f7- | tr -d '\\n')$\" \\$(find ./SecLists/Passwords/ -iname \"*.txt\") | tr '\\n' ','); if [ \"\\$hit\" != \"\" ]; then echo -n \"\\$hit\" >> NTLMv2.potfile;echo -n \":\" >> NTLMv2.potfile; echo \"\\$(echo \\$line | cut -d':' -f7- | tr -d '\\n')\" >> NTLMv2.potfile; else echo -n \":\" >> NTLMv2.potfile; echo \"\\$(echo \\$line | cut -d':' -f7- | tr -d '\\n')\" >> NTLMv2.potfile; fi; done < ./Cracked-NTLMv2.txt.nospaces
    `
    // At this point we have NTLM-LM.potfile with hash:hit1,hit2,hit3:plaintest or hash::plaintext
    // Handle redaction for NTLM/LM
    if(theHCJ.configDetails.redactionValue.redactionCharacter){
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1-6 | tr -d '\\n' >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo -n \\$line | cut -d':' -f7 >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo \\$line | cut -d':' -f8- | sed -e 's/\\[space\\]/ /g' -e 's/[A-Z]/U/g' -e's/[a-z]/l/g' -e 's/[0-9]/0/g' -e 's/[[:punct:]]/*/g' >> ./NTLMv2-FINAL.potfile;   done < ./NTLMv2.potfile
        `
        } else if(theHCJ.configDetails.redactionValue.redactionLength) {
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1-6 | tr -d '\\n' >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo -n \\$line | cut -d':' -f7 >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo \\$line | cut -d':' -f8- | sed -e 's/\\[space\\]/ /g' -e 's/[A-Z]/*/g' -e's/[a-z]/*/g' -e 's/[0-9]/*/g' -e 's/[[:punct:]]/*/g'  >> ./NTLMv2-FINAL.potfile;  done < ./NTLMv2.potfile
        `
        } else if(theHCJ.configDetails.redactionValue.redactionFull){ 
        userDataString += `
        while read line; do echo -n \\$line | cut -d ':' -f1-6 | tr -d '\\n' >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo -n \\$line | cut -d':' -f7 >> ./NTLMv2-FINAL.potfile; echo -n \":\" >> ./NTLMv2-FINAL.potfile; echo cracked >> ./NTLMv2-FINAL.potfile;  done < ./NTLMv2.potfile
        `
        } else {
        userDataString +=`
        cp NTLMv2.potfile NTLMv2-FINAL.potfile`
        }
    // ABSOLUTELY ENSURE WE HAVE A POTFILE TO SEND TO MARK COMPLETION...
    userDataString += `
    if [ -f ./NTLMv2-FINAL.potfile ]; 
    then 
        sleep 1; 
    else 
        echo emptypotfile > ./NTLMv2-FINAL.potfile; 
    fi
    `
}

if(theHCJ.types.includes("NTLM")||theHCJ.types.includes("LM")){
    userDataString += `
    aws s3 cp ./NTLM-LM-FINAL.potfile s3://${awsSettings.bucketName}/${randomVal}.hashcat-NTLM-LM.potfile
    `
}
if(theHCJ.types.includes("NTLMv2")){
    userDataString += `
    aws s3 cp ./NTLMv2-FINAL.potfile s3://${awsSettings.bucketName}/${randomVal}.hashcat-NTLMv2.potfile
    `
}

userDataString += `
aws s3 rm s3://${awsSettings.bucketName}/${randomVal}.status
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
              let chosenAZ = data.availabilityZone;
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
                            AvailabilityZone: chosenAZ
                            },
                            UserData: userData, 
                        }, 
                        SpotPrice: `${price}`, 
                        Type: "one-time",
                        // Remove once pause resume finished...
                    };
                    //console.log(params);
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
                                return `${data.id} resumed`
                            }    
                        })
                    })              
              }
              return `${data.id} resumed`
            
                /*
                data = {
                }
                */
            })
            return `${data.id} resumed`
        }
        throw new Meteor.Error(500,'500 Internal Server Error','Error saving HashCrackJob information');

    }
    throw new Meteor.Error(401,'401 Unauthorized','Your account does not appear to have AWS credentials configured')
}

export function pauseCrackJob(fileID){
    let theHCJ = HashCrackJobs.findOne({"_id":fileID})
    // updated for bug where even though the conditions were false it was still executing...
    if((theHCJ.requestedPause || theHCJ.status === "Job Completed" || theHCJ.status === "Job Paused") === true){
        return `${fileID} - This job cannot be paused`
    }
    HashCrackJobs.update({"_id":fileID},{$set:{requestedPause:true}})
    // We have a job that has never been paused or was pause but resumed and is running again... meaning we can pause it
    let creds = AWSCOLLECTION.findOne({type:'creds'})
    if(creds){
        let awsSettings = AWSCOLLECTION.findOne({'type':"settings"})
        if(!awsSettings){
            HashCrackJobs.update({"_id":fileID},{$set:{requestedPause:false}})
            throw new Meteor.Error(500, 'AWS Settings Not Configured','The Application Admin has not run the initial configuration of all AWS resources yet so cracking cannot occur.')
        }
        const AWS = require('aws-sdk');
        AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
        const s3 = new AWS.S3({
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey
        });

        const params = {
            Bucket: `${awsSettings.bucketName}`, // pass your bucket name
            Key: `${theHCJ.uuid}.pause`, 
            Body:"PAUSE THE JOB",
        };
        s3.upload(params, function(s3Err, data) {
            if (s3Err) {
                HashCrackJobs.update({"_id":fileID},{$set:{requestedPause:false}})
                throw s3Err
            }
        });
        HashCrackJobs.update({"_id":fileID},{$set:{status:"Pause Request Submitted"}})

    } else {
        HashCrackJobs.update({"_id":fileID},{$set:{requestedPause:false}})
    }


return `${fileID} - paused`
}

export function deleteCrackJobs(fileIDArray){
    let creds = AWSCOLLECTION.findOne({type:'creds'})
    if(creds){
        const AWS = require('aws-sdk');
        AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
        const s3 = new AWS.S3({
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey
        });
        _.each(fileIDArray, (fileID) => {
            let theHCJ = HashCrackJobs.findOne({"uuid":fileID})
            if(theHCJ.status === 'Job Completed' || theHCJ.status === 'Job Paused' || theHCJ.status.includes("cancelled") || theHCJ.status.includes("Failed")){
                deleteAllFilesWithPrefix(theHCJ.uuid, s3)
                HashCrackJobs.remove({"uuid":fileID})
            }
        })
        return true
    }
}

export function tagInstance(jobID){
    let creds = AWSCOLLECTION.findOne({type:'creds'})
    if(creds){
        let awsSettings = AWSCOLLECTION.findOne({'type':"settings"})
        if(!awsSettings){
            throw new Meteor.Error(500, 'AWS Settings Not Configured','The Application Admin has not run the initial configuration of all AWS resources yet so cracking cannot occur.')
        }
        let job = HashCrackJobs.findOne({"_id":jobID})
        const AWS = require('aws-sdk');
        AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
        AWS.config.update({region: job.availabilityZone.replace(/[a-z]$/g, '')});
        let ec2 = new AWS.EC2()
        var params = {
            Resources: [
                job.spotInstanceRequest.InstanceId
           ], 
           Tags: [
           {
           Key: "Cryptbreaker", 
           Value: "Cryptbreaker"
           }
           ]
           };
           ec2.createTags(params, function(err, data) {
             if (err) console.log(`${err.statusCode},${err.code},${err.message}`); // an error occurred
             else {
                bound(() => { HashCrackJobs.update({"_id":job._id},{$set:{'isTagged':true}})})
             }    
           });
    }
    
}

Meteor.methods({
    async uploadHashData(fileName,fileData) {
        processUpload(fileName, fileData, true, '');
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
            queueCrackJob(data)
            return true
        }
        throw new Meteor.Error(401,'401 Unauthorized','Your account is not authorized to crack hashes/hash files')
    },

    async resumeCrack(data){
        if(Roles.userIsInRole(Meteor.userId(), ['admin','hashes.crack'])){
            resumeCrackJob(data)
            return true
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

    async configurePasswordPolicy(hashFileID, policyDoc){
        try {
            HashFiles.update({"_id":hashFileID},{$set:{"passwordPolicy":policyDoc}})
            // after configuring policy we now need to find all cracked hashes for the hash file and evaluate the meta.plaintextStats
            // of each hash against the policy to find an array of 'violatesPolicy' passwords and store it on the hash file
            let crackedHashes = Hashes.find({$and:[{"meta.source":hashFileID},{'meta.cracked':true}]}).fetch()
            let violations = []

            if(crackedHashes.length > 0){
                _.each(crackedHashes, (hash) => {
                    
                    let textToEvaluate = hash.meta.plaintext
                    if(textToEvaluate.includes('[space]')){
                        textToEvaluate = textToEvaluate.replace(/\[space\]/g," ")
                    }
                    let wasInvalid = false
                    if(policyDoc.hasLengthRequirement === true){
                        if(textToEvaluate.length < policyDoc.lengthRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasUpperRequirement  === true){
                        if((textToEvaluate.match(/[A-Z]/g) || []).length < policyDoc.upperRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasLowerRequirement === true){
                        if((textToEvaluate.match(/[a-z]/g) || []).length < policyDoc.lowerRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasSymbolsRequirement === true){
                        if((textToEvaluate.match(/[-!$%^&*()@_+|~=`{}\[\]:";'<>?,.\/\ ]/g) || []).length < policyDoc.symbolsRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasNumberRequirement === true){
                        if((textToEvaluate.match(/[0-9]/g) || []).length < policyDoc.numberRequirement)
                        {
                            violations.push(hash._id)
                            wasInvalid = true
                        }
                    }
                    if(!wasInvalid && policyDoc.hasUsernameRequirement === true){
                        _.each(hash.meta.username[hashFileID], (username) => {
                            if(!wasInvalid){
                                let accountName = username
                                let domainName = ""
                                if(username.includes("\\")){
                                    let splitVal = username.split("\\")
                                    accountName = splitVal[1]
                                    domainName = splitVal[0]
                                }
                                if(!wasInvalid && domainName !== ""){
                                    if(textToEvaluate.toLowerCase().includes(domainName.toLowerCase())){
                                        violations.push(hash._id)
                                        wasInvalid = true
                                    }
                                }
                                if(!wasInvalid && accountName !== ""){
                                    if(textToEvaluate.toLowerCase().includes(accountName.toLowerCase())){
                                        violations.push(hash._id)
                                        wasInvalid = true
                                    }
                                }
                            }        
                        })
                    }

                })
            }
            HashFiles.update({"_id":hashFileID},{$set:{'policyViolations':violations}})
            // _.each(violations, (hashID) => {
            //     let theHash = Hashes.findOne({"_id":hashID})
            //     if(typeof theHash.meta.violatesPolicy === 'undefined'){
            //         Hashes.update({"_id":hashID},{$set:{'meta.violatesPolicy':[hashFileID]}})
            //     } else {
            //         if(!theHash.meta.violatesPolicy.includes(hashFileID)){
            //             let newViolationsArray = theHash.meta.violatesPolicy.push(hashFileID)
            //             Hashes.update({"_id":hashID},{$set:{'meta.violatesPolicy':newViolationsArray}})
            //         }
            //     }
            // })

        } catch(err){
            throw new Meteor.Error('E1234',err.message);
        }
        return true;
    },

    async deleteHashCrackJobs(fileIDArray){
        if(Roles.userIsInRole(Meteor.userId(),['admin','files.delete'])){
            deleteCrackJobs(fileIDArray)
            return true
        }
        throw new Meteor.Error(401,'401 Unauthorized','Your account is not authorized to delete hashes/hash files')
    },

    async pauseCrack(fileID){
        if(Roles.userIsInRole(Meteor.userId(),['admin','jobs.pause'])){
            let result = pauseCrackJob(fileID)
            if(result.includes("cannot")){
                throw new Meteor.Error(400,'400 Unable to service request','The requested job cannot be paused')
            }
            return true
        }
        throw new Meteor.Error(401,'401 Unauthorized','Your account is not authorized to delete hashes/hash files')
    },
    
});