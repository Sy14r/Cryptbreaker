import React, { useState } from 'react';
import { Roles } from 'meteor/alanning:roles';
import PropTypes from 'prop-types';
import { withTracker } from 'meteor/react-meteor-data';
import MUIDataTable from "mui-datatables";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import VPNKeyIcon from "@material-ui/icons/VpnKey";
import PolicyIcon from '@material-ui/icons/Policy';
import Assessment from "@material-ui/icons/Assessment";
import ImportExportIcon from "@material-ui/icons/ImportExportRounded";
import PauseCircleFilledIcon from '@material-ui/icons/PauseCircleFilled';
import PlayCircleFilledIcon from '@material-ui/icons/PlayCircleFilled';
import Tooltip from "@material-ui/core/Tooltip";
import LinearProgress from '@material-ui/core/LinearProgress';
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { Hashes, HashFiles, HashCrackJobs } from '/imports/api/hashes/hashes.js';
import CustomToolbarSelect from "./CustomToolbarSelect";
import CustomToolbarSelectCrackJobs from "./CustomToolbarSelectCrackJobs";
import ReactDOM from 'react-dom';
import { AWSCOLLECTION } from '/imports/api/aws/aws.js'
import Spinner from '/imports/ui/components/Spinner';
import Swal from 'sweetalert2'

import './Landing.scss';
import { HashFileUploadJobs } from '../../../api/hashes/hashes';
import HashFileUploadStatus from '../../components/HashFileUploadStatus'

class Landing extends React.Component {

  state = {
    searchText: ''
  };
  
  componentWillMount() {
    if (!this.props.loggedIn) {
      return this.props.history.push('/login');
    }
    return true;
  }

  shouldComponentUpdate(nextProps) {
    if (nextProps.loggedIn) {
      nextProps.history.push('/login');
      return false;
    }
    return true;
  }

  getMuiTheme = () => createMuiTheme({
    overrides: {
      MUIDataTableBodyCell: {
        root: {
          backgroundColor: "#FFF",
          width: "20em"
        }
      }
    }
  })

  handleClickReport = () => {
    let id = ''
    if(typeof event.target.getAttribute('rowid') === 'string'){
      id = event.target.getAttribute('rowid')
    } else if (event._targetInst){
      if(typeof event._targetInst.pendingProps.rowid === 'string') {
        id = event._targetInst.pendingProps.rowid
      } else {
        id = event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid')
      }
    } else if (typeof event.target.ownerSVGElement.getAttribute('rowid') === 'string'){
      id = event.target.ownerSVGElement.getAttribute('rowid')
    } else {
      console.log(event)
      return
    }
    // let id = event.target.getAttribute('rowid') ? event.target.getAttribute('rowid') : (event._targetInst.pendingProps.rowid ? event._targetInst.pendingProps.rowid : event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid'))
    window.open(`/report/${id}`)
    // console.log(id)
    // console.log(event)

    // console.log(event.target.getAttribute('rowid'))
    // console.log(event._targetInst.pendingProps.rowid)
    // console.log(event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid'))
    return
  };

  handleJobPause = () => {
    let id = ''
    if(typeof event.target.getAttribute('rowid') === 'string'){
      id = event.target.getAttribute('rowid')
    } else if (event._targetInst){
      if(typeof event._targetInst.pendingProps.rowid === 'string') {
        id = event._targetInst.pendingProps.rowid
      } else {
        id = event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid')
      }
    } else if (typeof event.target.ownerSVGElement.getAttribute('rowid') === 'string'){
      id = event.target.ownerSVGElement.getAttribute('rowid')
    } else {
      console.log(event)
      return
    }
    // let id = event.target.getAttribute('rowid') ? event.target.getAttribute('rowid') : (event._targetInst.pendingProps.rowid ? event._targetInst.pendingProps.rowid : event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid'))
    Meteor.call('pauseCrack',id, (err) =>   {
      if(typeof err !== 'undefined'){
        // If we had an error...
        Swal.fire({
        title: 'Could not pause job requested',
        type: 'error',
        showConfirmButton: false,
        toast:true,
        position:'top-right',
        timer:3000,
        animation:false,
        })
      } else {
        Swal.fire({
        title: 'Job pausing...',
        type: 'success',
        showConfirmButton: false,
        toast:true,
        position:'top-right',
        timer:3000,
        animation:false,
        })
      }
  })

    return
  };

  handleJobResume = () => {
    let id = ''
    if(typeof event.target.getAttribute('rowid') === 'string'){
      id = event.target.getAttribute('rowid')
    } else if (event._targetInst){
      if(typeof event._targetInst.pendingProps.rowid === 'string') {
        id = event._targetInst.pendingProps.rowid
      } else {
        id = event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid')
      }
    } else if (typeof event.target.ownerSVGElement.getAttribute('rowid') === 'string'){
      id = event.target.ownerSVGElement.getAttribute('rowid')
    } else {
      console.log(event)
      return
    }
    let instanceType = '';
    let duration = 1;
    // Before cracking hashes... we ned to ask a few questions (instance type decision, maximum price willing to pay/hour, time to run (in hours) )
    // First refresh the known spot prices...
    Swal.fire({
        title: 'Retrieving Price Data',
        text: 'Please wait while we retrieve the latest Spot Pricing information',
        type: 'info',
        animation:false,
        showConfirmButton:false,
      })
    Meteor.call('getSpotPricing', (err, res)=>{
        if(err){
          Swal.fire({
            title: 'Spot Price Check Failed',
            text:err.details,
            type: 'error',
            animation:false,
            showConfirmButton:true,
          })
        }
        else {
          // console.log(this)
          Swal.fire({
            title: 'Pricing Data Updated',
            text:this.props.awsPricing[0].data,
            type: 'success',
            animation:false,
            showConfirmButton:true,
            confirmButtonText:"Continue",
          })
          let inputOptions = {
          }
          for (let [key, value] of Object.entries(this.props.awsPricing[0].data)) {
            // console.log(`${key}: ${value}`);
            if(key === 'p3_2xl'){
                inputOptions.p3_2xl = `${key} - $${value.cheapest}/hr (${value.az})`
            } 
            else if(key === 'p3_8xl'){
                inputOptions.p3_8xl = `${key} - $${value.cheapest}/hr (${value.az})`
            } 
            else if(key === 'p3_16xl'){
                inputOptions.p3_16xl = `${key} - $${value.cheapest}/hr (${value.az})`
            } 
            else if(key === 'p3dn_24xl'){
                inputOptions.p3dn_24xl = `${key} - $${value.cheapest}/hr (${value.az})`
            } 
          } 
          Swal.fire({
            title: 'Select an Instance Type',
            input: 'select',
            // inputOptions: {
            //   apples: 'Apples',
            //   bananas: 'Bananas',
            //   grapes: 'Grapes',
            //   oranges: 'Oranges'
            // },
            inputOptions: inputOptions,
            inputPlaceholder: 'Instance Type',
            showCancelButton: true,
            // inputValidator: (value) => {
            //   return new Promise((resolve) => {
            //     if (value === 'oranges') {
            //       resolve()
            //     } else {
            //       resolve('You need to select oranges :)')
            //     }
            //   })
            // }
          }).then((result) => {
            // console.log(result);
            if (result.value) {
                let rate = ''
                if(result.value === 'p3_2xl'){
                    rate = this.props.awsPricing[0].data.p3_2xl.cheapest
                } 
                else if(result.value === 'p3_8xl'){
                    rate = this.props.awsPricing[0].data.p3_8xl.cheapest
                } 
                else if(result.value === 'p3_16xl'){
                    rate = this.props.awsPricing[0].data.p3_16xl.cheapest
                } 
                else if(result.value === 'p3dn_24xl'){
                    rate = this.props.awsPricing[0].data.p3dn_24xl.cheapest
                } 
                instanceType = result.value;
                // Here is the more detailed prompt for no redaction/class level/length
                Swal.fire({
                  title: 'Verify Choices before Queuing',
                  html: `<p>You have selected to resume cracking with an <b>${instanceType}</b> instance at a rate of <b>$${rate}/hr</b></p>`+
                  `<p>In order to ensure that our bid is met we will add <b>$0.25</b> to the current spot price for a maximum hourly rate of <b>$${(parseFloat(rate)+.25).toFixed(2)}</b></p>`+
                  `<p>If this is correct please press launch below, otherwise cancel</p>`,
                  type: 'warning',
                  animation:false,
                  showConfirmButton:true,
                  showCancelButton:true,
                  confirmButtonText:"Resume",        
              }).then((result) =>{
                  if(result.value){
                    let location = ''
                    let rate = ''
                    if(instanceType === 'p3_2xl'){
                        location = this.props.awsPricing[0].data.p3_2xl.az
                        rate = this.props.awsPricing[0].data.p3_2xl.cheapest
                    } 
                    else if(instanceType === 'p3_8xl'){
                        location = this.props.awsPricing[0].data.p3_8xl.az
                        rate = this.props.awsPricing[0].data.p3_8xl.cheapest
                    } 
                    else if(instanceType === 'p3_16xl'){
                        location = this.props.awsPricing[0].data.p3_16xl.az
                        rate = this.props.awsPricing[0].data.p3_16xl.cheapest
                    } 
                    else if(instanceType === 'p3dn_24xl'){
                        location = this.props.awsPricing[0].data.p3dn_24xl.az
                        rate = this.props.awsPricing[0].data.p3dn_24xl.cheapest
                    } 
                Meteor.call('resumeCrack',{id:id,instanceType:instanceType, availabilityZone:location, rate:rate}, (err) =>   {
                  if(typeof err !== 'undefined'){
                    // If we had an error...
                    Swal.fire({
                    title: 'Could not crack hash files requested',
                    type: 'error',
                    showConfirmButton: false,
                    toast:true,
                    position:'top-right',
                    timer:3000,
                    animation:false,
                    })
                  } else {
                    Swal.fire({
                    title: 'hashes queued for cracking',
                    type: 'success',
                    showConfirmButton: false,
                    toast:true,
                    position:'top-right',
                    timer:3000,
                    animation:false,
                    })
                  }
              })
                
            }
          })
        }
      }) 
    }})

  };

  handleClickPolicy = (currPolicy) => {
    let id = ''
    if(typeof event.target.getAttribute('rowid') === 'string'){
      id = event.target.getAttribute('rowid')
    } else if (event._targetInst){
      if(typeof event._targetInst.pendingProps.rowid === 'string') {
        id = event._targetInst.pendingProps.rowid
      } else {
        id = event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid')
      }
    } else if (typeof event.target.ownerSVGElement.getAttribute('rowid') === 'string'){
      id = event.target.ownerSVGElement.getAttribute('rowid')
    } else {
      console.log(event)
      return
    }
    
    // _.each(this.props.hashFiles,(hashFile) => {
    //   if(hashFile._id === id){
    //     currPolicy = hashFile.passwordPolicy
    //   }
    // })
    //passwordPolicy
    // let id = event.target.getAttribute('rowid') ? event.target.getAttribute('rowid') : (event._targetInst.pendingProps.rowid ? event._targetInst.pendingProps.rowid : event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid'))
    (async () => {
      const { value: advancedOptions } = await Swal.fire({
        title: 'Password Policy',
        html:
          '<h1 style="font-size:1rem; margin-top:.25rem;">Length Requirements:</h1>'+
          `<input type="checkbox" id="length_requirement" name="length_requirement" value="length_requirement" ${currPolicy.hasLengthRequirement === true ? "checked" : null}><p style="display:inline-block;">At least&nbsp</p><input size="1" type="text" pattern="[0-9]*" id="minimum_length" name="minimum_length" value="${currPolicy.lengthRequirement}"><p style="display:inline-block;">&nbspcharacters</p><br/>`+
          '<h1 style="font-size:1rem; margin-top:.25rem;">Complexity Requirements:</h1>'+
          `<p style="display:inline-block;">At least&nbsp</p><input size="1" type="text" pattern="[1,2,3,4]" id="count_complexity_required" name="count_complexity_required" value="${currPolicy.complexityRequirement}"><p style="display:inline-block;">&nbspof the following categories met</p><br/>`+
          `<input type="checkbox" id="uppercase_requirement" name="uppercase_requirement" value="uppercase_requirement" ${currPolicy.hasUpperRequirement === true ? "checked" : null}><p style="display:inline-block;">At least&nbsp</p><input size="1" type="text" pattern="[0-9]*" id="count_upper_required" name="count_upper_required" value="${currPolicy.upperRequirement}"><p style="display:inline-block;">&nbspuppercase characters</p><br/>`+
          `<input type="checkbox" id="lowercase_requirement" name="lowercase_requirement" value="lowercase_requirement" ${currPolicy.hasLowerRequirement === true ? "checked" : null}><p style="display:inline-block;">At least&nbsp</p><input size="1" type="text" pattern="[0-9]*" id="count_lower_required" name="count_lower_required" value="${currPolicy.lowerRequirement}"><p style="display:inline-block;">&nbsplowercase characters</p><br/>`+
          `<input type="checkbox" id="symbols_requirement" name="symbols_requirement" value="symbols_requirement" ${currPolicy.hasSymbolsRequirement === true ? "checked" : null}><p style="display:inline-block;">At least&nbsp</p><input size="1" type="text" pattern="[0-9]*" id="count_symbols_required" name="count_symbols_required" value="${currPolicy.symbolsRequirement}"><p style="display:inline-block;">&nbspspecial characters</p><br/>`+
          `<input type="checkbox" id="numbers_requirement" name="numbers_requirement" value="numbers_requirement" ${currPolicy.hasNumberRequirement === true ? "checked" : null}><p style="display:inline-block;">At least&nbsp</p><input size="1" type="text" pattern="[0-9]*" id="count_numbers_required" name="count_numbers_required" value="${currPolicy.numberRequirement}"><p style="display:inline-block;">&nbspnumerical characters</p><br/>`+
          '<h1 style="font-size:1rem; margin-top:.25rem;">Additional Checks:</h1>'+
          `<input type="checkbox" id="no_username_in_password" name="no_username_in_password" value="no_username_in_password" ${currPolicy.hasUsernameRequirement === true ? "checked" : null}><p style="display:inline-block;">Check for username in password</p><br/>`,
        focusConfirm: false,
        preConfirm: () => {
          return {
            complexityRequirement:parseInt(document.getElementById('count_complexity_required').value,10),
            hasLengthRequirement:document.getElementById('length_requirement').checked,
            lengthRequirement:parseInt(document.getElementById('minimum_length').value,10),
            hasUpperRequirement:document.getElementById('uppercase_requirement').checked,
            upperRequirement:parseInt(document.getElementById('count_upper_required').value,10),
            hasLowerRequirement:document.getElementById('lowercase_requirement').checked,
            lowerRequirement:parseInt(document.getElementById('count_lower_required').value,10),
            hasSymbolsRequirement:document.getElementById('symbols_requirement').checked,
            symbolsRequirement:parseInt(document.getElementById('count_symbols_required').value,10),
            hasNumberRequirement:document.getElementById('numbers_requirement').checked,
            numberRequirement:parseInt(document.getElementById('count_numbers_required').value,10),
            hasUsernameRequirement:document.getElementById('no_username_in_password').checked
          }
        }
      })
      if(advancedOptions) {
        Meteor.call('configurePasswordPolicy', id, advancedOptions, (err)=>{
          if(err){
            Swal.fire({
              title: 'Configure Policy Failed',
              type: 'error',
              timer:3000,
              toast:true,
              position:'top-right',
              animation:false,
            })
          }
          else {
            Swal.fire({
              title: 'Configure Policy Success',
              type: 'success',
              timer:3000,
              toast:true,
              position:'top-right',
              animation:false,
            })
          }
        })
      }
    })();
    return
  };

  handleClickCrack = () => {
    let id = ''
    if(typeof event.target.getAttribute('rowid') === 'string'){
      id = event.target.getAttribute('rowid')
    } else if (event._targetInst){
      if(typeof event._targetInst.pendingProps.rowid === 'string') {
        id = event._targetInst.pendingProps.rowid
      } else {
        id = event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid')
      }
    } else if (typeof event.target.ownerSVGElement.getAttribute('rowid') === 'string'){
      id = event.target.ownerSVGElement.getAttribute('rowid')
    } else {
      console.log(event)
      return
    }
    let ids = [];
    ids.push(id);
    // console.log(ids)
    // return
    let instanceType = '';
    let duration = 1;
    // Before cracking hashes... we ned to ask a few questions (instance type decision, maximum price willing to pay/hour, time to run (in hours) )
    // First refresh the known spot prices...
    Swal.fire({
        title: 'Retrieving Price Data',
        text: 'Please wait while we retrieve the latest Spot Pricing information',
        type: 'info',
        animation:false,
        showConfirmButton:false,
      })
    Meteor.call('getSpotPricing', (err, res)=>{
        if(err){
          Swal.fire({
            title: 'Spot Price Check Failed',
            text:err.details,
            type: 'error',
            animation:false,
            showConfirmButton:true,
          })
        }
        else {
          Swal.fire({
            title: 'Updating Pricing Data',
            html: 'Please wait...',
            type: 'success',
            onBeforeOpen: () => {
              Swal.showLoading()
            },
            animation:false,
            showConfirmButton:false,
            confirmButtonText:"Continue",
            timerProgressBar:true,
            timer:2000
          }).then(() => {
            let inputOptions = {
            }
            for (let [key, value] of Object.entries(this.props.awsPricing[0].data)) {
              if(key === 'p3_2xl'){
                  inputOptions.p3_2xl = `${key} - $${value.cheapest}/hr (${value.az})`
              } 
              else if(key === 'p3_8xl'){
                  inputOptions.p3_8xl = `${key} - $${value.cheapest}/hr (${value.az})`
              } 
              else if(key === 'p3_16xl'){
                  inputOptions.p3_16xl = `${key} - $${value.cheapest}/hr (${value.az})`
              } 
              // else if(key === 'p3dn_24xl'){
              //     inputOptions.p3dn_24xl = `${key} - $${value.cheapest}/hr (${value.az})`
              // } 
            } 
            Swal.fire({
              title: 'Select an Instance Type',
              input: 'select',
              inputOptions: inputOptions,
              inputPlaceholder: 'Instance Type',
              showCancelButton: true,
            }).then((result) => {
              if (result.value) {
                  let rate = ''
                  if(result.value === 'p3_2xl'){
                      rate = this.props.awsPricing[0].data.p3_2xl.cheapest
                  } 
                  else if(result.value === 'p3_8xl'){
                      rate = this.props.awsPricing[0].data.p3_8xl.cheapest
                  } 
                  else if(result.value === 'p3_16xl'){
                      rate = this.props.awsPricing[0].data.p3_16xl.cheapest
                  } 
                  // else if(result.value === 'p3dn_24xl'){
                  //     rate = this.props.awsPricing[0].data.p3dn_24xl.cheapest
                  // } 
                  instanceType = result.value;
                  // Here is the more detailed prompt for no redaction/class level/length
                  (async () => {
                    const { value: formValues } = await Swal.fire({
                      title: 'Redaction Settings',
                      html:
                        '<br/><p>Please choose a level of redaction<br/>Example: if the pasword is Summer2019!</p>'+
                        '<table style="width:100%"><tr><th>Redaction Level</th><th>Results sent out of EC2 instance</th></tr>'+
                        '<tr><td><input type="radio" id="redaction_none" name="redaction" value="redaction_none" checked><label for="redaction_none">&nbspNone</label></td><td>Summer2019!</td></tr>'+
                        '<tr><td><input type="radio" id="redaction_character" name="redaction" value="redaction_character"><label for="redaction_character">&nbspCharacter</label></td><td>Ulllll0000*</td></tr>'+
                        '<tr><td><input type="radio" id="redaction_length" name="redaction" value="redaction_length"><label for="redaction_length">&nbspLength</label></td><td>**********</td></tr>'+
                        '<tr><td><input type="radio" id="redaction_full" name="redaction" value="redaction_full"><label for="redaction_full">&nbspFull</label></td><td>cracked</td></tr></table>'+
                        '<br/><input type="checkbox" id="advanced_options" name="advancedOptions"><label for="advanced_options">&nbspConfigure Advanced Cracking Options</label>',                    
                      focusConfirm: false,
                      preConfirm: () => {
                        return {
                          redactionNone:document.getElementById('redaction_none').checked,
                          redactionCharacter:document.getElementById('redaction_character').checked,
                          redactionLength:document.getElementById('redaction_length').checked,
                          redactionFull:document.getElementById('redaction_full').checked,
                          configureAdvanced:document.getElementById('advanced_options').checked
                        }
                      }
                    })
                    if (formValues) {
                      // console.log(formValues)
                      let redactionText = ''
                      if(formValues.redactionNone){
                        redactionText = "No redaction will be performed prior to passwords leaving the EC2 instance"
                      } else if(formValues.redactionCharacter){
                        redactionText = "Character masking will occur prior to passwords leaving the EC2 instance."
                      } else if(formValues.redactionLength){
                        redactionText = "Passwords will be fully masked prior to leaving the EC2 instance."
                      } else if(formValues.redactionFull){
                        redactionText = "No form of password information will leave the EC2 instance, you will just know IF the password was able to be cracked."
                      } 
                      if(formValues.configureAdvanced){
                          const { value: advancedOptions } = await Swal.fire({
                            title: 'Advanced Configuration',
                            html:
                              '<input type="checkbox" id="use_dictionaries" name="dictionaries" value="use_dictionaries" checked><label for="use_dictionaries">&nbspPerform Dictionary Attack</label>'+
                              '<br/><input size="1" type="text" pattern="[0-9]*" id="brute_length" name="brute_length" value="7"><label for="brute_length">&nbspBrute Force Limit (0 to disable)</label>',
                            focusConfirm: false,
                            preConfirm: () => {
                              return {
                                dictionaries:document.getElementById('use_dictionaries').checked,
                                bruteforce:document.getElementById('brute_length').value
                              }
                            }
                          })
                        if(advancedOptions){
                          let advancedText = ''
                          if(advancedOptions.dictionaries && (advancedOptions.bruteforce === "0" || advancedOptions.bruteforce === "")){
                            advancedText = "dictionary attacks only"
                          } else if(!advancedOptions.dictionaries && !(advancedOptions.bruteforce === "0" || advancedOptions.bruteforce === "")){
                            advancedText = `brute force only (limit: ${advancedOptions.bruteforce} characters)`
                          } else {
                            let charLim = (advancedOptions.bruteforce !== "0" && advancedOptions.bruteforce !== "") ? advancedOptions.bruteforce : "7" 
                            advancedOptions.bruteforce = charLim
                            advancedOptions.dictionaries = true
                            advancedText = `dictionary and brute force attacks (limit: ${advancedOptions.bruteforce} characters)`
                          }
                          // console.log(advancedOptions)
                          Swal.fire({
                            title: 'Verify Choices before Queuing',
                            html: `<p>You have selected to perform cracking with an <b>${instanceType}</b> instance at a rate of <b>$${rate}/hr</b> using <b>${advancedText}</b></p>`+
                            `<p>In order to ensure that our bid is met we will add <b>$0.25</b> to the current spot price for a maximum hourly rate of <b>$${(parseFloat(rate)+.25).toFixed(2)}</b></p>`+
                            `<p><b>${redactionText}</b></p><p>If this is correct please press launch below, otherwise cancel</p>`,
                            type: 'warning',
                            animation:false,
                            showConfirmButton:true,
                            showCancelButton:true,
                            confirmButtonText:"Launch",        
                        }).then((result) =>{
                            if(result.value){
                              let location = ''
                              let rate = ''
                              if(instanceType === 'p3_2xl'){
                                  location = this.props.awsPricing[0].data.p3_2xl.az
                                  rate = this.props.awsPricing[0].data.p3_2xl.cheapest
                              } 
                              else if(instanceType === 'p3_8xl'){
                                  location = this.props.awsPricing[0].data.p3_8xl.az
                                  rate = this.props.awsPricing[0].data.p3_8xl.cheapest
                              } 
                              else if(instanceType === 'p3_16xl'){
                                  location = this.props.awsPricing[0].data.p3_16xl.az
                                  rate = this.props.awsPricing[0].data.p3_16xl.cheapest
                              } 
                              // else if(instanceType === 'p3dn_24xl'){
                              //     location = this.props.awsPricing[0].data.p3dn_24xl.az
                              //     rate = this.props.awsPricing[0].data.p3dn_24xl.cheapest
                              // } 
              
                                Meteor.call('crackHashes',{ids:ids,duration:duration,instanceType:instanceType, availabilityZone:location, rate:rate, maskingOption:formValues, useDictionaries:advancedOptions.dictionaries, bruteLimit:advancedOptions.bruteforce}, (err) =>   {
                                    if(typeof err !== 'undefined'){
                                      // If we had an error...
                                      Swal.fire({
                                      title: 'Could not crack hash files requested',
                                      type: 'error',
                                      showConfirmButton: false,
                                      toast:true,
                                      position:'top-right',
                                      timer:3000,
                                      animation:false,
                                      })
                                    } else {
                                      Swal.fire({
                                      title: 'hashes queued for cracking',
                                      type: 'success',
                                      showConfirmButton: false,
                                      toast:true,
                                      position:'top-right',
                                      timer:3000,
                                      animation:false,
                                      })
                                    }
                                })
                            }
                        })
                        }
                    
                      } else {
                        Swal.fire({
                          title: 'Verify Choices before Queuing',
                          html: `<p>You have selected to perform cracking with an <b>${instanceType}</b> instance at a rate of <b>$${rate}/hr</b></p>`+
                          `<p>In order to ensure that our bid is met we will add <b>$0.25</b> to the current spot price for a maximum hourly rate of <b>$${(parseFloat(rate)+.25).toFixed(2)}</b></p>`+
                          `<p><b>${redactionText}</b></p><p>If this is correct please press launch below, otherwise cancel</p>`,
                          type: 'warning',
                          animation:false,
                          showConfirmButton:true,
                          showCancelButton:true,
                          confirmButtonText:"Launch",        
                      }).then((result) =>{
                          if(result.value){
                            let location = ''
                            let rate = ''
                            if(instanceType === 'p3_2xl'){
                                location = this.props.awsPricing[0].data.p3_2xl.az
                                rate = this.props.awsPricing[0].data.p3_2xl.cheapest
                            } 
                            else if(instanceType === 'p3_8xl'){
                                location = this.props.awsPricing[0].data.p3_8xl.az
                                rate = this.props.awsPricing[0].data.p3_8xl.cheapest
                            } 
                            else if(instanceType === 'p3_16xl'){
                                location = this.props.awsPricing[0].data.p3_16xl.az
                                rate = this.props.awsPricing[0].data.p3_16xl.cheapest
                            } 
                            // else if(instanceType === 'p3dn_24xl'){
                            //     location = this.props.awsPricing[0].data.p3dn_24xl.az
                            //     rate = this.props.awsPricing[0].data.p3dn_24xl.cheapest
                            // } 
            
                              Meteor.call('crackHashes',{ids:ids,duration:duration,instanceType:instanceType, availabilityZone:location, rate:rate, maskingOption:formValues,useDictionaries:true, bruteLimit:"7"}, (err) =>   {
                                  if(typeof err !== 'undefined'){
                                    // If we had an error...
                                    Swal.fire({
                                    title: 'Could not crack hash files requested',
                                    type: 'error',
                                    showConfirmButton: false,
                                    toast:true,
                                    position:'top-right',
                                    timer:3000,
                                    animation:false,
                                    })
                                  } else {
                                    Swal.fire({
                                    title: 'hashes queued for cracking',
                                    type: 'success',
                                    showConfirmButton: false,
                                    toast:true,
                                    position:'top-right',
                                    timer:3000,
                                    animation:false,
                                    })
                                  }
                              })
                          }
                      })
                      }
                      
                    }
                  })();
                  
              }
            })
          })
          
        }
      }) 
    return
    
  };

  handleImportExport = (event) => {
    let id = ''
    if(typeof event.target.getAttribute('rowid') === 'string'){
      id = event.target.getAttribute('rowid')
    } else if (event._targetInst){
      if(typeof event._targetInst.pendingProps.rowid === 'string') {
        id = event._targetInst.pendingProps.rowid
      } else {
        id = event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid')
      }
    } else if (typeof event.target.ownerSVGElement.getAttribute('rowid') === 'string'){
      id = event.target.ownerSVGElement.getAttribute('rowid')
    } else {
      console.log(event)
      return
    }    // console.log(id)
    // console.log(event.target.getAttribute('rowid'))
    // console.log(event._targetInst.pendingProps.rowid)
    // console.log(event._targetInst.stateNode.ownerSVGElement.getAttribute('rowid'))
    // return
    // let ids = this.getIdsFromSelection();
    Swal.fire({
      title: 'Choose Export Type',
      input: 'select',
      // inputOptions: {
      //   apples: 'Apples',
      //   bananas: 'Bananas',
      //   grapes: 'Grapes',
      //   oranges: 'Oranges'
      // },
      inputOptions: {
        exportUncracked:"Export Uncracked Hashes (hashcat)",
        exportCracked: "Export Cracked Hashes (hashcat)",
        exportAllDataJSON: "Export all Hashes (JSON)"
      },
      inputPlaceholder: '',
      showCancelButton: true,
    }).then((result) => {
      if (result.value === "exportUncracked") {
        // find all cracked hashes and create output of HASH:Plaintext
        let uncrackedHashes = Hashes.find({ $and: [{'meta.source':`${id}`},{'meta.cracked':{$not: true}}] },{'fields':{'data':1,'meta.type':1 }}).fetch()
        let dataToDownloadLM = ''
        let dataToDownloadNTLM = ''
        let dataToDownloadNTLMv2 = ''
        _.forEach(uncrackedHashes,(hash) => {
          if(hash.meta.type === "LM"){
            dataToDownloadLM +=  `${hash.data}\r\n`
          } else if(hash.meta.type === "NTLM") {
            dataToDownloadNTLM +=  `${hash.data}\r\n`
          } else if(hash.meta.type === "NTLMv2") {
            dataToDownloadNTLMv2 +=  `:::${hash.data.trim()}\r\n`
          }
          
        })
        if(dataToDownloadLM.length > 2) {
          var element = document.createElement('a');
          element.setAttribute('href', 'data:text/plaintext;charset=utf-8,' + encodeURIComponent(dataToDownloadLM));
          element.setAttribute('download', `${id}-Uncracked.lm`);

          element.style.display = 'none';
          document.body.appendChild(element);

          element.click();

          document.body.removeChild(element);
        }
        if(dataToDownloadNTLM.length > 2) {
          var element = document.createElement('a');
          element.setAttribute('href', 'data:text/plaintext;charset=utf-8,' + encodeURIComponent(dataToDownloadNTLM));
          element.setAttribute('download', `${id}-Uncracked.ntlm`);

          element.style.display = 'none';
          document.body.appendChild(element);

          element.click();

          document.body.removeChild(element);
        }
        if(dataToDownloadNTLMv2.length > 2) {
          var element = document.createElement('a');
          element.setAttribute('href', 'data:text/plaintext;charset=utf-8,' + encodeURIComponent(dataToDownloadNTLMv2));
          element.setAttribute('download', `${id}-Uncracked.ntlmv2`);

          element.style.display = 'none';
          document.body.appendChild(element);

          element.click();

          document.body.removeChild(element);
        }
         
        
      } else if (result.value === "exportCracked"){
        // only single file supported
        // find all cracked hashes and create output of HASH:Plaintext
        let crackedHashesNTLM = Hashes.find({ $and: [{'meta.source':`${id}`},{'meta.cracked': true},{'meta.type':"NTLM"}] },{'fields':{'data':1,'meta.plaintext':1 }}).fetch()
        let crackedHashesLM = Hashes.find({ $and: [{'meta.source':`${id}`},{'meta.cracked': true},{'meta.type':"LM"}] },{'fields':{'data':1,'meta.plaintext':1 }}).fetch()
        // console.log(crackedHashes)
        if(crackedHashesNTLM.length > 0){
          let crackedHashes = crackedHashesNTLM
          let dataToDownload = ''
          _.forEach(crackedHashes,(hash) => {
            console.log(hash)
            dataToDownload +=  `${hash.data.trim()}:${hash.meta.plaintext.trim()}\r\n`
          })
          // console.log(dataToDownload)
          var element = document.createElement('a');
          element.setAttribute('href', 'data:text/plaintext;charset=utf-8,' + encodeURIComponent(dataToDownload));
          element.setAttribute('download', `${id}-cracked-hashes-ntlm.potfile`);
  
          element.style.display = 'none';
          document.body.appendChild(element);
  
          element.click();
  
          document.body.removeChild(element);
        }
        if(crackedHashesLM.length > 0){
          let crackedHashes = crackedHashesLM
          let dataToDownload = ''
          _.forEach(crackedHashes,(hash) => {
            console.log(hash)
            dataToDownload +=  `${hash.data.trim()}:${hash.meta.plaintext.trim()}\r\n`
          })
          // console.log(dataToDownload)
          var element = document.createElement('a');
          element.setAttribute('href', 'data:text/plaintext;charset=utf-8,' + encodeURIComponent(dataToDownload));
          element.setAttribute('download', `${id}-cracked-hashes-lm.potfile`);
  
          element.style.display = 'none';
          document.body.appendChild(element);
  
          element.click();
  
          document.body.removeChild(element);
        }
        
      } else if (result.value === "exportAllDataJSON"){
        let hashes = Hashes.find({ $and: [{'meta.source':`${id}`}]},{fields:{'meta.source':0}}).fetch()
        _.each(hashes, (hash) => {
          let hashUsernames = hash.meta.username[id]
          delete hash.meta.username
          hash.meta.usernames = hashUsernames
        })
        let hashFile = HashFiles.findOne({"_id":id},{fields:{'uploadStatus':0}})
        let data = {
          hashFile: hashFile,
          hashes: hashes
        }
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data)));
        element.setAttribute('download', `${hashFile.name}-${id}.json`);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);

      }
    })
  };

  render() {
    if (this.props.loggedIn && this.props.userReady ) {
      const getMuiTheme = () => createMuiTheme({
        overrides: {
          MUIDataTableHeadCell: {
            fixedHeader: {
              zIndex: 98
            }
          },
          MUIDataTable: {
            paper: {
            }
          }
        }
      });
      const columns = [
        {
          name:"_id",
          options:{
            display:false,
            filter:false,
          }
        },
        {
          name: "name",
          label:"File",
          options:{
            filter:false,
            customBodyRender: (value, tableMeta, updateValue) => {
              // console.log(tableMeta)
              let linkUrl = `/file/${tableMeta.rowData[0]}`
              return (
                <a href={linkUrl} target="_blank">{value}</a>
              );
            }  
          },
        },
        {
          name: "crackCount",
          label:"Hashes Cracked",
          options:{
            filter:false,
          },
        },
        {
          name: "distinctCount",
          label:"Different Hashes",
          options:{
            filter:false,
          },
        },
        {
          name: "hashCount",
          label:"Total Hashes",
          options:{
            filter:false,
          },
        },
        {
          name:"uploadDate",
          label:"Date Uploaded",
          options:{
            filter:false,
          },
        },
        {
          name:"actions",
          label:"Actions",
          options:{
            filter:false,
          },
        }      
      ];
  
      const hcjColumns = [
        {
          name:"uuid",
          label:"Job ID",
          options:{
            display:true,
            filter:false,
          }
        },
        {
          name: "status",
          label:"Status",
          options:{
            filter:true,
            customFilterListOptions: { render: v => `Status: ${v}`},
            filterOptions: {
              names: ['Job Completed/Paused', 'Job Processing'],
              logic(status, filterVal) {
                const show =
                  (filterVal.indexOf('Job Completed/Paused') >= 0 && (status.includes("Completed")||status.includes("Paused"))) ||
                  (filterVal.indexOf('Job Processing') >= 0 && !status.includes("Completed") && !status.includes("Paused"));
                return !show;
              },
            }
          },
        },
        // {
        //   name: "duration",
        //   label:"Duration",
        //   options:{
        //     filter:false,
        //   },
        // },
        {
          name: "instanceType",
          label:"Instance Type",
          options:{
            filter:false,
          },
        },
        {
          name:"availabilityZone",
          label:"Availability Zone",
          options:{
            filter:false,
          },
        },
        {
          name:"actions",
          label:"Actions",
          options:{
            filter:false,
          },
        }      
      ];
  

      let data = HashFiles.find().fetch();
      _.each(data,(item) => {
        item.uploadDate = item.uploadDate.toLocaleString().split(',')[0];
        item.actions = 
        <>
          <Tooltip rowid={item._id} title={"Attempt to Crack"}>
            <VPNKeyIcon  rowid={item._id} onClick={this.handleClickCrack} className="rotatedIcon" />
          </Tooltip>
          <Tooltip rowid={item._id} title={"Configure Password Policy"}>
            <PolicyIcon  rowid={item._id} onClick={() => {this.handleClickPolicy(item.passwordPolicy)}} />
          </Tooltip>
          <Tooltip rowid={item._id} title={"Export Hash Data"} >
            <ImportExportIcon rowid={item._id} onClick={this.handleImportExport}/>
          </Tooltip>
          <Tooltip rowid={item._id} title={"View Report"}>
            <Assessment rowid={item._id} className="rotatedIcon" onClick={this.handleClickReport} />
          </Tooltip>
        </>
      })
  
      let hcjData = HashCrackJobs.find().fetch();
      _.each(hcjData, (item) =>{
        if(typeof item.spotInstanceRequest !== 'undefined' && (item.status === "Hashes Uploaded" || item.status === "cancelled")){
          if(item.spotInstanceRequest.Status.Code === "pending-evaluation"){
            item.status = "Spot Request Pending"
          } 
          else if(item.spotInstanceRequest.Status.Code === "capacity-not-available"){
            if(item.status == "cancelled"){
              item.status = "Spot Request Cancelled due to Lack of Capacity"
            }else {
              item.status = "Spot Request Capacity Not Available, Cancelling"
            }
          }
          else if(item.spotInstanceRequest.Status.Code === "fulfilled"){
            item.status = "Upgrading and Installing Necessary Software"
          }
        }

        if(item.status.includes("remaining")) {
          item.actions = 
          <>
            <Tooltip rowid={item._id} title={"Pause Job"}>
              <PauseCircleFilledIcon  rowid={item._id} onClick={this.handleJobPause} />
            </Tooltip>
          </>   
        } else if(item.status === "Job Paused"){
          item.actions = 
          <>
            <Tooltip rowid={item._id} title={"Resume Job"}>
              <PlayCircleFilledIcon  rowid={item._id} onClick={this.handleJobResume} />
            </Tooltip>
          </>
        }
        
      })
      // _.each(data,(item) => {
      //   item.uploadDate = item.uploadDate.toLocaleString().split(',')[0];
      // })
  
      let innerColumns = [
        {
        name:"data",
        Label:"Hash",
        options:{
          display:true,
          filter:false,
        }
      },
      {
        name: "meta.type",
        label:"Type",
        options:{
          filter:true,
          sortDirection: 'desc',
        },
      },
      {
        name: "cracked",
        label:"Cracked",
        options:{
          filter:true,
        },
      },
    ];
      if (Roles.userIsInRole(Meteor.userId(), 'admin', Roles.GLOBAL_GROUP) === true) {
        innerColumns.push(
        {
          name: "meta.plaintext",
          label:"Password",
          options:{
            display:false,
            filter:false,
          },
        })
        innerColumns.push(
        {
          name: "meta.username",
          label:"Username",
          options:{
            display:false,
            filter:false,
          },
        })
        innerColumns.push(
        {
          name: "meta.lists",
          label:"Lists",
          options:{
            display:false,
            filter:false,
          },
        })
      }
      innerColumns.push(
      {
        name: "meta.inLists",
        label:"In Public List",
        options:{
          filter:true,
          sortDirection: 'desc',
        },
      })

      const options = {
        download:false,
        filter:false,
        print:false,
        viewColumns:false,
        expandableRows: false,
        expandableRowsOnClick: false,
        customToolbarSelect: (selectedRows, displayData, setSelectedRows) => (
          <CustomToolbarSelect selectedRows={selectedRows} displayData={displayData} setSelectedRows={setSelectedRows} pricing={this.props.awsPricing}  />
        ),
      };
  
      
      
      const hcjOptions = {
        download:false,
        filter:true,
        print:false,
        viewColumns:false,
        search:false,
        onRowClick: (rowData, rowState) => {

          if(rowData[1].toLowerCase().includes("configure spot instances")) {
            /* From AWS:
            By default, there is an account limit of 20 Spot Instances per Region. If you terminate your Spot Instance but do not cancel the request, the request counts against this limit until Amazon EC2 detects the termination and closes the request.
            Spot Instance limits are dynamic. When your account is new, your limit might be lower than 20 to start, but can increase over time. In addition, your account might have limits on specific Spot Instance types. If you submit a Spot Instance request and you receive the error Max spot instance count exceeded, you can complete the AWS Support Center Create case form to request a Spot Instance limit increase. For Limit type, choose EC2 Spot Instances. For more information, see Amazon EC2 Service Limits.
            */
           Swal.fire({
            title: 'Spot Request Limits',
            type: 'info',
            animation:false,
            html: 'Spot Instance limits are dynamic. When your account is new, your limit might be lower than 20 to start, but can increase over time. In addition,'+
                  ' your account might have limits on specific Spot Instance types. If you submit a Spot Instance request and you receive the error Max spot instance'+
                  ' count exceeded, you can complete the AWS Support Center Create case form to request a Spot Instance limit increase. For Limit type, choose EC2 Spot'+
                  ' Instances. For more information, see Amazon EC2 Service Limits.<br><br>'+
                  `In order for this request to work you will need to sign into your AWS console, click 'Support' in the top right and 'Support Center'`+
                  `Then 'Create case' and choose 'Service Limit Increase'. For 'Limit Type' choose 'EC2 Spot Instances' then request the each of the regions and choose instance `+
                  `type of ${rowData[3]} and choose a limit value of something greater than 0. Do this for each region that has the instance type in question (except GovCloud) and give a reason in you caae description and click submit<br><br>`+
                  `Once the request is submitted it can take 12-48 hours before the request is completed (though sometimes longer and sometimes shorter)`
          })
           
          }
        },
        customToolbarSelect: (selectedRows, displayData, setSelectedRows) => (
          <CustomToolbarSelectCrackJobs selectedRows={selectedRows} displayData={displayData} setSelectedRows={setSelectedRows}  />
        ),
      };

      return (
          <div style={{marginTop:'2%'}} className="landing-page">          
            {this.props.subsReady ? (
              <>
              <HashFileUploadStatus hashUploadJobs={this.props.hashFileUploadJobs} />
              <MUIDataTable
                className={"hashTable"}
                title={"Hash Files Uploads"}
                data={data}
                columns={columns}
                options={options}
              />
              <div className="break"></div>
              <MUIDataTable
                className={"hashCrackJobsTable"}
                title={"Hash Crack Jobs"}
                data={hcjData}
                columns={hcjColumns}
                options={hcjOptions}
              />
            </>
          ) : (
            <>
              <Spinner title={"Loading Hashes"} />
            </>
          ) }        

        </div>
      );
    }
    return (
      <div className="landing-page">
        <h1>Landing Page</h1>
      </div>
    );
  }
}

Landing.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
};

export default withTracker(() => {
  const hashFilesSub = Meteor.subscribe('hashFiles.all');
  const hashFiles = HashFiles.find().fetch();
  const hashCrackJobsSub = Meteor.subscribe('hashCrackJobs.all');
  const hashCrackJobs = HashCrackJobs.find().fetch();
  const hashFileUploadJobsSub = Meteor.subscribe('hashFileUploadJobs.all');
  const hashFileUploadJobs = HashFileUploadJobs.find().fetch()
  const awsPricingSub = Meteor.subscribe('aws.getPricing');
  const hashesSub = Meteor.subscribe('hashes.all');
  //const hashes = Hashes.find();
  const awsPricing = AWSCOLLECTION.find({type:'pricing'}).fetch();
  const subsReady = hashFilesSub.ready() && awsPricingSub.ready() && hashCrackJobsSub.ready() && hashesSub.ready() && hashFileUploadJobsSub.ready() && hashFiles && awsPricing && hashCrackJobs && hashFileUploadJobs;
  return {
    subsReady,
    hashFiles,
    awsPricing,
    hashCrackJobs,
    hashFileUploadJobs,
    //hashes,
  };
})(Landing);