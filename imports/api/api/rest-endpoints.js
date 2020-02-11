import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { APICollection } from './api.js';
import { AWSCOLLECTION } from '/imports/api/aws/aws.js';
import { Hashes, HashFiles, HashCrackJobs, HashFileUploadJobs } from '/imports/api/hashes/hashes.js';
import _ from 'lodash';


JsonRoutes.Middleware.use((req, res, next) => {
    if(req.headers && req.headers.apikey){
        var apiKey = APICollection.findOne({'secret':req.headers.apikey})
        // if this isn't a valid user then return an unauthorized error
        if(typeof apiKey ==='undefined'){
            JsonRoutes.sendResult(res, {
                code: 401
            })
        }
        // if the user is authorized, add the userID to the req and continue processing
        else {
            req.userID = apiKey.userID
            let splitURL = req.url.split("?")
            let urlParams = {}
            let caseSensitiveParams = ["name"]
            if(splitURL.length > 1){
                _.each(splitURL[1].split("&"), (param) => {
                    if(!param.match(/[${}:"]/g)){
                        let splitParam = param.split("=")
                        if(splitParam.length > 1){
                            let paramKey = splitParam[0].toLowerCase()
                            let paramValue = splitParam[1]
                            if(!caseSensitiveParams.includes(paramKey)){
                                paramValue = paramValue.toLowerCase()
                            }
                            urlParams[paramKey] = paramValue
                        }
                    }
                })
            }
            req.urlParams = urlParams
            next()
        }
    }
    else {
        next()
    }

})

JsonRoutes.add("GET","/api/files", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`HashFiles listed at ${new Date()}`}})
    let options = {}
    if(typeof req.urlParams.name === 'string'){
        options["name"] = req.urlParams.name
        console.log(options)
    }
    JsonRoutes.sendResult(res, {
        data:{hashFiles:HashFiles.find(options,{fields:{'_id':1,'name':1,'hashCount':1,'crackCount':1,'distinctCount':1}}).fetch()}
    })
})

JsonRoutes.add("GET","/api/files/:fileID", (req,res,next) => {
    if(!req.params.fileID.match(/[${}:"]/g)){
        APICollection.update({"secret":req.headers.apikey},{$set:{'status':`HashFile ${req.params.fileID} accessed at ${new Date()}`}})
        JsonRoutes.sendResult(res, {
            data:HashFiles.findOne({'_id':req.params.fileID})
        })
    }
})

JsonRoutes.add("GET","/api/jobs", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Crack Jobs listed at ${new Date()}`}})
    JsonRoutes.sendResult(res, {
        data:{crackJobs:HashCrackJobs.find({},{fields:{'_id':1,'uuid':1,'status':1}}).fetch()}
    })
})

JsonRoutes.add("GET","/api/jobs/:jobID", (req,res,next) => {
    if(!req.params.jobID.match(/[${}:"]/g)){
        APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Crack Jobs ${req.params.jobID} accessed at ${new Date()}`}})
        JsonRoutes.sendResult(res, {
            data:HashCrackJobs.findOne({'_id':req.params.jobID},{fields:{'spotInstanceRequest':0}})
        })
    }
})

JsonRoutes.add("GET","/api/jobs/:jobID/status", (req,res,next) => {
    if(!req.params.jobID.match(/[${}:"]/g)){
        APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Crack Job ${req.params.jobID} status checked at ${new Date()}`}})
        JsonRoutes.sendResult(res, {
            data:HashCrackJobs.findOne({'_id':req.params.jobID},{fields:{'status':1}})
        })
    }
})

JsonRoutes.add("GET","/api/pricing/refresh", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`AWS pricing refreshed at ${new Date()}`}})
    Meteor.call('getSpotPricing')
    JsonRoutes.sendResult(res, {
        data:"Pricing Refreshed"
    })
})

JsonRoutes.add("GET","/api/pricing", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`AWS pricing retrieved at ${new Date()}`}})
    let pricing = AWSCOLLECTION.findOne({type:'pricing'})
    JsonRoutes.sendResult(res, {
        data:pricing.data
    })
})

//Add url parameters for filters? (at least cracked/uncracked)
JsonRoutes.add("GET","/api/files/:fileID/hashes", (req,res,next) => {
    if(!req.params.fileID.match(/[${}:"]/g)){
        APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Hashes retrieved for ${req.params.fileID} at ${new Date()}`}})
        let urlParams = req.urlParams
        let hashesToRet =  []
        if(urlParams.cracked === 'true'){
            hashesToRet = Hashes.find({"meta.source":req.params.fileID,'meta.cracked':true},{fields:{'data':1,'meta.type':1,'meta.plaintext':1,'meta.cracked':1}}).fetch();
        } else if(urlParams.cracked === 'false'){
            hashesToRet = Hashes.find({"meta.source":req.params.fileID,'meta.cracked':{$exists: false}},{fields:{'data':1,'meta.type':1}}).fetch();
        } else {
            hashesToRet = Hashes.find({"meta.source":req.params.fileID},{fields:{'data':1,'meta.type':1,'meta.plaintext':1,'meta.cracked':1}}).fetch();
        }
        JsonRoutes.sendResult(res, {
            data:hashesToRet
        })
    }
})

//Add url parameters for filters? (at least cracked/uncracked)
JsonRoutes.add("GET","/api/jobs/:jobID/hashes", (req,res,next) => {
    if(!req.params.jobID.match(/[${}:"]/g)){
        APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Hashes retrieved for ${req.params.jobID} at ${new Date()}`}})
        let urlParams = req.urlParams
        let hashesToRet =  []
        let hcj = HashCrackJobs.findOne({'_id':req.params.jobID})
        if(urlParams.cracked === 'true'){
            hashesToRet = Hashes.find({"meta.source":{$in: hcj.sources},'meta.cracked':true},{fields:{'data':1,'meta.type':1,'meta.plaintext':1,'meta.cracked':1}}).fetch();
        } else if(urlParams.cracked === 'false'){
            hashesToRet = Hashes.find({"meta.source":{$in: hcj.sources},'meta.cracked':{$exists: false}},{fields:{'data':1,'meta.type':1}}).fetch();
        } else {
            hashesToRet = Hashes.find({"meta.source":{$in: hcj.sources}},{fields:{'data':1,'meta.type':1,'meta.plaintext':1,'meta.cracked':1}}).fetch();
        }
        JsonRoutes.sendResult(res, {
            data:hashesToRet
        })
    }
})

//Add url parameters for filters? (at least cracked, type, hash)
JsonRoutes.add("GET","/api/hashes", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Hashes retrieved at ${new Date()}`}})
    let urlParams = req.urlParams
    let hashesToRet =  []
    let searchOptions = {}

    if(urlParams.cracked === 'true'){
        searchOptions['meta.cracked'] = true
    } else if(urlParams.cracked === 'false'){
        searchOptions['meta.cracked'] = {$exists: false}
    } 

    if(typeof urlParams.type !== 'undefined'){
        searchOptions['meta.type'] = urlParams.type.toUpperCase()
    }

    if(typeof urlParams.hash !== 'undefined'){
        searchOptions['data'] = urlParams.hash.toUpperCase()
    }

    hashesToRet = Hashes.find(searchOptions,{fields:{'data':1,'meta.type':1,'meta.plaintext':1,'meta.cracked':1}}).fetch();
    JsonRoutes.sendResult(res, {
        data:hashesToRet
    })
})

JsonRoutes.add("POST","/api/hashes/check", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Hashes checked at ${new Date()}`}})
    let hashesToCheck = []
    _.each(req.body.hashes, (hash) => {
        if(typeof hash === 'string' && !hash.match(/[${}:"]/g)){
            hashesToCheck.push(hash)
        }
    })
    hashesToRet = Hashes.find({'data':{$in: hashesToCheck}},{fields:{'data':1,'meta.type':1,'meta.plaintext':1,'meta.cracked':1}}).fetch();
    JsonRoutes.sendResult(res, {
        data:hashesToRet
    })
})

JsonRoutes.add("POST","/api/hashes/", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Hashes uploaded at ${new Date()}`}})
    let hashesToAdd = []
    let supportedTypes = ["ntlm","lm"]
    _.each(req.body.hashes, (hash) => {
        let hashToAdd = {}
        if(typeof hash === 'object'){
            if(typeof hash.data === 'string' && !hash.data.match(/[${}:"]/g)){
                hashToAdd['data'] = hash.data.toUpperCase()
            }
            if(typeof hash.type === 'string' && supportedTypes.includes(hash.type.toLowerCase())){
                hashToAdd['type'] = hash.type.toUpperCase()
            }
            if(typeof hash.username === 'string' && !hash.username.match(/[${}:"]/g)){
                hashToAdd['username'] = hash.username
            }
            hashesToAdd.push(hashToAdd)
        }
    })
    
    if(hashesToAdd.length > 0){
        // Generating 'file' from raw data to reuse existing logic...
        let hashesAsPWDUMP = []
        _.each(hashesToAdd, (hashObj) => {
            let currLine = ""
            currLine += hashObj.username ? `${hashObj.username}::` : "::"
            currLine += hashObj.type === 'LM' ? `${hashObj.data}:` : ":"
            currLine += hashObj.type === 'NTLM' ? `${hashObj.data}` : ""
            currLine += ":::"
            hashesAsPWDUMP.push(currLine)
        })
        let buff = new Buffer(hashesAsPWDUMP.join("\n"))
        const uuidv4 = require('uuid/v4');
        let randomVal = uuidv4();
        let newDate = new Date()
        let fileName = `${newDate.getFullYear()}${newDate.getMonth()+1}${newDate.getDay()}-${randomVal.split("-")[0]}.api`
        let fileData = `garbage,${buff.toString('base64')}`
        // use existing upload feature to upload as file....
        try {
            Meteor.call('uploadHashData',fileName,fileData)
        } catch {
            JsonRoutes.sendResult(res, {
                code: 500,
                data:"Error uploading provided hashes"
            })
        }
        JsonRoutes.sendResult(res, {
            data:{
                status:"success",
                fileName:fileName
            }
        })

    } else {
        JsonRoutes.sendResult(res, {
            code: 400,
            data:{
                message:"Invalid hashes provide. Please provide in the following format",
                hashes:[ { "data":"HASHVALUE <- Required", "type":"Hash Type (ntlm or lm) <- Required", "username":"Username <- Optional"} ]
            }
        })
    }

})

JsonRoutes.add("POST","/api/files/", (req,res,next) => {
    if(typeof req.body.fileName === 'string' && !req.body.fileName.match(/[${}:"]/g) && typeof req.body.fileData === 'string'){
        try {
            Meteor.call('uploadHashData',req.body.fileName,`garbage,${req.body.fileData}`)
        } catch {
            JsonRoutes.sendResult(res, {
                code: 500,
                data:"Error uploading provided hashes"
            })
        }
        APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Hash File uploaded at ${new Date()}`}})
        JsonRoutes.sendResult(res, {
            data:{
                status:"success",
                fileName:req.body.fileName
            }
        })

    } else {
        JsonRoutes.sendResult(res, {
            code:400,
            data:{
                message:"Invalid hashes provide. Please provide in the following format",
                sampleFormat:{
                    "fileName": "Filename.txt (Required)",
                    "fileData": "Base64 encoded filedata (Required)"
                }
            }
        })
    }

})

JsonRoutes.add("POST","/api/jobs/", (req,res,next) => {
    let isValidRequest = true
    let validInstanceTypes = ["p3_2xl","p3_8xl","p3_16xl","p3dn_24xl"]
    let validIds = []
    let allIds = HashFiles.find({},{fields:{"_id":1}}).fetch()
    _.each(allIds, (id) => {
        validIds.push(id._id)
    })
    _.each(req.body.ids, (id) => {
        if(!validIds.includes(id)){
            validRequest = false
        }
    })
    // initial validation of quick types
    if(!validInstanceTypes.includes(req.body.instanceType) || typeof req.body.availabilityZone !== 'string' || req.body.availabilityZone.match(/[${}:"]/g) || typeof req.body.rate !== 'string' || req.body.rate.match(/[${}:"]/g)){
        isValidRequest = false
    }
    if(isValidRequest){
        let crackJobData = {
            ids: req.body.ids,
            duration: 1,
            instanceType: req.body.instanceType,
            availabilityZone: req.body.availabilityZone,
            rate: req.body.rate,
            maskingOption:{
                redactionNone: true,
                redactionCharacter: false,
                redactionLength: false,
                redactionFull: false
            },
            useDictionaries:true,
            bruteLimit:"7"
        }
        // intelligent handling of masking option
        if(typeof req.body.maskingOption === 'object'){
            if(typeof req.body.maskingOption.redactionNone === 'boolean'){
                if(req.body.maskingOption.redactionNone === true) {
                    crackJobData.maskingOption.redactionNone = true
                    crackJobData.maskingOption.redactionCharacter = false
                    crackJobData.maskingOption.redactionLength = false
                    crackJobData.maskingOption.redactionFull = false
                }
                if(req.body.maskingOption.redactionCharacter === true) {
                    crackJobData.maskingOption.redactionNone = false
                    crackJobData.maskingOption.redactionCharacter = true
                    crackJobData.maskingOption.redactionLength = false
                    crackJobData.maskingOption.redactionFull = false
                }
                if(req.body.maskingOption.redactionLength === true) {
                    crackJobData.maskingOption.redactionNone = false
                    crackJobData.maskingOption.redactionCharacter = false
                    crackJobData.maskingOption.redactionLength = true
                    crackJobData.maskingOption.redactionFull = false
                }
                if(req.body.maskingOption.redactionFull === true) {
                    crackJobData.maskingOption.redactionNone = false
                    crackJobData.maskingOption.redactionCharacter = false
                    crackJobData.maskingOption.redactionLength = false
                    crackJobData.maskingOption.redactionFull = true
                }
            }
        }
        // intelligent handling of useDictionaries
        if(typeof req.body.useDictionaries === 'boolean'){
            crackJobData.useDictionaries = req.body.useDictionaries
        }
        // intelligent handling of bruteLimit
        if(typeof req.body.bruteLimit === 'string'){
            let pInt = parseInt(req.body.bruteLimit,10)
            if(isNaN(pInt)){
                pInt = 0
            }
            crackJobData.bruteLimit = `${pInt}`
        }
        console.log(crackJobData)
        JsonRoutes.sendResult(res, {
            data:`Request Validated`
        })
    } else {
        JsonRoutes.sendResult(res, {
            data:`Request Failed Validation`
        })
    }
})

// For cracking Hashes
/*
Below is data sent to the crackHashes function to start a hash cracking job
{ ids: [ '2ukCQ9JEHKwhQuN3k' ],    << REQUIRED
  duration: 1,                     << NEVER YS SET TO 1 for now
  instanceType: 'p3_2xl',          << REQUIRED
  availabilityZone: 'us-east-1a',  << REQUIRED
  rate: '0.924500',                << REQUIRED
  maskingOption:                   << NOT REQUIRED BUT BUILT INTELLIGENTLY
   { redactionNone: true,         
     redactionCharacter: false,   
     redactionLength: false,      
     redactionFull: false,        
     configureAdvanced: false },  
  useDictionaries: true,           << NOT REQUIRED BUT USED INTELLIGENTLY
  bruteLimit: '7' }                << NOT REQUIRED BUT USED INTELLIGENTLY
*/