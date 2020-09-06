import React from "react";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import VPNKeyIcon from "@material-ui/icons/VpnKey";
import Assessment from "@material-ui/icons/Assessment";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import ImportExportIcon from "@material-ui/icons/ImportExportRounded"
import { withStyles } from "@material-ui/core/styles";
import { Hashes, HashFiles, HashCrackJobs } from '/imports/api/hashes/hashes.js';
import Swal from 'sweetalert2'

const defaultToolbarSelectStyles = {
  iconButton: {
  },
  iconContainer: {
    marginRight: "24px",
  },
  inverseIcon: {
    transform: "rotate(90deg)",
  },
};

class CustomToolbarSelect extends React.Component {

  getIdsFromSelection(){
    let ids = []
    _.each(this.props.selectedRows.data, (selection) => {
        ids.push(this.props.displayData[selection.index].data[0])
    })
    return ids;
  }

  handleClickCrack = () => {
    let ids = this.getIdsFromSelection();
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
            title: 'Pricing Data Updated',
            text:this.props.pricing[0].data,
            type: 'success',
            animation:false,
            showConfirmButton:true,
            confirmButtonText:"Continue",
          })
          let inputOptions = {
          }
          for (let [key, value] of Object.entries(this.props.pricing[0].data)) {
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
            // Not adding p3dn_24xl since its not available at spot pricing currently
            // else if(key === 'p3dn_24xl'){
            //     inputOptions.p3dn_24xl = `${key} - $${value.cheapest}/hr (${value.az})`
            // } 
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
                    rate = this.props.pricing[0].data.p3_2xl.cheapest
                } 
                else if(result.value === 'p3_8xl'){
                    rate = this.props.pricing[0].data.p3_8xl.cheapest
                } 
                else if(result.value === 'p3_16xl'){
                    rate = this.props.pricing[0].data.p3_16xl.cheapest
                } 
                // else if(result.value === 'p3dn_24xl'){
                //     rate = this.props.pricing[0].data.p3dn_24xl.cheapest
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
                                location = this.props.pricing[0].data.p3_2xl.az
                                rate = this.props.pricing[0].data.p3_2xl.cheapest
                            } 
                            else if(instanceType === 'p3_8xl'){
                                location = this.props.pricing[0].data.p3_8xl.az
                                rate = this.props.pricing[0].data.p3_8xl.cheapest
                            } 
                            else if(instanceType === 'p3_16xl'){
                                location = this.props.pricing[0].data.p3_16xl.az
                                rate = this.props.pricing[0].data.p3_16xl.cheapest
                            } 
                            // else if(instanceType === 'p3dn_24xl'){
                            //     location = this.props.pricing[0].data.p3dn_24xl.az
                            //     rate = this.props.pricing[0].data.p3dn_24xl.cheapest
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
                              location = this.props.pricing[0].data.p3_2xl.az
                              rate = this.props.pricing[0].data.p3_2xl.cheapest
                          } 
                          else if(instanceType === 'p3_8xl'){
                              location = this.props.pricing[0].data.p3_8xl.az
                              rate = this.props.pricing[0].data.p3_8xl.cheapest
                          } 
                          else if(instanceType === 'p3_16xl'){
                              location = this.props.pricing[0].data.p3_16xl.az
                              rate = this.props.pricing[0].data.p3_16xl.cheapest
                          } 
                          // else if(instanceType === 'p3dn_24xl'){
                          //     location = this.props.pricing[0].data.p3dn_24xl.az
                          //     rate = this.props.pricing[0].data.p3dn_24xl.cheapest
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
        }
      }) 
    return
    
  };

  handleClickDelete = () => {
    let ids = this.getIdsFromSelection();
    Meteor.call('deleteHashes',ids, (err) =>   {
      if(typeof err !== 'undefined'){
        // If we had an error...
        Swal.fire({
          title: 'Could not delete hash files requested',
          type: 'error',
          showConfirmButton: false,
          toast:true,
          position:'top-right',
          timer:3000,
          animation:false,
        })
      } else {
        Swal.fire({
          title: 'hashes deleted',
          type: 'success',
          showConfirmButton: false,
          toast:true,
          position:'top-right',
          timer:3000,
          animation:false,
        })
      }
    })
  };

  handleClickReport = () => {
    let ids = this.getIdsFromSelection();
    let id = ids.join('.')
    // window.location.href = `/report/${id}`
    window.open(`/report/${id}`)
  };

  render() {
    const { classes } = this.props;

    return (
      <div className={classes.iconContainer}>
        <Tooltip title={"Attempt to Crack"}>
          <IconButton className={classes.iconButton} onClick={this.handleClickCrack}>
            <VPNKeyIcon className={[classes.icon, classes.inverseIcon].join(" ")} />
          </IconButton>
        </Tooltip>
        <Tooltip title={"Delete"}>
          <IconButton className={classes.iconButton} onClick={this.handleClickDelete}>
            <DeleteOutlineIcon className={classes.icon} />
          </IconButton>
        </Tooltip>
      </div>
    );
  }
}

export default withStyles(defaultToolbarSelectStyles, { name: "CustomToolbarSelect" })(CustomToolbarSelect);