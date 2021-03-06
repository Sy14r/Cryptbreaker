/* eslint-disable no-unused-vars */
/**
 * Meteor methods
 */

import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { AWSCOLLECTION } from './aws.js';
// const AWS = require('aws-sdk');
import _ from 'lodash';

const bound = Meteor.bindEnvironment((callback) => {callback();});

export async function updateAWSRegionInfo(regionsArray){
    let existingRegions = AWSCOLLECTION.findOne({type:"regions"})
    // this is the initial regions pulls
    if(typeof existingRegions === 'undefined'){
        let data = []
        _.each(regionsArray, (region) => {
            let regionData = {
                name: region.RegionName,
                active: false
            }
            if(region.RegionName.startsWith("us-")){
                regionData.active = true
            }
            data.push(regionData)
        })
        AWSCOLLECTION.insert({type:"regions",data:data})
    } 
    // else we're looking to see if regions were removed or added -- this will be done later
    else {
        let knownRegions = []
        _.each(existingRegions.data, (region) => {
            knownRegions.push(region.name)
        })
        // find new regions to add
        let regionsToAdd = []
        let justObservedRegions = []
        _.each(regionsArray, (region) => {
            if(!knownRegions.includes(region.RegionName)){
                regionsToAdd.push(regions)
            }
            justObservedRegions.push(region.RegionName)
        })
        // find old regions to remove
        let regionsToRemove = []
        _.each(knownRegions, (region) => {
            if(!justObservedRegions.includes(region)){
                regionsToRemove.push(region)
            }
        })
        if(regionsToAdd.length > 0 || regionsToRemove.length > 0){
            let newRegionsToStore = []
            // add all newly id'd regions as inactive
            _.each(regionsToAdd, (region) => {
                let regionData = {
                    name: region,
                    active: false
                }
                newRegionsToStore.push(regionData)
            })
            // for each existing region, if it doesn't need to be removed then add it to 
            // the newRegionsToStore so we don't lose still active regions
            _.each(existingRegions.data, (region) => {
                if(!regionsToRemove.includes(region.name)){
                    newRegionsToStore.push(region)
                }
            })
            // newRegionsToStore contains new info to save
            AWSCOLLECTION.remove({type:"regions"})
            AWSCOLLECTION.insert({type:"regions",data:newRegionsToStore})
    
        }
    }
}

export async function updateActivePricing(){
    const AWS = require('aws-sdk');
        let creds = AWSCOLLECTION.findOne({type:'creds'}) 
        if(creds){
            // console.log(creds)
            AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
            var params = {
                EndTime: new Date(), 
                InstanceTypes: [
                    "p3.2xlarge",
                    "p3.8xlarge",
                    "p3.16xlarge",
                    "p3dn.24xlarge",
                ], 
                 ProductDescriptions: [
                    "Linux/UNIX"
                ], 
                StartTime: new Date()
            };
            AWS.config.update({region: 'us-east-1'});
            let ec2 = new AWS.EC2()
            let availabilityIssues = AWSCOLLECTION.find({'type':"availabilityNote"}).fetch()
            try {
                const formattedResults = [];
                await ec2.describeRegions({}).promise()
                .then((data) => {
                    const regions = [];
                    // console.log(`WE GOT DATA!!!!!\n\n${JSON.stringify(data)}\n\n`)
                    _.each(data.Regions, (theRegion) => {
                        regions.push(theRegion)
                    })
                    return regions;
                }).then((regions) => {
                    updateAWSRegionInfo(regions);
                    let activeRegionsData = AWSCOLLECTION.findOne({"type":"regions"})
                    let activeRegions = []
                    _.each(activeRegionsData.data, (r) => {
                        if(r.active === true){
                            activeRegions.push(r)
                        }
                    })
                    // console.log(regions.length-1);
                    // const promises = regions.map(theRegion => {
                    // only build pricing out of the active regions...
                    const promises = activeRegions.map(theRegion => {
                        let formattedResult = {
                            p3_2xl:{cheapest:1000},
                            p3_8xl:{cheapest:1000},
                            p3_16xl:{cheapest:1000},
                            p3dn_24xl:{cheapest:1000}
                        };
                        let AWS = require('aws-sdk')
                        AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
                        AWS.config.region = theRegion.name;
                        let ec2 = new AWS.EC2();
                        return ec2.describeSpotPriceHistory(params).promise().then((data, err) => {
                            if (err){ console.log(err, err.stack); } // an error occurred }// 
                            else {
                                // console.log(data);           // successful response        
                                _.each(data.SpotPriceHistory, (spotPrice) => {
                                    // console.log(spotPrice);
                                    if(spotPrice.InstanceType === 'p3.2xlarge'){
                                        if(spotPrice.SpotPrice < formattedResult.p3_2xl.cheapest){
                                            // console.log('cheaper');
                                            formattedResult.p3_2xl.cheapest = spotPrice.SpotPrice
                                            formattedResult.p3_2xl.az = spotPrice.AvailabilityZone
                                        }
                                    } else if(spotPrice.InstanceType === 'p3.8xlarge'){
                                        if(spotPrice.SpotPrice < formattedResult.p3_8xl.cheapest){
                                            // console.log('cheaper');
                                            formattedResult.p3_8xl.cheapest = spotPrice.SpotPrice
                                            formattedResult.p3_8xl.az = spotPrice.AvailabilityZone
                                        }
                                    } else if(spotPrice.InstanceType === 'p3.16xlarge'){
                                        if(spotPrice.SpotPrice < formattedResult.p3_16xl.cheapest){
                                            // console.log('cheaper');
                                            formattedResult.p3_16xl.cheapest = spotPrice.SpotPrice
                                            formattedResult.p3_16xl.az = spotPrice.AvailabilityZone
                                        }
                                    } else if(spotPrice.InstanceType === 'p3dn.24xlarge'){
                                        if(spotPrice.SpotPrice < formattedResult.p3dn_24xl.cheapest){
                                            // console.log('cheaper');
                                            formattedResult.p3dn_24xl.cheapest = spotPrice.SpotPrice
                                            formattedResult.p3dn_24xl.az = spotPrice.AvailabilityZone
                                        }
                                    }
                                })
                                formattedResults.push(formattedResult);
                                if(formattedResults.length === activeRegions.length){
                                    // console.log(availabilityIssues)
                                    // console.log("HERE")
                                    let formattedResult = {
                                        p3_2xl:{cheapest:1000},
                                        p3_8xl:{cheapest:1000},
                                        p3_16xl:{cheapest:1000},
                                        p3dn_24xl:{cheapest:1000}
                                    };
                                    _.each(formattedResults, (res) => {
                                        // console.log(res);
                                        let isNotAvailable1 = false
                                        let isNotAvailable2 = false
                                        let isNotAvailable3 = false
                                        let isNotAvailable4 = false
                                        _.each(availabilityIssues,(issue) => {
                                            // If we have an az that has known issues
                                            if(issue.data.az === res.p3_2xl.az){
                                                if(issue.data.type === "p3.2xlarge"){
                                                    isNotAvailable1 = true
                                                } else if(issue.data.type === "p3.8xlarge"){
                                                    isNotAvailable2 = true
                                                } else if(issue.data.type === "p3.16xlarge"){
                                                    isNotAvailable3 = true
                                                } else if(issue.data.type === "p3dn.24xlarge"){
                                                    isNotAvailable4 = true
                                                }
                                            }
                                        })

                                        if(!isNotAvailable1 && (parseFloat(res.p3_2xl.cheapest) < parseFloat(formattedResult.p3_2xl.cheapest))){
                                            // console.log(`${res.p3_2xl.cheapest} was cheaper than ${formattedResult.p3_2xl.cheapest}`)
                                            formattedResult.p3_2xl.cheapest = res.p3_2xl.cheapest
                                            formattedResult.p3_2xl.az = res.p3_2xl.az
                                        }
                                        if(!isNotAvailable2 && (parseFloat(res.p3_8xl.cheapest) < parseFloat(formattedResult.p3_8xl.cheapest))){
                                            // console.log(`${res.p3_8xl.cheapest} was cheaper than ${formattedResult.p3_8xl.cheapest}`)
                                            formattedResult.p3_8xl.cheapest = res.p3_8xl.cheapest
                                            formattedResult.p3_8xl.az = res.p3_8xl.az
                                        }
                                        if(!isNotAvailable3 && (parseFloat(res.p3_16xl.cheapest) < parseFloat(formattedResult.p3_16xl.cheapest))){
                                            // console.log(`${res.p3_16xl.cheapest} was cheaper than ${formattedResult.p3_16xl.cheapest}`)
                                            formattedResult.p3_16xl.cheapest = res.p3_16xl.cheapest
                                            formattedResult.p3_16xl.az = res.p3_16xl.az
                                        }
                                        if(!isNotAvailable4 && (parseFloat(res.p3dn_24xl.cheapest) < parseFloat(formattedResult.p3dn_24xl.cheapest))){
                                            // console.log(`${res.p3dn_24xl.cheapest} was cheaper than ${formattedResult.p3dn_24xl.cheapest}`)
                                            formattedResult.p3dn_24xl.cheapest = res.p3dn_24xl.cheapest
                                            formattedResult.p3dn_24xl.az = res.p3dn_24xl.az
                                        }                                        
                                      
                                    })
                                    let current = AWSCOLLECTION.find({type:'pricing'}).fetch()
                                    if(current.length > 0){
                                        AWSCOLLECTION.update({type:'pricing'},{$set:{data:formattedResult}});
                                    } else {
                                        AWSCOLLECTION.insert({type:'pricing',data:formattedResult});
                                    }
                                    console.log("DONE")
                                    return true
                                }
                            }
                        })
                    });
                    Promise.all(promises).then(() => {
                        console.log("ALL DONE")
                        return true
                    })
                })
                .catch(err => {
                    return false
                    //console.log(err);
                });                
            } catch (err){
                console.log(err)
                return false
            }
        } else {
            throw new Meteor.Error(401,'401 Unauthorized','In order to fetch spot pricing you must have AWS credentials configured')
        }
}

export async function refereshSpotPricing(){
    const AWS = require('aws-sdk');
        let creds = AWSCOLLECTION.findOne({type:'creds'}) 
        if(creds){
            // console.log(creds)
            AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
            var params = {
                EndTime: new Date(), 
                InstanceTypes: [
                    "p3.2xlarge",
                    "p3.8xlarge",
                    "p3.16xlarge",
                    "p3dn.24xlarge",
                ], 
                 ProductDescriptions: [
                    "Linux/UNIX"
                ], 
                StartTime: new Date()
            };
            AWS.config.update({region: 'us-east-1'});
            let ec2 = new AWS.EC2()
            let availabilityIssues = AWSCOLLECTION.find({'type':"availabilityNote"}).fetch()
            try {
                const formattedResults = [];
                await ec2.describeRegions({}).promise()
                .then((data) => {
                    const regions = [];
                    // console.log(`WE GOT DATA!!!!!\n\n${JSON.stringify(data)}\n\n`)
                    _.each(data.Regions, (theRegion) => {
                        regions.push(theRegion)
                    })
                    return regions;
                }).then((regions) => {
                    // console.log(regions.length-1);
                    updateAWSRegionInfo(regions);
                    let activeRegionsData = AWSCOLLECTION.findOne({"type":"regions"})
                    let activeRegions = []
                    _.each(activeRegionsData.data, (r) => {
                        if(r.active === true){
                            activeRegions.push(r.name)
                        }
                    })
                    const promises = regions.map(theRegion => {
                        let formattedResult = {
                            p3_2xl:{cheapest:1000},
                            p3_8xl:{cheapest:1000},
                            p3_16xl:{cheapest:1000},
                            p3dn_24xl:{cheapest:1000}
                        };
                        let AWS = require('aws-sdk')
                        AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
                        AWS.config.region = theRegion.RegionName;
                        let ec2 = new AWS.EC2();
                        return ec2.describeSpotPriceHistory(params).promise().then((data, err) => {
                            if (err){ console.log(err, err.stack); } // an error occurred }// 
                            else {
                                // console.log(data);           // successful response        
                                _.each(data.SpotPriceHistory, (spotPrice) => {
                                    // console.log(spotPrice);
                                    if(spotPrice.InstanceType === 'p3.2xlarge'){
                                        if(spotPrice.SpotPrice < formattedResult.p3_2xl.cheapest){
                                            // console.log('cheaper');
                                            formattedResult.p3_2xl.cheapest = spotPrice.SpotPrice
                                            formattedResult.p3_2xl.az = spotPrice.AvailabilityZone
                                        }
                                    } else if(spotPrice.InstanceType === 'p3.8xlarge'){
                                        if(spotPrice.SpotPrice < formattedResult.p3_8xl.cheapest){
                                            // console.log('cheaper');
                                            formattedResult.p3_8xl.cheapest = spotPrice.SpotPrice
                                            formattedResult.p3_8xl.az = spotPrice.AvailabilityZone
                                        }
                                    } else if(spotPrice.InstanceType === 'p3.16xlarge'){
                                        if(spotPrice.SpotPrice < formattedResult.p3_16xl.cheapest){
                                            // console.log('cheaper');
                                            formattedResult.p3_16xl.cheapest = spotPrice.SpotPrice
                                            formattedResult.p3_16xl.az = spotPrice.AvailabilityZone
                                        }
                                    } else if(spotPrice.InstanceType === 'p3dn.24xlarge'){
                                        if(spotPrice.SpotPrice < formattedResult.p3dn_24xl.cheapest){
                                            // console.log('cheaper');
                                            formattedResult.p3dn_24xl.cheapest = spotPrice.SpotPrice
                                            formattedResult.p3dn_24xl.az = spotPrice.AvailabilityZone
                                        }
                                    }
                                })
                                formattedResults.push(formattedResult);
                                if(formattedResults.length === regions.length){
                                    // console.log(formattedResults)
                                    let bestOverallFormattedResult = {
                                        p3_2xl:{cheapest:1000},
                                        p3_8xl:{cheapest:1000},
                                        p3_16xl:{cheapest:1000},
                                        p3dn_24xl:{cheapest:1000}
                                    };
                                    let bestActiveFormattedResult = {
                                        p3_2xl:{cheapest:1000},
                                        p3_8xl:{cheapest:1000},
                                        p3_16xl:{cheapest:1000},
                                        p3dn_24xl:{cheapest:1000}
                                    };
                                    // for each of the overall total listing of pricing data
                                    _.each(formattedResults, (res) => {
                                        // console.log(res);
                                        let isNotAvailable1 = false
                                        let isNotAvailable2 = false
                                        let isNotAvailable3 = false
                                        let isNotAvailable4 = false
                                        _.each(availabilityIssues,(issue) => {
                                            // If we have an az that has known issues
                                            if(issue.data.az === res.p3_2xl.az){
                                                if(issue.data.type === "p3.2xlarge"){
                                                    isNotAvailable1 = true
                                                } else if(issue.data.type === "p3.8xlarge"){
                                                    isNotAvailable2 = true
                                                } else if(issue.data.type === "p3.16xlarge"){
                                                    isNotAvailable3 = true
                                                } else if(issue.data.type === "p3dn.24xlarge"){
                                                    isNotAvailable4 = true
                                                }
                                            }
                                        })

                                        /// best overall results
                                        if(!isNotAvailable1 && (parseFloat(res.p3_2xl.cheapest) < parseFloat(bestOverallFormattedResult.p3_2xl.cheapest))){
                                            // console.log(`${res.p3_2xl.cheapest} was cheaper than ${formattedResult.p3_2xl.cheapest}`)
                                            bestOverallFormattedResult.p3_2xl.cheapest = res.p3_2xl.cheapest
                                            bestOverallFormattedResult.p3_2xl.az = res.p3_2xl.az
                                        }
                                        if(!isNotAvailable2 && (parseFloat(res.p3_8xl.cheapest) < parseFloat(bestOverallFormattedResult.p3_8xl.cheapest))){
                                            // console.log(`${res.p3_8xl.cheapest} was cheaper than ${formattedResult.p3_8xl.cheapest}`)
                                            bestOverallFormattedResult.p3_8xl.cheapest = res.p3_8xl.cheapest
                                            bestOverallFormattedResult.p3_8xl.az = res.p3_8xl.az
                                        }
                                        if(!isNotAvailable3 && (parseFloat(res.p3_16xl.cheapest) < parseFloat(bestOverallFormattedResult.p3_16xl.cheapest))){
                                            // console.log(`${res.p3_16xl.cheapest} was cheaper than ${formattedResult.p3_16xl.cheapest}`)
                                            bestOverallFormattedResult.p3_16xl.cheapest = res.p3_16xl.cheapest
                                            bestOverallFormattedResult.p3_16xl.az = res.p3_16xl.az
                                        }
                                        if(!isNotAvailable4 && (parseFloat(res.p3dn_24xl.cheapest) < parseFloat(bestOverallFormattedResult.p3dn_24xl.cheapest))){
                                            // console.log(`${res.p3dn_24xl.cheapest} was cheaper than ${formattedResult.p3dn_24xl.cheapest}`)
                                            bestOverallFormattedResult.p3dn_24xl.cheapest = res.p3dn_24xl.cheapest
                                            bestOverallFormattedResult.p3dn_24xl.az = res.p3dn_24xl.az
                                        }   
                                        
                                        // best active results... these could be nested inside the prior checks but its fine split out
                                        if(!isNotAvailable1 && typeof res.p3_2xl.az !== 'undefined' && (activeRegions.includes(res.p3_2xl.az.slice(0,-1))) && (parseFloat(res.p3_2xl.cheapest) < parseFloat(bestActiveFormattedResult.p3_2xl.cheapest))){
                                            // console.log(`${res.p3_2xl.cheapest} was cheaper than ${formattedResult.p3_2xl.cheapest}`)
                                            bestActiveFormattedResult.p3_2xl.cheapest = res.p3_2xl.cheapest
                                            bestActiveFormattedResult.p3_2xl.az = res.p3_2xl.az    
                                        }
                                        if(!isNotAvailable2 && typeof res.p3_8xl.az !== 'undefined' && (activeRegions.includes(res.p3_8xl.az.slice(0,-1))) && (parseFloat(res.p3_8xl.cheapest) < parseFloat(bestActiveFormattedResult.p3_8xl.cheapest))){
                                            // console.log(`${res.p3_8xl.cheapest} was cheaper than ${formattedResult.p3_8xl.cheapest}`)
                                            bestActiveFormattedResult.p3_8xl.cheapest = res.p3_8xl.cheapest
                                            bestActiveFormattedResult.p3_8xl.az = res.p3_8xl.az
                                        }
                                        if(!isNotAvailable3 && typeof res.p3_16xl.az !== 'undefined' && (activeRegions.includes(res.p3_16xl.az.slice(0,-1))) && (parseFloat(res.p3_16xl.cheapest) < parseFloat(bestActiveFormattedResult.p3_16xl.cheapest))){
                                            // console.log(`${res.p3_16xl.cheapest} was cheaper than ${formattedResult.p3_16xl.cheapest}`)
                                            bestActiveFormattedResult.p3_16xl.cheapest = res.p3_16xl.cheapest
                                            bestActiveFormattedResult.p3_16xl.az = res.p3_16xl.az
                                        }
                                        if(!isNotAvailable4 && typeof res.p3dn_24xl.az !== 'undefined' && (activeRegions.includes(res.p3dn_24xl.az.slice(0,-1))) && (parseFloat(res.p3dn_24xl.cheapest) < parseFloat(bestActiveFormattedResult.p3dn_24xl.cheapest))){
                                            // console.log(`${res.p3dn_24xl.cheapest} was cheaper than ${formattedResult.p3dn_24xl.cheapest}`)
                                            bestActiveFormattedResult.p3dn_24xl.cheapest = res.p3dn_24xl.cheapest
                                            bestActiveFormattedResult.p3dn_24xl.az = res.p3dn_24xl.az
                                        }  
                                      
                                    })
                                    let current = AWSCOLLECTION.find({type:'bestPricing'}).fetch()
                                    if(current.length > 0){
                                        AWSCOLLECTION.update({type:'bestPricing'},{$set:{data:bestOverallFormattedResult}});
                                    } else {
                                        AWSCOLLECTION.insert({type:'bestPricing',data:bestOverallFormattedResult});
                                    }

                                    let currentPricing = AWSCOLLECTION.find({type:'pricing'}).fetch()
                                    if(currentPricing.length > 0){
                                        AWSCOLLECTION.update({type:'pricing'},{$set:{data:bestActiveFormattedResult}});
                                    } else {
                                        AWSCOLLECTION.insert({type:'pricing',data:bestActiveFormattedResult});
                                    }
                                    return true
                                }
                            }
                        })
                    });
                    Promise.all(promises).then(() => {
                        return true
                    })
                })
                .catch(err => {
                    return false
                    //console.log(err);
                });                
            } catch (err){
                console.log(err)
                return false
            }
        } else {
            throw new Meteor.Error(401,'401 Unauthorized','In order to fetch spot pricing you must have AWS credentials configured')
        }
}

export async function toggleRegionState(data){
    let regions = AWSCOLLECTION.findOne({"type":"regions"})
    let newData = regions.data
    _.each(newData, (region) => {
        if(region.name === data){
            region.active = !region.active
        }
    })
    AWSCOLLECTION.update({"type":"regions"},{$set:{"data":newData}})
}

export async function enableRegion(data){
    let regions = AWSCOLLECTION.findOne({"type":"regions"})
    let newData = regions.data
    _.each(newData, (region) => {
        if(region.name === data){
            region.active = true
        }
    })
    AWSCOLLECTION.update({"type":"regions"},{$set:{"data":newData}})
}

export async function disableRegion(data){
    let regions = AWSCOLLECTION.findOne({"type":"regions"})
    let newData = regions.data
    _.each(newData, (region) => {
        if(region.name === data){
            region.active = false
        }
    })
    AWSCOLLECTION.update({"type":"regions"},{$set:{"data":newData}})
}

Meteor.methods({
    async storeAWSCreds(data) {
        if (this.userId) {
            const AWS = require('aws-sdk');
            AWS.config.credentials = new AWS.Credentials({accessKeyId:data.accessKeyId, secretAccessKey:data.secretAccessKey});
            AWS.config.region = 'us-east-1';
            //var creds = new AWS.Credentials({accessKeyId:doc.accessKeyId, secretAccessKey:doc.secretAccessKey});
            const ec2 = new AWS.EC2();
            var params = {
                Filters: [
                {
                Name: "tag:Purpose", 
                Values: [
                    "test"
                ]
                }
                ]
            };

            await ec2.describeInstances(params).promise().then((err, data) =>{
                bound(() =>{
                    if (err) {
                        //return Promise.reject(err);
                        console.log(err.message)
                    } 
                    else{
                    }
                })
            }).catch(err => {
                console.log("+++")
                console.log(err.message)
                console.log("+++")
                throw new Meteor.Error(err.statusCode,err.code,err.message)
            });
            AWSCOLLECTION.remove({type:'creds'});
            AWSCOLLECTION.insert({type:'creds', accessKeyId:data.accessKeyId, secretAccessKey:data.secretAccessKey});   
            let current = AWSCOLLECTION.find({type:'pricing'}).fetch()
            if(current.length === 0){
                AWSCOLLECTION.insert({type:'pricing'})
            }
        }
        return true; 
    },

    async getSpotPricing() {
        if (this.userId) {
            refereshSpotPricing()
        }
        return true
    },

    async toggleRegionUse(data){
        if (this.userId) {
            toggleRegionState(data)
        }
        return true
    },

    configureAWSResources() {
        if (!Roles.userIsInRole(this.userId, ['admin'])) {
            throw new Meteor.Error(401,'401 Unauthorized','Only admin users may configure resources')
        }
        const AWS = require('aws-sdk');
        let creds = AWSCOLLECTION.findOne({type:'creds'})

        let settings = AWSCOLLECTION.findOne({type:'settings'})
        
        if(creds){
            if(!settings){
                //Configure resources here... need to create and save and S3 bucked that is not public....
                console.log("Need to configure settings...")
                AWS.config.credentials = new AWS.Credentials({accessKeyId:creds.accessKeyId, secretAccessKey:creds.secretAccessKey});
                var s3 = new AWS.S3();
                const uuidv4 = require('uuid/v4');
                let randomVal = uuidv4();
                var params = {
                    Bucket: `crackdown-${randomVal}`,
                    ACL: "private"
                   };
                   s3.createBucket(params, function(err, data) {
                     if (err) console.log(err, err.stack); // an error occurred
                     else{
                         let bucketName = data.Location.replace("/","")
                         params ={
                             Bucket:bucketName,
                             PublicAccessBlockConfiguration:{
                                 BlockPublicAcls:true,
                                 BlockPublicPolicy: true,
                                 IgnorePublicAcls: true,
                                 RestrictPublicBuckets: true,
                             }
                         }
                         s3.putPublicAccessBlock(params,(err,data) => {
                            if (err) console.log(err, err.stack); // an error occurred
                            else {
                                // After configuring the bucket we need to configure the IAM EC2 Role...
                                let policyDoc = {
                                    Version: "2012-10-17",
                                    Statement: [
                                        {
                                            Sid: "Crackdown0",
                                            Effect: "Allow",
                                            Action: "s3:*",
                                            Resource: [
                                                `arn:aws:s3:::${bucketName}`,
                                                `arn:aws:s3:::${bucketName}/*`
                                            ]
                                        },
                                        {
                                            "Sid": "VisualEditor2",
                                            "Effect": "Allow",
                                            "Action": [
                                                "s3:GetAccessPoint",
                                                "s3:GetLifecycleConfiguration",
                                                "s3:GetBucketTagging",
                                                "s3:GetInventoryConfiguration",
                                                "s3:GetObjectVersionTagging",
                                                "s3:ListBucketVersions",
                                                "s3:GetBucketLogging",
                                                "s3:ListBucket",
                                                "s3:GetAccelerateConfiguration",
                                                "s3:GetBucketPolicy",
                                                "s3:GetObjectVersionTorrent",
                                                "s3:GetObjectAcl",
                                                "s3:GetEncryptionConfiguration",
                                                "s3:GetBucketObjectLockConfiguration",
                                                "s3:GetBucketRequestPayment",
                                                "s3:GetAccessPointPolicyStatus",
                                                "s3:GetObjectVersionAcl",
                                                "s3:GetObjectTagging",
                                                "s3:GetMetricsConfiguration",
                                                "s3:HeadBucket",
                                                "s3:GetBucketPublicAccessBlock",
                                                "s3:GetBucketPolicyStatus",
                                                "s3:ListBucketMultipartUploads",
                                                "s3:GetObjectRetention",
                                                "s3:GetBucketWebsite",
                                                "s3:GetJobTagging",
                                                "s3:ListAccessPoints",
                                                "s3:ListJobs",
                                                "s3:GetBucketVersioning",
                                                "s3:GetBucketAcl",
                                                "s3:GetObjectLegalHold",
                                                "s3:GetBucketNotification",
                                                "s3:GetReplicationConfiguration",
                                                "s3:ListMultipartUploadParts",
                                                "s3:GetObject",
                                                "s3:GetObjectTorrent",
                                                "s3:GetAccountPublicAccessBlock",
                                                "s3:ListAllMyBuckets",
                                                "s3:DescribeJob",
                                                "s3:GetBucketCORS",
                                                "s3:GetAnalyticsConfiguration",
                                                "s3:GetObjectVersionForReplication",
                                                "s3:GetBucketLocation",
                                                "s3:GetAccessPointPolicy",
                                                "s3:GetObjectVersion"
                                            ],
                                            "Resource": "arn:aws:s3:::cbrqmain/PASSWORDS.zip"
                                        },
                                        {
                                            Sid: "Crackdown2",
                                            Effect: "Allow",
                                            Action: "ec2:TerminateInstances",
                                            Resource: "*"
                                        }
                                    ]
                                }
                                 params = {
                                    PolicyDocument: JSON.stringify(policyDoc), 
                                    PolicyName: `crackdown-node-policy-${randomVal}`
                                   };
                                   let iam = new AWS.IAM();
                                   iam.createPolicy(params, function(err, data) {
                                     if (err) console.log(err, err.stack); // an error occurred
                                     else{
                                         let policyResult = data.Policy
                                         let rolePolicyDoc = {
                                            Version: "2012-10-17",
                                            Statement: [
                                              {
                                                Effect: "Allow",
                                                Principal: {
                                                  Service: "ec2.amazonaws.com"
                                                },
                                                Action: "sts:AssumeRole"
                                              }
                                            ]
                                          }
                                         // We have the policy now we need to create the role
                                        params = {
                                            AssumeRolePolicyDocument: JSON.stringify(rolePolicyDoc), 
                                            Path: "/", 
                                            RoleName: `crackdown-node-role-${randomVal}`
                                        };
                                        iam.createRole(params, function(err, data) {
                                            if (err) console.log(err, err.stack); // an error occurred
                                            else {
                                                let roleResult = data.Role
                                                // Now to attack the policy to the role
                                                params = {
                                                    PolicyArn: policyResult.Arn, 
                                                    RoleName: roleResult.RoleName
                                                };
                                                iam.attachRolePolicy(params, function(err, data) {
                                                    if (err) console.log(err, err.stack); // an error occurred
                                                    else{
                                                        // Need to also create an instance profile
                                                         params = {
                                                            InstanceProfileName: `crackdown-${randomVal}`
                                                        };
                                                        iam.createInstanceProfile(params, function(err, data) {
                                                            if (err) console.log(err, err.stack); // an error occurred
                                                            else     {
                                                                let instanceProfileResult = data.InstanceProfile
                                                                params = {
                                                                    InstanceProfileName: `${instanceProfileResult.InstanceProfileName}`, 
                                                                    RoleName: `${roleResult.RoleName}`
                                                                };
                                                                iam.addRoleToInstanceProfile(params, function(err, data) {
                                                                    if (err) console.log(err, err.stack); // an error occurred
                                                                    else {
                                                                        console.log(policyResult)
                                                                        console.log(roleResult)
                                                                        console.log(instanceProfileResult)
                                                                        console.log("Successfully configured the settings")
                                                                        bound(() => {
                                                                            let inserted = AWSCOLLECTION.insert({'type':'settings','bucketName': bucketName,'iamPolicy': policyResult,'iamRole': roleResult,'instanceProfile':instanceProfileResult})
                                                                            if(inserted){
                                                                                console.log("INSERTED")
                                                                                refereshSpotPricing()
                                                                                refereshSpotPricing()
                                                                                return true
                                                                            } else {
                                                                                throw new Meteor.Error(500,'Unable to save AWS setting','The server was unable to successfully insert the required AWS settings into the database')
                                                                            }    
                                                                        })
                                                                    }
                                                                });
                                                            }
                                                        });
                                                          
                                                       
                                                    }
                                                });
                                            }
                                          });
                                     }
                                   });
                            }
                         })
                     }
                   });

            } else {
                throw new Meteor.Error(500, '500 Internal Server Error', 'Settings Already Configured')
            }
        } else {
            throw new Meteor.Error(401,'401 Unauthorized','In order to fetch spot pricing you must have AWS credentials configured')
        }
    }
});