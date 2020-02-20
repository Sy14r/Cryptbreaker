import { Meteor } from 'meteor/meteor';
import { Hashes, HashFiles, HashCrackJobs } from '/imports/api/hashes/hashes.js';
import { AWSCOLLECTION } from '/imports/api/aws/aws.js';
import { tagInstance } from '/imports/api/hashes/methods.js';
// var AWS = require('aws-sdk');

import _ from 'lodash';

const bound = Meteor.bindEnvironment((callback) => {callback();});

function passwordListsToCategories(listArray) {
    let categoriesMap = {
        commonCredentials: {
            label:"Common Credentials",
            folder:"Common-Credentials",
            files:["xato-net-10-million","darkweb2017-top","richelieu-french-top","twitter-banned","openwall.net-all","clarkson-university","UserPassCombo-Jay"]
        },
        defaultCredentials: {
            label:"Default Credentials",
            folder:"Default-Credentials",
            files:["cirt-default-passwords"]
        }
        ,
        malware: {
            label:"Used by Malware",
            folder:"Malware",
            files:[]
        }
        ,
        crackingTools: {
            label:"Included with Cracking Tool",
            folder:"Software",
            files:[]
        },
        leaksAndBreaches: {
            label:"Located in Leak or Breach",
            folder:"Leaked-Databases",
            files:[]
        },
    }
    let breachesMap = {
        b1:{
            label:"000 Webhost",
            file:"000webhost.txt"
        },
        b2:{
            label:"Ashley Madison",
            file:"Ashley-Madison.txt"
        },
        b3:{
            label:"Lizzard Squad",
            file:"Lizzard-Squad.txt"
        },
        b4:{
            label:"Adobe",
            file:"adobe100.txt"
        },
        b5:{
            label:"Alleged GMail",
            file:"alleged-gmail-passwords.txt"
        },
        b6:{
            label:"Carders CC",
            file:"carders.cc.txt"
        },
        b7:{
            label:"Elite Hacker",
            file:"elitehacker.txt"
        },
        b8:{
            label:"Faith Writers",
            file:"faithwriters.txt"
        },
        b9:{
            label:"Hotmail",
            file:"hotmail.txt"
        },
        b10:{
            label:"MD5 Decrypter",
            file:"md5decryptor"
        },
        b11:{
            label:"MySpace",
            file:"myspace"
        },
        b12:{
            label:"PHP Bulletin Board",
            file:"phpbb"
        },
        b13:{
            label:"Adult Site",
            file:"porn-unknown"
        },
        b14:{
            label:"RockYou",
            file:"rockyou"
        },
        b15:{
            label:"Singles.org",
            file:"singles.org"
        },
        b16:{
            label:"Adult Site",
            file:"youportn2012"
        },
    }
    let categories = []
    let breaches = []
    /*
    "lists" : [
        "./SecLists/Passwords/Leaked-Databases/phpbb-cleaned-up.txt",
        "./SecLists/Passwords/Leaked-Databases/phpbb.txt"            
    ],
    */
    _.each(listArray, (pwList) => {
        // Look and see if each list is in any of the above categories using Object Key, Index iteration
        let splitVal = pwList.split("/")
        // Iterate over each high level category and figure out what categories to add for this array of inputs
        for (let [key, value] of Object.entries(categoriesMap)) {
            // Check if the folder matches...
            if(categoriesMap[key].folder == splitVal[splitVal.length-2]){
                // add if not already there
                if(!categories.includes(categoriesMap[key].label)){
                    categories.push(categoriesMap[key].label)
                }

                // Check if category was Leaked-Databases to also note the breach it occurred in
                if(splitVal[splitVal.length-2] == "Leaked-Databases")
                {
                    for (let [bKey, bValue] of Object.entries(breachesMap)) {
                        // If the filename includes the breach file field then add the label if needed
                        if(splitVal[splitVal.length-1].includes(breachesMap[bKey].file)) {
                            // add if not already there
                            if(!breaches.includes(breachesMap[bKey].label)){
                                breaches.push(breachesMap[bKey].label)
                            }
                        }
                    }
                }
            } 
            else {
                // Else check if the file name matches...
                _.each(categoriesMap[key].files, (fileName) => {
                    if(pwList.includes(fileName)){
                        // add if not already there
                        if(!categories.includes(categoriesMap[key].label)){
                            categories.push(categoriesMap[key].label)
                        }
                    }
                })
            }
            //console.log(`${key}: ${value}`);
          }
        // If the last folder is a category
        // Then look if its one of the known leaks...
    })
    return [categories, breaches]
}

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

function processPotfile(filename, s3Obj, job, type){
    let awsSettings = AWSCOLLECTION.findOne({'type':"settings"})
    let params = {
        Bucket:`${awsSettings.bucketName}`,
        Key: filename
    }
    s3Obj.getObject(params, function(err, data) {
        bound(() =>{
            if (err) console.log(err, err.stack); // an error occurred
            else  {
                let content = data.Body.toString()
                if(type == "NTLM-LM"){
                    let hadLMHash = false
                    //console.log(content)
                    _.each(content.split('\n'), (line)=>{
                        if(line.length >0){
                            let splitVal = line.split(':')
                            let hashVal = splitVal[0]
                            let listsVal = splitVal[1]
                            let plaintextVal = splitVal.slice(2,splitVal.length).join(":")
                            if(typeof plaintextVal !== 'undefined' && plaintextVal.length > 0) {
                                // console.log(splitVal[0])
                                // console.log(splitVal[1])
                                // let hash = Hashes.findOne({'data': regex})
                                // console.log(`${splitVal[0]} - ${hash}`)
                                // gonna have to deal with hashes with dollarsigns...
                                if(hashVal.length === 32) {
                                    // NTLM hash for current support
                                    let regex = new RegExp("^" + hashVal.toLowerCase(), "i") 
                                    // Increment the counter for how many cracked hashes there are for ntlm...
                                    let hash = Hashes.find({"data":regex}).fetch()
                                    let hashPreviouslyCracked = false
                                    if(typeof hash[0].meta !== 'undefined' && typeof hash[0].meta.cracked !== 'undefined' && hash[0].meta.cracked === true) {
                                        hashPreviouslyCracked = true
                                    }
                                    //console.log(`RAW LINE: ${JSON.stringify(splitVal)}`)
                                    let update
                                    let textToEvaluate = plaintextVal
                                    if(plaintextVal.includes('[space]')){
                                        textToEvaluate = plaintextVal.replace(/\[space\]/g," ")
                                    }
                                    let plaintextStats = {
                                        length: textToEvaluate.length,
                                        upperCount: (textToEvaluate.match(/[A-Z]/g) || []).length,
                                        lowerCount: (textToEvaluate.match(/[a-z]/g) || []).length,
                                        numberCount: (textToEvaluate.match(/[0-9]/g) || []).length,
                                        symbolCount: (textToEvaluate.match(/[-!$%^&*()@_+|~=`{}\[\]:";'<>?,.\/\ ]/g) || []).length,
                                    }
                                    if(listsVal.length > 0){
                                        foundLists = listsVal.replace(/,$/,"").split(",")
                                        let categorizedFindings = passwordListsToCategories(foundLists)
                                        update = Hashes.update({"data":regex},{$set:{'meta.plaintext':`${plaintextVal}`,'meta.cracked':true,'meta.plaintextStats':plaintextStats,'meta.lists':foundLists,'meta.listCategories':categorizedFindings[0],'meta.breachesObserved':categorizedFindings[1]}})
                                    } else {
                                        update = Hashes.update({"data":regex},{$set:{'meta.plaintext':`${plaintextVal}`,'meta.cracked':true,'meta.plaintextStats':plaintextStats}})
                                    }
                                    if(!update){
                                        throw new Meteor.Error(500,"500 Internal Server Error","Unable to update plaintext in processPotfile function")
                                    }   
                                    // console.log("HASH CRACKED NTLM")
                                    if(!hashPreviouslyCracked){
                                        _.each(hash[0].meta.source, (source) => {
                                            let hashFile = HashFiles.find({"_id":source}).fetch()
                                            // console.log(hashFile)
                                            let newCount = hashFile[0].crackCount + 1
                                            HashFiles.update({"_id":hashFile[0]._id},{$set:{'crackCount':newCount}})
                                        })
                                    }                            
                                } else if(hashVal.length === 16) {
                                    hadLMHash = true
                                    // LM hash for current support -- NEED TO ADD LOGIC FOR LM HASHES AND PASSWORD LISTS...
                                    let regexFirst = new RegExp("^" + hashVal.toLowerCase(), "i") 
                                    let regexLast = new RegExp(hashVal.toLowerCase()+"$", "i") 
                                    let hash = Hashes.find({"data":regexFirst}).fetch()
                                    let hash2 = Hashes.find({"data":regexLast}).fetch()
                                    let hashCracked = false
                                    if(hash.length > 0) {
                                        _.each(hash, (theHash) => {
                                            let currPlain = ''
                                            let plaintextStats = {}
                                            if(typeof theHash.meta.plaintext !== 'undefined'){
                                                currPlain = theHash.meta.plaintext
                                                hashCracked = true
                                                let textToEvaluate = plaintextVal+currPlain
                                                if(textToEvaluate.includes('[space]')){
                                                    textToEvaluate = textToEvaluate.replace(/\[space\]/g," ")
                                                }
                                                plaintextStats = {
                                                    length: textToEvaluate.length,
                                                    upperCount: (textToEvaluate.match(/[A-Z]/g) || []).length,
                                                    lowerCount: (textToEvaluate.match(/[a-z]/g) || []).length,
                                                    numberCount: (textToEvaluate.match(/[0-9]/g) || []).length,
                                                    symbolCount: (textToEvaluate.match(/[-!$%^&*()@_+|~=`{}\[\]:";'<>?,.\/\ ]/g) || []).length,
                                                }
                                            }
                                            let update = Hashes.update({"_id":theHash._id},{$set:{'meta.plaintext':`${plaintextVal+currPlain}`}})
                                            if(!update){
                                                throw new Meteor.Error(500,"500 Internal Server Error","Unable to update plaintext in processPotfile function")
                                            } 
                                            if(hashCracked) {
                                                // console.log("HASH CRACKED LM")
                                                Hashes.update({"_id":theHash._id},{$set:{'meta.cracked':true,'meta.plaintextStats':plaintextStats}})
                                                _.each(theHash.meta.source, (source) => {
                                                    let hashFile = HashFiles.find({"_id":source}).fetch()
                                                    // console.log(hashFile)
                                                    let newCount = hashFile[0].crackCount + 1
                                                    HashFiles.update({"_id":hashFile[0]._id},{$set:{'crackCount':newCount}})
                                                })
                                            }
                                        })
                                        
                                    } else if(hash2.length > 0){
                                        _.each(hash2, (theHash) => {
                                            let plaintextStats = {}
                                            let currPlain = ''
                                            if(typeof theHash.meta.plaintext !== 'undefined'){
                                                currPlain = theHash.meta.plaintext
                                                hashCracked = true
                                                let textToEvaluate = currPlain+plaintextVal
                                                if(textToEvaluate.includes('[space]')){
                                                    textToEvaluate = textToEvaluate.replace(/\[space\]/g," ")
                                                }
                                                plaintextStats = {
                                                    length: textToEvaluate.length,
                                                    upperCount: (textToEvaluate.match(/[A-Z]/g) || []).length,
                                                    lowerCount: (textToEvaluate.match(/[a-z]/g) || []).length,
                                                    numberCount: (textToEvaluate.match(/[0-9]/g) || []).length,
                                                    symbolCount: (textToEvaluate.match(/[-!$%^&*()@_+|~=`{}\[\]:";'<>?,.\/\ ]/g) || []).length,
                                                }
                                            }
                                            let update = Hashes.update({"_id":theHash._id},{$set:{'meta.plaintext':`${currPlain+plaintextVal}`}})
                                            if(!update){
                                                throw new Meteor.Error(500,"500 Internal Server Error","Unable to update plaintext in processPotfile function")
                                            }    
                                            if(hashCracked) {
                                                // console.log("HASH CRACKED LM")
                                                Hashes.update({"_id":theHash._id},{$set:{'meta.cracked':true,'meta.plaintextStats':plaintextStats}})
                                                _.each(theHash.meta.source, (source) => {
                                                    let hashFile = HashFiles.find({"_id":source}).fetch()
                                                    // console.log(hashFile)
                                                    let newCount = hashFile[0].crackCount + 1
                                                    HashFiles.update({"_id":hashFile[0]._id},{$set:{'crackCount':newCount}})
                                                })
                                            }
                                        })
                                    }                              
    
                                }
                            }
                            
                        }  
                    })
                    // After all of the hash processing, if we had an LM hash then we also need to look for the edge case of the blank hash
                    if(hadLMHash){
                        let hashVal = 'aad3b435b51404ee'
                        // LM hash for current support
                        let regexLast = new RegExp(hashVal+"$", "i") 
                        let hash2 = Hashes.find({"data":regexLast}).fetch()
                        let hashCracked = false
                        if(hash2.length > 0){
                            _.each(hash2, (theHash) => {
                                let plaintextStats = {}
                                let currPlain = ''
                                if(typeof theHash.meta.plaintext !== 'undefined'){
                                    currPlain = theHash.meta.plaintext
                                    hashCracked = true
                                    let textToEvaluate = currPlain
                                    if(currPlain.includes('[space]')){
                                        textToEvaluate = textToEvaluate.replace(/\[space\]/g," ")
                                    }
                                    plaintextStats = {
                                        length: textToEvaluate.length,
                                        upperCount: (textToEvaluate.match(/[A-Z]/g) || []).length,
                                        lowerCount: (textToEvaluate.match(/[a-z]/g) || []).length,
                                        numberCount: (textToEvaluate.match(/[0-9]/g) || []).length,
                                        symbolCount: (textToEvaluate.match(/[-!$%^&*()@_+|~=`{}\[\]:";'<>?,.\/\ ]/g) || []).length,
                                    }
                                    
                                }
                                let update = Hashes.update({"_id":theHash._id},{$set:{'meta.plaintext':`${currPlain}`}})
                                if(!update){
                                    throw new Meteor.Error(500,"500 Internal Server Error","Unable to update plaintext in processPotfile function")
                                }    
                                if(hashCracked) {
                                    // console.log("HASH CRACKED LM")
                                    Hashes.update({"_id":theHash._id},{$set:{'meta.cracked':true,'meta.plaintextStats':plaintextStats}})
                                    _.each(theHash.meta.source, (source) => {
                                        let hashFile = HashFiles.find({"_id":source}).fetch()
                                        // console.log(hashFile)
                                        let newCount = hashFile[0].crackCount + 1
                                        HashFiles.update({"_id":hashFile[0]._id},{$set:{'crackCount':newCount}})
                                    })
                                }
                            })
                        }  
                        
                    }
                }
                if(type == "NTLMv2"){
                    _.each(content.split('\n'), (line)=>{
                        if(line.length >0){
                            let splitVal = line.split(':')
                            let hashVal = splitVal.slice(0,6).join(":")
                            let listsVal = splitVal[6]
                            let plaintextVal = splitVal.slice(7,splitVal.length).join(":")
                            if(typeof plaintextVal !== 'undefined' && plaintextVal.length > 0) {
                                // WE KNOW THIS IS NTLMv2 NO NEED TO CHECK HASH TYPES
                                // NTLM hash for current support
                                let regex = new RegExp("^" + hashVal.toLowerCase(), "i") 
                                // Increment the counter for how many cracked hashes there are for ntlm...
                                let hash = Hashes.find({"data":regex}).fetch()
                                let hashPreviouslyCracked = false
                                if(typeof hash[0].meta !== 'undefined' && typeof hash[0].meta.cracked !== 'undefined' && hash[0].meta.cracked === true) {
                                    hashPreviouslyCracked = true
                                }
                                //console.log(`RAW LINE: ${JSON.stringify(splitVal)}`)
                                let update
                                let textToEvaluate = plaintextVal
                                if(plaintextVal.includes('[space]')){
                                    textToEvaluate = plaintextVal.replace(/\[space\]/g," ")
                                }
                                let plaintextStats = {
                                    length: textToEvaluate.length,
                                    upperCount: (textToEvaluate.match(/[A-Z]/g) || []).length,
                                    lowerCount: (textToEvaluate.match(/[a-z]/g) || []).length,
                                    numberCount: (textToEvaluate.match(/[0-9]/g) || []).length,
                                    symbolCount: (textToEvaluate.match(/[-!$%^&*()@_+|~=`{}\[\]:";'<>?,.\/\ ]/g) || []).length,
                                }
                                if(listsVal.length > 0){
                                    foundLists = listsVal.replace(/,$/,"").split(",")
                                    let categorizedFindings = passwordListsToCategories(foundLists)
                                    update = Hashes.update({"data":regex},{$set:{'meta.plaintext':`${plaintextVal}`,'meta.cracked':true,'meta.plaintextStats':plaintextStats,'meta.lists':foundLists,'meta.listCategories':categorizedFindings[0],'meta.breachesObserved':categorizedFindings[1]}})
                                } else {
                                    update = Hashes.update({"data":regex},{$set:{'meta.plaintext':`${plaintextVal}`,'meta.cracked':true,'meta.plaintextStats':plaintextStats}})
                                }
                                if(!update){
                                    throw new Meteor.Error(500,"500 Internal Server Error","Unable to update plaintext in processPotfile function")
                                }   
                                // console.log("HASH CRACKED NTLM")
                                if(!hashPreviouslyCracked){
                                    _.each(hash[0].meta.source, (source) => {
                                        let hashFile = HashFiles.find({"_id":source}).fetch()
                                        // console.log(hashFile)
                                        let newCount = hashFile[0].crackCount + 1
                                        HashFiles.update({"_id":hashFile[0]._id},{$set:{'crackCount':newCount}})
                                    })
                                }                             
                            }
                            
                        }  
                    })
                }


                // Once we've updated all the plaintext we can delete the S3 object
                s3Obj.deleteObject(params, function(err, data) {
                    if (err) console.log(err, err.stack); // an error occurred
                    else {
                        bound(() => {
                            if(typeof job.requestedPause !== 'undefined' && job.requestedPause === true){
                                HashCrackJobs.update({"_id":job._id},{$set:{'status':'Job Paused'}})

                            } else {
                                HashCrackJobs.update({"_id":job._id},{$set:{'status':'Job Completed'}})
                            }
                        })
                    }   
                  });  
                  
                // calculate detailed stats for the hashFile -- NEED TO ADD STATS FOR PASSWORD FILE SOURCE STATS
                // number of passwords that were on a list >> db.hashes.aggregate([{$match:{$and:[{'meta.source':'AReXEyro2dNNQRGoW'},{'meta.cracked':true},{'meta.listCategories':{$exists:true}}]}}])
                // number of passwords that were not on a list >> db.hashes.aggregate([{$match:{$and:[{'meta.source':'AReXEyro2dNNQRGoW'},{'meta.listCategories':{$exists:false}}]}}])

                _.each(job.sources, (source) => {
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
                    bound(() =>{
                        HashFiles.update({"_id":`${source}`},{$set:{'categoriesStats':categoriesStats,'breachListStats':breachListStats}})
                        let $match = {$and:[{'meta.cracked':true},{'meta.source':`${source}`}]};
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
                                HashFiles.update({"_id":`${source}`},{$set:{'passwordLengthStats':stats}})
                            })().then(() => {
                                // Calcualte reuse stats
                                let hashFileUsersKey = `$meta.username.${source}`
                                let plaintextFilter = "$meta.plaintext"
                                $match = {$and: [{'meta.source':source},{'meta.cracked':true}]};
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
                                        HashFiles.update({"_id":`${source}`},{$set:{'passwordReuseStatsCracked':stats}})
                                    })();
                                } catch (err) {
                                    throw new Meteor.Error('E1235',err.message);
                                }
                            });
                        
                        } catch (err) {
                        throw new Meteor.Error('E1234', err.message);
                        }
                    })
                    // Calculate the stats for each category...
                    for (let [key, value] of Object.entries(categoriesStats)) {
                        bound(() =>{
                            let $match = {$and:[{'meta.cracked':true},{'meta.source':`${source}`},{'meta.listCategories':`${categoriesStats[key].label}`}]};
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
                                if(typeof stats[0] !== 'undefined' && typeof stats[0].data !== 'undefined'){
                                    let updateKey = `categoriesStats.${key}.count`
                                    HashFiles.update({"_id":`${source}`},{$set:{[updateKey]:stats[0].data}})
                                }
                                //console.log(stats[0].data);
                            })();
                        } catch (err) {
                            throw new Meteor.Error('E2345', err.message);
                            }
                        })
                    }
                    // Calculate the stats for each breachList...
                    for (let [key, value] of Object.entries(breachListStats)) {
                        bound(() =>{
                            let $match = {$and:[{'meta.cracked':true},{'meta.source':`${source}`},{'meta.breachesObserved':`${breachListStats[key].label}`}]};
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
                                if(typeof stats[0] !== 'undefined' && typeof stats[0].data !== 'undefined'){
                                    let updateKey = `breachListStats.${key}.count`
                                    HashFiles.update({"_id":`${source}`},{$set:{[updateKey]:stats[0].data}})    
                                }
                                //console.log(stats[0].data);
                            })();
                        } catch (err) {
                            throw new Meteor.Error('E3456', err.message);
                            }
                        })
                    }
                    // Update password policy violations as necessary
                    let hashFile = HashFiles.findOne({"_id":source})
                    if(typeof hashFile.passwordPolicy !== 'undefined'){
                        let policyDoc = hashFile.passwordPolicy
                        let violations = []
                        let crackedHashes = Hashes.find({$and:[{"meta.source":source},{'meta.cracked':true}]}).fetch()
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
                        HashFiles.update({"_id":source},{$set:{'policyViolations':violations}})
                    }
                })
                
                return true
            }
        })
        //  console.log(data);           // successful response
    });
}

function updateJobFromStatus(filename, s3Obj, job){
    let awsSettings = AWSCOLLECTION.findOne({'type':"settings"})
    let params = {
        Bucket: `${awsSettings.bucketName}`,
        Key: filename
    }
    s3Obj.getObject(params, function(err, data) {
        bound(() =>{
            if (err) console.log(err, err.stack); // an error occurred
            else  {
                let content = data.Body.toString()
                //console.log(content.split("\n"))
                let status = ""
                let hashType = ""
                let crackType = ""
                let crackStatus = ""
                let timeEstimatedRemaining = ""
                if(content.startsWith("Session")){
                    //console.log("Session data")
                    const splitSessData = content.split(("\n"))
                    //let content = ""
                    _.forEach(splitSessData, (line) => {
                        if(line.trim().startsWith("Hash.Type")){
                            hashType = line.trim().split(":")[1]
                        }
                        if(line.trim().startsWith("Guess.Mask")){
                            crackType = "Brute Force"
                        }
                        if(crackType == "Brute Force" && line.trim().startsWith("Guess.Queue")){
                            crackStatus = line.trim().split(":")[1].split(" ")[1]
                        }
                        if(line.trim().startsWith("Guess.Base")){
                            crackType = "Dictionary Attack"
                        }
                        if(crackType == "Dictionary Attack" && line.trim().startsWith("Progress")){
                            crackStatus = line.trim().split("(")[1].split(")")[0]
                        }
                        if(line.trim().startsWith("Time.Estimated")){
                            timeEstimatedRemaining = line.trim().split("(")[1].split(")")[0]
                        }
                        if(line.trim().startsWith("Status")){
                            status = line.trim().split(" ")[1]
                        }
                    })
                    content = `${hashType} ${crackType} (${crackStatus}) - ${timeEstimatedRemaining} remaining`
                    //console.log(content)
                } 
                // else {
                    //console.log("NOT SESSION DATA")
                // }
                if(typeof job.requestedPause !== 'undefined' && job.requestedPause === true && content.startsWith("Pausing")){
                    let update = HashCrackJobs.update({"_id":job._id},{$set:{'status':`${content}`,'stepPaused':`${content}`}})
                    if(!update){
                        throw new Meteor.Error(500,"500 Internal Server Error","Unable to update status of job in updateJobFromStatus function")
                    }  
                } else {
                    let update = HashCrackJobs.update({"_id":job._id},{$set:{'status':`${content}`}})
                    if(!update){
                        throw new Meteor.Error(500,"500 Internal Server Error","Unable to update status of job in updateJobFromStatus function")
                    }  
                }
                          
                return true
            }
        })
        //  console.log(data);           // successful response
    });
}

function checkForCrackResults() {
    let creds = AWSCOLLECTION.findOne({type:'creds'})
    if(creds){
        const AWS = require('aws-sdk');
        AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
        const s3 = new AWS.S3({
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey
        });
        let awsSettings = AWSCOLLECTION.findOne({'type':'settings'})

        // For each of the submittedNotComplete check to see if the potfile exists for the correcponding UUID
        let submittedNotComplete = HashCrackJobs.find({$and:[{'status':{$not:/^Job Complete/}},{'status':{$not:/^Job Failed/}},{'status':{$not:/^Job Pause/}}]}).fetch()
        let params = {}
        _.each(submittedNotComplete, (job) => {
            // First check if the last spotRequest status was 
            if(job.spotInstanceRequest.Status.Code === "pending-evaluation"){
                // console.log("Need to check spot status")
                // need to get current spot request status...
                var params = {
                    SpotInstanceRequestIds: [
                       job.spotInstanceRequest.SpotInstanceRequestId
                    ]
                };
                AWS.config.update({region: job.availabilityZone.replace(/[a-z]$/g, '')});
                let ec2 = new AWS.EC2()
                ec2.describeSpotInstanceRequests(params, function(err, data) {
                    bound(() => {
                        if (err) console.log(err, err.stack); // an error occurred
                        else  {
                            let update = HashCrackJobs.update({"_id":job._id},{$set:{'spotInstanceRequest':data.SpotInstanceRequests[0]}})
                            //console.log(data);           // successful response
                        }  
                    })
                })
            } else if(job.spotInstanceRequest.Status.Code === "capacity-not-available" && job.status !== "cancelled"){
                // Want to update that capacity was unavailable for the particular region in our AWSSTORAGE and filter that out on the next request intelligently...
                let alreadyNoted = AWSCOLLECTION.find({'type':'availabilityNote','data':job.availabilityZone}).fetch()
                if(alreadyNoted.length > 0){
                    AWSCOLLECTION.update({'type':'availabilityNote','data':{az:job.availabilityZone,type:job.instanceType}},{$set:{'date':new Date()}})
                } else {
                    AWSCOLLECTION.insert({'type':'availabilityNote','data':{az:job.availabilityZone,type:job.instanceType},'date':new Date()})
                }
                // console.log("Need to check spot status")
                // need to get current spot request status...
                var params = {
                    SpotInstanceRequestIds: [
                       job.spotInstanceRequest.SpotInstanceRequestId
                    ]
                };
                AWS.config.update({region: job.availabilityZone.replace(/[a-z]$/g, '')});
                let ec2 = new AWS.EC2()
                ec2.cancelSpotInstanceRequests(params, function(err, data) {
                    bound(() => {
                        if (err) console.log(err, err.stack); // an error occurred
                        else  {
                            console.log(data)
                            deleteAllFilesWithPrefix(job.uuid, s3)
                            let update = HashCrackJobs.update({"_id":job._id},{$set:{'status':data.CancelledSpotInstanceRequests[0].State}})
                            //console.log(data);           // successful response
                        }  
                    })
                })
            }else {
                // console.log("Instance running, need to check S3")
                // now to tag the instance...
 
                //believe this is the place to tag resources....
                if(typeof job.isTagged === 'undefined'){
                    tagInstance(job._id)
                }                
                
                var params = {
                    Bucket: `${awsSettings.bucketName}`, 
                    Prefix: `${job.uuid}`
                };
                s3.listObjects(params, function(err, data) {
                    bound(() => {
                        if (err) console.log(err, err.stack); // an error occurred
                        else {
                            let NTLMLMPotfile = ''
                            let NTLMv2Potfile = ''
                            let status = ''            
                            _.each(data.Contents, (result) => {
                                // console.log(result)
                                if(result.Key.includes("potfile")){
                                    // We have the NTLM-LM potfile...
                                    // console.log("We have potfile...")
                                    if(result.Key.includes("NTLM-LM")){
                                        NTLMLMPotfile = result.Key
                                    }
                                    if(result.Key.includes("NTLMv2")){
                                        NTLMv2Potfile = result.Key
                                    }
                                    
                                }
                                if(result.Key.includes("status")){
                                    // We have a status update...
                                    // console.log("We have status...")
                                    status = result.Key
                                }                                 
                            })
                            // console.log(`Check: status ${status} potfile: ${potfile}`)
                            if(NTLMLMPotfile !== ''){
                                // console.log('process potfile')
                                processPotfile(NTLMLMPotfile, s3, job, "NTLM-LM")
                                HashCrackJobs.update({"_id":job._id},{$set:{'status':'Cracking Complete'}})    
                            } else if(NTLMv2Potfile !== ''){
                                // console.log('process potfile')
                                processPotfile(NTLMv2Potfile, s3, job, "NTLMv2")
                                HashCrackJobs.update({"_id":job._id},{$set:{'status':'Cracking Complete'}})    
                            }else if(status !== ''){
                                // console.log(`process status - ${status}`)
                                updateJobFromStatus(status, s3, job)
                            }
            
                        }   
                    })
                })
            }
            
        });
        // console.log("Checking for crack results")
        return true
    }
}

export {
    checkForCrackResults
}