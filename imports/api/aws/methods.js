/* eslint-disable no-unused-vars */
/**
 * Meteor methods
 */

import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { AWSCOLLECTION } from './aws.js';
const AWS = require('aws-sdk');
import _ from 'lodash';

const bound = Meteor.bindEnvironment((callback) => {callback();});

Meteor.methods({
    async storeAWSCreds(data) {
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
        //     console.log("+++")
        //     console.log(err.message)
        //     console.log("+++")
            throw new Meteor.Error(err.statusCode,err.code,err.message)
        });
        AWSCOLLECTION.remove({type:'creds'});
        AWSCOLLECTION.insert({type:'creds', accessKeyId:data.accessKeyId, secretAccessKey:data.secretAccessKey});   
        let current = AWSCOLLECTION.find({type:'pricing'}).fetch()
        if(current.length === 0){
            AWSCOLLECTION.insert({type:'pricing'})
        }
        return true; 
    },

    async getSpotPricing() {
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
                                if(formattedResults.length === regions.length-1){
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
                                            Sid: "Crackdown1",
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