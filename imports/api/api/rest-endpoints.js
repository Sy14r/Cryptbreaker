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
            next()
        }
    }
    else {
        next()
    }

})

JsonRoutes.add("GET","/api/files", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`HashFiles listed at ${new Date()}`}})
    JsonRoutes.sendResult(res, {
        data:{hashFiles:HashFiles.find({},{fields:{'_id':1,'name':1,'hashCount':1,'crackCount':1,'distinctCount':1}}).fetch()}
    })
})

JsonRoutes.add("GET","/api/files/:fileID", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`HashFile ${req.params.fileID} accessed at ${new Date()}`}})
    JsonRoutes.sendResult(res, {
        data:HashFiles.findOne({'_id':req.params.fileID})
    })
})

JsonRoutes.add("GET","/api/jobs", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Crack Jobs listed at ${new Date()}`}})
    JsonRoutes.sendResult(res, {
        data:{crackJobs:HashCrackJobs.find({},{fields:{'_id':1,'uuid':1,'status':1}}).fetch()}
    })
})

JsonRoutes.add("GET","/api/jobs/:jobID", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Crack Jobs ${req.params.jobID} accessed at ${new Date()}`}})
    JsonRoutes.sendResult(res, {
        data:HashCrackJobs.findOne({'_id':req.params.jobID},{fields:{'spotInstanceRequest':0}})
    })
})

JsonRoutes.add("GET","/api/jobs/:jobID/status", (req,res,next) => {
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Crack Job ${req.params.jobID} status checked at ${new Date()}`}})
    JsonRoutes.sendResult(res, {
        data:HashCrackJobs.findOne({'_id':req.params.jobID},{fields:{'status':1}})
    })
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
    APICollection.update({"secret":req.headers.apikey},{$set:{'status':`Hashes retrieved for ${req.params.fileID} at ${new Date()}`}})
    let splitURL = req.url.split("?")
    let urlParams = {}
    if(splitURL.length > 1){
        _.each(splitURL[1].split("&"), (param) => {
            let splitParam = param.split("=")
            if(splitParam.length > 1){
                urlParams[splitParam[0]] = splitParam[1]
            }
        })
    }
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
})