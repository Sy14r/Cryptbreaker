import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import React from 'react';
import PropTypes from 'prop-types';
import MUIDataTable from "mui-datatables";
import { Roles } from 'meteor/alanning:roles';
import Swal from 'sweetalert2'
import { AWSCOLLECTION } from '/imports/api/aws/aws.js'
import { APICollection } from '/imports/api/api/api.js'
import Spinner from '/imports/ui/components/Spinner';
import Modal, { Button } from '../../components/Modal/Modal';
import AddCountButton from '../../components/Button';
import Text from '../../components/Text';

import './Profile.scss';
import CustomAPIKeySelect from './CustomAPIKeySelect.js';
import CustomAPIToolbar from './CustomAPIToolbar.js';


class Profile extends React.Component {
  componentWillMount() {
    if (!this.props.loggedIn) {
      return this.props.history.push('/login');
    }
  }

  shouldComponentUpdate(nextProps) {
    if (!nextProps.loggedIn) {
      nextProps.history.push('/login');
      return false;
    }
    return true;
  }
  
  deleteAccount() {
    Meteor.call('deleteAccount', (err) => {
      if(typeof err !== 'undefined'){
        console.log(`Encountered error in deleteAccount: ${err}`);
      }
    });
  }

  

  initialConfigurationWalkthrough() {
    function awsCredsPrompt() {
      (async () => {
        const { value: formValues } = await Swal.fire({
          title: 'AWS CLI Credentials',
          html:
            '<br/><p>For help see <a href="https://aws.amazon.com/premiumsupport/knowledge-center/create-access-key/">this link</a> about generating AWS Access Keys</p>' +
            '<input id="swal-input1" class="swal2-input" placeholder="Access Key">' +
            '<input id="swal-input2" type="password" class="swal2-input" placeholder="Secret Key">' +
            '<p><b>Note:</b> This tool has only been tested with Access Keys for a root account. If you want to experiment with limiting permissions feel free but functionality/use may have unintended consequences</p>',
          focusConfirm: false,
          preConfirm: () => {
            return [
              document.getElementById('swal-input1').value,
              document.getElementById('swal-input2').value
            ]
          }
        })
        if (formValues) {
          let doc = {accessKeyId: formValues[0], secretAccessKey: formValues[1]}
            Meteor.call('storeAWSCreds',doc, (err)=>{
              // console.log(err);
              if(err){
                Swal.fire({
                  title: 'Update Failed',
                  text:err.details,
                  type: 'error',
                  animation:false,
                  showConfirmButton:true,
                  confirmButtonText:"Retry Installation"
                }).then((result) => {
                  if(result.value){
                    awsCredsPrompt()
                  }
                })
              }
              else {
                console.log("FIRING HERE")
                Swal.fire({
                  title: 'Update Successful',
                  text:"Your AWS Credentials have been validated, the next step is to configure the IAM Roles and S3 bucket to enable automated cracking",
                  type: 'success',
                  animation:false,
                  showConfirmButton:true,
                  confirmButtonText:"Configure Dependencies"
                }).then((result) => {
                  Swal.fire({
                    title: 'Configuring Resources...',
                    text:"Please wait while we configure settings in AWS... (this message will close itself when this is done)",
                    type: 'info',
                    animation:false,
                    showConfirmButton:false,  
                  })
                  Meteor.call('configureAWSResources', (err)=>{
                    console.log(err);
                  })
                })
              }
            })
        }
      })();
    }
    Swal.fire({
      title: 'Complete Installation',
      type: 'info',
      animation:false,
      confirmButtonText:"Continue"
    }).then((result) => {
      if(result.value){
        awsCredsPrompt()
      }
    })
  }

  render() {
    const {
      loggedIn,
      // remote example (if using ddp)
      // usersReady,
      // users,
    } = this.props;

    // eslint-disable-line
    // remote example (if using ddp)
    /*
    console.log('usersReady', usersReady);
    console.log('users', users);
    */
    if (!loggedIn) {
      return null;
    }
    let columns = [
      {
        name:"instanceType",
        label:"Instance Type",
        options:{
          display:true,
          filter:false,
        }
      },  
      {
        name:"crackRateLM",
        label:"LM Crack Rate",
        options:{
          display:true,
          filter:false,
        }
      }, 
      {
        name:"crackRateNTLM",
        label:"NTLM Crack Rate",
        options:{
          display:true,
          filter:false,
        }
      }, 
      {
        name:"bestFor",
        label:"Most Cost Efficient",
        options:{
          display:true,
          filter:false,
        }
      },    
    ];
    const options = {
      download:false,
      filter:false,
      print:false,
      viewColumns:false,
      selectableRows:"none",
      search:false
    }
    const apiKeyOptions = {
      download:false,
      filter:false,
      print:false,
      viewColumns:false,
      selectableRows:"none",
      search:false,
      customToolbar: () => {
        return (
          <CustomAPIToolbar />
        );
      },
      customToolbarSelect: (selectedRows, displayData, setSelectedRows) => (
        <CustomAPIKeySelect selectedRows={selectedRows} displayData={displayData} setSelectedRows={setSelectedRows} />
      ),
    }
    let data = [
      {
        instanceType:"p3.2xlarge",
        crackRateLMNumber:45.4,
        crackRateLM: "45.4 GH/s",
        crackRateNTLMNumber:77.5,
        crackRateNTLM: "77.5 GH/s",
        bestFor: "unknown",
      },
      {
        instanceType:"p3.8xlarge",
        crackRateLMNumber:181.3,
        crackRateLM: "181.3 GH/s",
        crackRateNTLMNumber:308.1,
        crackRateNTLM: "308.1 GH/s",
        bestFor: "unknown",
      },
      {
        instanceType:"p3.16xlarge",
        crackRateLMNumber:361.5,
        crackRateLM: "361.5 GH/s",
        crackRateNTLMNumber:586.9,
        crackRateNTLM: "586.9 GH/s",
        bestFor: "unknown",
      },
    ]
    if(this.props.awsPricing.length > 0 && typeof this.props.awsPricing[0].data !== 'undefined'){
      // Need to calculate best LM and best NTLM (and ultimately other hash types...)
      let bestLM = {rate:1000, name:""}
      let bestNTLM = {rate:1000, name:""}
      let p3_2xlPrice = parseFloat(this.props.awsPricing[0].data.p3_2xl.cheapest)
      let p3_8xlPrice = parseFloat(this.props.awsPricing[0].data.p3_8xl.cheapest)
      let p3_16xlPrice = parseFloat(this.props.awsPricing[0].data.p3_16xl.cheapest)
      _.each(data, (dataPoint) => {
        if(dataPoint.instanceType === "p3.2xlarge"){
          let lmRate = p3_2xlPrice/dataPoint.crackRateLMNumber
          let ntlmRate = p3_2xlPrice/dataPoint.crackRateNTLMNumber
          if (lmRate < bestLM.rate){
            bestLM.rate = lmRate
            bestLM.name = dataPoint.instanceType
          }
          if (ntlmRate < bestNTLM.rate){
            bestNTLM.rate = ntlmRate
            bestNTLM.name = dataPoint.instanceType
          }
        } else if(dataPoint.instanceType === "p3.8xlarge"){
          let lmRate = p3_8xlPrice/dataPoint.crackRateLMNumber
          let ntlmRate = p3_8xlPrice/dataPoint.crackRateNTLMNumber
          if (lmRate < bestLM.rate){
            bestLM.rate = lmRate
            bestLM.name = dataPoint.instanceType
          }
          if (ntlmRate < bestNTLM.rate){
            bestNTLM.rate = ntlmRate
            bestNTLM.name = dataPoint.instanceType
          }
        } else if(dataPoint.instanceType === "p3.16xlarge"){
          let lmRate = p3_16xlPrice/dataPoint.crackRateLMNumber
          let ntlmRate = p3_16xlPrice/dataPoint.crackRateNTLMNumber
          if (lmRate < bestLM.rate){
            bestLM.rate = lmRate
            bestLM.name = dataPoint.instanceType
          }
          if (ntlmRate < bestNTLM.rate){
            bestNTLM.rate = ntlmRate
            bestNTLM.name = dataPoint.instanceType
          }
        }
      })
      // After determining the best LM and NTLM options time to update
      _.each(data, (dataPoint) => {
        dataPoint.bestFor = ""
        if(bestLM.name === dataPoint.instanceType) {
          dataPoint.bestFor = "LM"
        }
        if(bestNTLM.name === dataPoint.instanceType) {
          if(dataPoint.bestFor === "LM") dataPoint.bestFor += " and NTLM"
          else dataPoint.bestFor = "NTLM"
        }
      })
    }
    let apiKeysColumns = [
      {
        name:"_id",
        label:"Access Key ID"
      },
      {
        name:"secret",
        label:"Access Key Secret"
      },
      {
        name:"status",
        label:"Status"
      }
    ];
    const { subsReady } = this.props
    return (
      <div style={{marginTop:'2%'}} className="profile-page">
        {
          subsReady ? (
            <>
            <h3>Profile</h3>
            { this.props.awsSettings.length > 0 ? (<Button target="deleteAccount" onClick={this.deleteAccount} type="secondary" title="Delete Account" />) : (null)}
            {Roles.userIsInRole(Meteor.userId(), 'admin') ? (
              <>
              {this.props.awsSettings.length === 0 ? (
                <>
                  <Button target="initialConfigurationWalkthrough" onClick={this.initialConfigurationWalkthrough} type="primary" title="Click Me to Complete Installation" />
                </>
                ) : (
                (null)
              )}
              {this.props.awsPricing.length === 0 ? (this.initialConfigurationWalkthrough()) : (null)}
              {this.props.awsSettings.length > 0 ? (Swal.close()) : (null)}
              </>
              ) : (null)}
              {this.props.awsSettings.length > 0 ? (<MUIDataTable
                className={"crackRatesTable"}
                title={"API Keys"}
                data={this.props.apiKeys}
                columns={apiKeysColumns}
                options={apiKeyOptions}
              />) :(null) }
              {this.props.awsSettings.length > 0 ? (<MUIDataTable
                className={"crackRatesTable"}
                title={"Crack Rates"}
                data={data}
                columns={columns}
                options={options}
              />) :(null) }
              </>
          ) : 
          (
            <Spinner />
          )
        }
        
        {/* <Button target="userId" type="primary" title="Click for User Info" /> */}
        
        {/* {countersReady && (
          <Modal
            target="userId"
            title="User Info"
            body={Meteor.userId()}
            counter={counter}
          />
        )}
        <hr />
        {countersReady && <Text count={counter.count} />}
        <AddCountButton /> */}
      </div>
    );
  }
}

Profile.defaultProps = {
  // users: null, remote example (if using ddp)
  counter: null,
};

Profile.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
  awsSettings: PropTypes.array.isRequired,
  subsReady: PropTypes.bool.isRequired,
};

export default withTracker(() => {
  const awsPricingSub = Meteor.subscribe('aws.getPricing');
  const awsSettingsSub = Meteor.subscribe('aws.getSettings');
  const apiKeysSub = Meteor.subscribe('api.getKeys');
  const awsPricing = AWSCOLLECTION.find({type:'pricing'}).fetch();  
  const awsSettings = AWSCOLLECTION.find({type:'settings'}).fetch();
  const apiKeys = APICollection.find().fetch();
  const subsReady = awsPricingSub.ready() && awsSettingsSub.ready()  && !!awsPricing && !!awsSettings;

  return {
    subsReady,
    awsPricing,
    awsSettings,
    apiKeys,
  };
})(Profile);
