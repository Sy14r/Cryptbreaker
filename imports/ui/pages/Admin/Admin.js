import React from 'react';
import Swal from 'sweetalert2'
import { withTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import { RequestedUsers } from '/imports/api/users/users.js';
import { AWSCOLLECTION } from '/imports/api/aws/aws.js';
import MUIDataTable from "mui-datatables";
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { JSONSchemaBridge } from 'uniforms-bridge-json-schema';
import { AutoForm } from 'uniforms-material';
import Ajv from 'ajv';
import _ from 'lodash';

import './Admin.scss';

class Admin extends React.Component {
  componentWillMount() {
    if (!this.props.loggedIn) {
      return this.props.history.push('/login');
    }
    return true;
  }

  shouldComponentUpdate(nextProps) {
    if (!nextProps.loggedIn) {
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

  render() {
    const columns = [
      {
        name: "email",
        label:"Email",
        options:{
          filter:false,
        },
      },
      {
        name: "status",
        label:"Status",
        options:{
          filter:true,
        },
      },
    ];

    const spotColumns = [
      {
        name:"instanceType",
        label:"Instance Type"
      },
      {
        name:"instancePrice",
        label:"Price/Hour"
      },
      {
        name:"instanceAZ",
        label:"Location"
      }
    ]

    let data = RequestedUsers.find().fetch();
    _.each(data,(item) => {
      if(item.approved){
        if(item.enabled){
          item.status = "Account Enabled";
        } else {
          item.status = "Account Disabled";
        }
      } else {
        item.status = "Pending Approval"
      }
      
    });

    let spotDataEntry = AWSCOLLECTION.find({type:'pricing'}).fetch()
    let spotData = []
    if(spotDataEntry.length > 0){
      if(typeof spotDataEntry.data !== "undefined") {
        if(spotDataEntry.length > 0){
          spotData.push({
            instanceType:"p3.2xlarge",
            instancePrice:`$${spotDataEntry[0].data.p3_2xl.cheapest}`,
            instanceAZ:spotDataEntry[0].data.p3_2xl.az,
          })
          spotData.push({
            instanceType:"p3.8xlarge",
            instancePrice:`$${spotDataEntry[0].data.p3_8xl.cheapest}`,
            instanceAZ:spotDataEntry[0].data.p3_8xl.az,
          })
          spotData.push({
            instanceType:"p3.16xlarge",
            instancePrice:`$${spotDataEntry[0].data.p3_16xl.cheapest}`,
            instanceAZ:spotDataEntry[0].data.p3_16xl.az,
          })
          spotData.push({
            instanceType:"p3dn.24xlarge",
            instancePrice:`$${spotDataEntry[0].data.p3dn_24xl.cheapest}`,
            instanceAZ:spotDataEntry[0].data.p3dn_24xl.az,
          })
        }
      }
    }    
    
    const spotOptions = {
      download:false,
      filter:false,
      viewColumns:false,
      print:false,
      selectableRows:"none"
    }

  
    const options = {
      download:false,
      filter:true,
      print:false,
      viewColumns:false,
      selectableRows:"none",
      onRowClick: (rowData, rowState) => {
        if(rowData[1] === "Pending Approval"){
          Swal.fire({
            title: 'Approve this account?',
            text: `Do you want to approve access for ${rowData[0]}`,
            type: 'question',
            confirmButtonText: 'Yes',
            showCancelButton:true,
            showCloseButton:true,
            cancelButtonText: 'No',
            animation:false,
          }).then((result) => {
            if (result.value) {
              Meteor.call('handleApproveAccountRequest',rowData[0],(err) => {
                if(typeof err !== 'undefined'){
                  // If we had an error...
                  Swal.fire({
                    title: 'ERROR:',
                    text: `Could not approve account for ${rowData[0]}`,
                    type: 'error',
                    showConfirmButton: false,
                    toast:true,
                    position:'top-right',
                    timer:3000,
                    animation:false,
                  })
                } else {
                  Swal.fire({
                    title: 'Approved! ',
                    text: ` ${rowData[0]}'s account has been approved`,
                    type: 'success',
                    showConfirmButton: false,
                    toast:true,
                    position:'top-right',
                    timer:3000,
                    animation:false,
                  })
                }
              })
              
            } else if(result.dismiss === "cancel"){
              Swal.fire({
                title: 'Reject this request?',
                text: `Do you want to reject access for ${rowData[0]}`,
                type: 'question',
                confirmButtonText: 'Yes',
                showCancelButton:true,
                showCloseButton:true,
                cancelButtonText: 'No',
                animation:false,
              }).then((result) => {
                if(result.value){
                  // We call method to remove this user from the pending requests entirely because it was rejected...
                  Meteor.call('rejectAccountRequest',rowData[0], (err) => {
                    if(typeof err !== 'undefined'){
                      // If we had an error...
                      Swal.fire({
                        title: '',
                        text: `Could not reject ${rowData[0]}`,
                        type: 'error',
                        showConfirmButton: false,
                        toast:true,
                        position:'top-right',
                        timer:3000,
                        animation:false,
                      })
                    } else {
                      Swal.fire({
                        title: '',
                        text: ` ${rowData[0]}'s account has been rejected`,
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
              });
            }
          })
        } 
        else if (rowData[1] === "Account Enabled"){
          Swal.fire({
            title: 'Disable this Account?',
            text: `Do you want to disable access for ${rowData[0]}`,
            type: 'question',
            confirmButtonText: 'Yes',
            showCancelButton:true,
            cancelButtonText: 'No',
            animation:false,
          }).then((result) => {
            if (result.value) {
              Meteor.call('toggleAccountValidity',rowData[0],(err) => {
                if(typeof err !== 'undefined'){
                  // If we had an error...
                  Swal.fire({
                    title: '',
                    text: `Could not disable account for ${rowData[0]}`,
                    type: 'error',
                    showConfirmButton: false,
                    toast:true,
                    position:'top-right',
                    timer:3000,
                    animation:false,
                  })
                } else {
                  Swal.fire({
                    title: '',
                    text: `${rowData[0]}'s account has been disabled`,
                    type: 'success',
                    showConfirmButton: false,
                    toast:true,
                    position:'top-right',
                    timer:3000,
                    animation:false,
                  })
                }
              })
              
            }})
        }
        else if (rowData[1] === "Account Disabled"){
          Swal.fire({
            title: 'Enable this Account?',
            text: `Do you want to enable access for ${rowData[0]}`,
            type: 'question',
            confirmButtonText: 'Yes',
            showCancelButton:true,
            cancelButtonText: 'No',
            animation:false,
          }).then((result) => {
            if (result.value) {
              Meteor.call('toggleAccountValidity',rowData[0],(err) => {
                if(typeof err !== 'undefined'){
                  // If we had an error...
                  Swal.fire({
                    title: '',
                    text: `Could not enable account for ${rowData[0]}`,
                    type: 'error',
                    showConfirmButton: false,
                    toast:true,
                    position:'top-right',
                    timer:3000,
                    animation:false,
                  })
                } else {
                  Swal.fire({
                    title: '',
                    text: `${rowData[0]}'s account has been enabled`,
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
            else if(result.dismiss === "cancel"){
              Swal.fire({
                title: 'Delete this account?',
                text: `Do you want to delete the account for ${rowData[0]}`,
                type: 'question',
                confirmButtonText: 'Yes',
                showCancelButton:true,
                showCloseButton:true,
                cancelButtonText: 'No',
                animation:false,
              }).then((result) => {
                if(result.value){
                  // We call method to remove this user from the pending requests entirely because it was rejected...
                  Meteor.call('deleteOtherAccount',rowData[0], (err) => {
                    if(typeof err !== 'undefined'){
                      // If we had an error...
                      Swal.fire({
                        title: '',
                        text: `Could not delete ${rowData[0]}`,
                        type: 'error',
                        showConfirmButton: false,
                        toast:true,
                        position:'top-right',
                        timer:3000,
                        animation:false,
                      })
                    } else {
                      Swal.fire({
                        title: '',
                        text: ` ${rowData[0]}'s account has been deleted`,
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
              });
            }})
        }
      },
    };
    
    if (this.props.loggedIn) {
      let schema = {
        title: 'Guest',
        type: 'object',
        properties: {
          accessKeyId: { 
            type: 'string', 
            defaultValue:'test', 
          },
          secretAccessKey: { 
            type: 'string',
            uniforms:{
              type:'password',
            }
          },
        },
        required: ['accessKeyId', 'secretAccessKey']
      };
      const ajv = new Ajv({ allErrors: true, useDefaults: true });
      function createValidator(schema) {
        const validator = ajv.compile(schema);
        return model => {
          validator(model);
          if (validator.errors && validator.errors.length) {
            throw { details: validator.errors };
          }
        };
      }
      const schemaValidator = createValidator(schema);


      const UpdateButton = () => {
        async function handleClick(e){
          e.preventDefault();
          let enteredKey = '';
          let enteredSecret = '';
          const {value: text} = await Swal.fire({
            title: 'Enter your AWS Access Key ID:',
            input: 'text',
            inputPlaceholder: 'Access Key ID'
          })
          
          if (text) {
            const {value: password} = await Swal.fire({
              title: 'Enter your AWS Secret Key:',
              input: 'password',
              inputPlaceholder: 'Secret Key'
            })
            if(password){
              let doc = {accessKeyId: text, secretAccessKey: password}
              Meteor.call('storeAWSCreds',doc, (err)=>{
                // console.log(err);
                if(err){
                  Swal.fire({
                    title: 'Update Failed',
                    text:err.details,
                    type: 'error',
                    timer:3000,
                    toast:true,
                    position:'top-right',
                    animation:false,
                    showConfirmButton:false,
                  })
                }
                else {
                  Swal.fire({
                    title: 'Update Successful',
                    type: 'success',
                    timer:3000,
                    toast:true,
                    position:'top-right',
                    animation:false,
                    showConfirmButton:false,
                  })
                }
              })
            }
          }
          
        }
        // console.log(this.props);
        return(
        <form className="form-inline my-2 my-lg-0" style={{paddingRight:'.5em'}}>
          <button className="btn btn-outline-secondary my-2 my-sm-0" onClick={handleClick} >
            Update AWS Settings
          </button>
        </form>
      )};
    
      const CheckPricingButton = () => {
        async function handleClick(e){
          e.preventDefault();
          Swal.fire({
            title: 'Retrieving Price Data',
            type: 'info',
            timer:3000,
            toast:true,
            position:'top-right',
            animation:false,
            showConfirmButton:false,
          })
          Meteor.call('getSpotPricing', (err, res)=>{
            if(err){
              Swal.fire({
                title: 'Update Failed',
                text:err.details,
                type: 'error',
                timer:3000,
                toast:true,
                position:'top-right',
                animation:false,
                showConfirmButton:false,
              })
            }
            else {
              Swal.fire({
                title: 'Pricing Data Updated',
                type: 'success',
                toast:true,
                position:'top-right',
                timer:3000,
                animation:false,
                showConfirmButton:false,
              })
            }
          })          
        }
        return(
        <form className="form-inline my-2 my-lg-0" style={{paddingRight:'.5em'}}>
          <button className="btn btn-outline-secondary my-2 my-sm-0" onClick={handleClick} >
            Refresh Spot Pricing
          </button>
        </form>
      )};
    
      return (
        <div className="admin-page">
          <MUIDataTable
            style={{minHeight:'300px'}}
            className={"usersTable"}
            title={"User Acounts"}
            data={data}
            columns={columns}
            options={options}
          />
          <div style={{marginLeft:'1em'}} className="MuiPaper-root MuiPaper-elevation4 MUIDataTable-paper-220 usersTable MuiPaper-rounded">
            <div className="MuiToolbar-root MuiToolbar-regular MUIDataTableToolbar-root-437 MuiToolbar-gutters" role="toolbar" aria-label="Table Toolbar">
            { this.props.awsCreds.length > 0 ? (
              <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',alignItems:'center',marginTop:'2em',width:'100%',marginLeft:'0px',paddingLeft:'0px'}}>
                <h6 style={{paddingTop:'1em', paddingBottom:'0px'}} className="MuiTypography-root MUIDataTableToolbar-titleText-441 MuiTypography-h6">Access Key ID: {this.props.awsCreds[0].accessKeyId}</h6>
                <div className="break"></div>
                <UpdateButton />
                <CheckPricingButton />
              </div>
              ) : 
            (<><h6 className="MuiTypography-root MUIDataTableToolbar-titleText-441 MuiTypography-h6">Configure AWS Secrets</h6><AutoForm style={{margin:'.5em'}} schema={new JSONSchemaBridge(schema,schemaValidator)} onSubmit={doc => Meteor.call('storeAWSCreds',doc, (err)=>{
              if(err){
                Swal.fire({
                  title: 'Update Failed',
                  type: 'error',
                  timer:3000,
                  toast:true,
                  position:'top-right',
                  animation:false,
                })
              }
              else {
                Swal.fire({
                  title: 'Update Successful',
                  type: 'success',
                  timer:3000,
                  toast:true,
                  position:'top-right',
                  animation:false,
                })
              }
            })} /></>)}
            </div>
          </div>         
          <MUIDataTable
            style={{minHeight:'300px'}}
            className={"spotPriceTable"}
            title={"Spot Pricing"}
            data={spotData}
            columns={spotColumns}
            options={spotOptions}
          /> 
        </div>
        
      );

    }
    return (
      <div className="admin-page">
        <h1>Landing Page</h1>
      </div>
    );
  }
}

Admin.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
};

// export default Admin;

export default withTracker(() => {
  // sub and get pendingUsers
  const pendingUsersSub = Meteor.subscribe('users.pending');
  const pendingUsers = RequestedUsers.find().fetch();
  // sub and get aws creds
  const awsCredsSub = Meteor.subscribe('aws.getCreds');
  const awsPricingSub = Meteor.subscribe('aws.getPricing');
  const awsPricing = AWSCOLLECTION.find({type:'pricing'}).fetch();
  const awsCreds = AWSCOLLECTION.find({type:'creds'}).fetch();
  const adminPageReady = pendingUsersSub.ready() && awsCredsSub.ready() && awsPricingSub.ready() && !!awsCreds &&  !!awsPricing && !!pendingUsers;
  return {
    // remote example (if using ddp)
    // usersReady,
    // users,
    adminPageReady,
    pendingUsers,
    awsCreds,
    awsPricing,
  };
})(Admin);