import React from 'react';
import { Roles } from 'meteor/alanning:roles';
import PropTypes from 'prop-types';
import { withTracker } from 'meteor/react-meteor-data';
import MUIDataTable from "mui-datatables";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { Hashes, HashFiles, HashCrackJobs } from '/imports/api/hashes/hashes.js';
import ReactDOM from 'react-dom';
import { AWSCOLLECTION } from '/imports/api/aws/aws.js'
import DoughnutChart from './DoughnutChart.js';
import RadarChart from './RadarChart.js';
import LineChart from './LineChart.js';
import ChartItem from './ChartItem.js';
import Button from '/imports/ui/components/Button';
import Swal from 'sweetalert2'


import './Report.scss';
import { randomBytes } from 'crypto';

class Report extends React.Component {
  constructor(props) {
    super(props);
  }

  state = {
    searchText: ''
  };
  
  componentWillMount() {
    if (this.props.userReady && !this.props.loggedIn) {
      return this.props.history.push('/login');
    }
    return true;
  }

  shouldComponentUpdate(nextProps) {
    if (this.props.userReady && !nextProps.loggedIn) {
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

  getRandomInt = (max) => {
    return Math.floor(Math.random() * Math.floor(max));
  }

  render() {
    // Meteor.call('testAggregate');
    if (this.props.loggedIn && this.props.userReady) {
      let ids = this.props.match.params._ids.split('.');
      let crackedTotal = 0
      let uniqueTotal = 0
      let totalTotal = 0
      let passLengthStats = []
      let passReuseStats = []
      let passReuseStatsCracked = []
      let hashFiles = [] 
      let groupData = {}
      let categoriesStatOverview = []
      let breachListStatsOverview = []
      let colorsArray = ["#2c82c9","#5c97bf","#1e8bc3","#89c4f4","#2574a9","#4183d7","#4b77be","#3498db","#22a7f0","#19b5fe","#59abe3","#6bb9f0","#2c3e50","#34495e","#22313f","#013243","#336e7b"]
      // let randombase = colorsArray[this.getRandomInt(colorsArray.length)]
      let randombase = colorsArray[7]
      // let categoriesStatsColors = ["#66cccc","#cc99cc","#6699cc","#ffcc66","#99cc99"]
      // let breachListStatsColors = ["#66cccc","#cc99cc","#6699cc","#ffcc66","#99cc99","#66cccc","#cc99cc","#6699cc","#ffcc66","#99cc99","#66cccc","#cc99cc","#6699cc","#ffcc66","#99cc99"]

      _.each(ids, (id) => {
        // while(hashFiles.length === 0){
          // console.log(id)
          hashFiles = HashFiles.find({"_id":{$eq:id}}).fetch()
          console.log(hashFiles)

          if(hashFiles.length > 0){
            crackedTotal += hashFiles[0].crackCount
            uniqueTotal += hashFiles[0].distinctCount
            totalTotal += hashFiles[0].hashCount
            passLengthStats = hashFiles[0].passwordLengthStats  
            passReuseStats = hashFiles[0].passwordReuseStats
            if(typeof hashFiles[0].passwordReuseStatsCracked !== 'undefined') {
              passReuseStatsCracked = hashFiles[0].passwordReuseStatsCracked
            }
            if(typeof hashFiles[0].groups !== 'undefined'){
              groupData = hashFiles[0].groups
            }
            // if(typeof hashFiles[0].passwordReuseStats === 'undefined'){
            //   // console.log("CALL 1 OFF HERE")
            //   Meteor.call('calculateReuseStats',id)
            // } else {
            //   passReuseStats = hashFiles[0].passwordReuseStats
            // }
            if(typeof hashFiles[0].categoriesStats !== 'undefined') {
              for (let [key, value] of Object.entries(hashFiles[0].categoriesStats)) {
                if(hashFiles[0].categoriesStats[key].count > 0) {
                  categoriesStatOverview.push({
                  "name":hashFiles[0].categoriesStats[key].label,
                  "label":hashFiles[0].categoriesStats[key].label,
                  "value":hashFiles[0].categoriesStats[key].count
                  })
                }
              }
            }

            if(typeof hashFiles[0].breachListStats !== 'undefined') {
              for (let [key, value] of Object.entries(hashFiles[0].breachListStats)) {
                if(hashFiles[0].breachListStats[key].count > 0) {
                  breachListStatsOverview.push({
                  "name":hashFiles[0].breachListStats[key].label,
                  "label":hashFiles[0].breachListStats[key].label,
                  "value":hashFiles[0].breachListStats[key].count
                  })
                }
              }
            }
      
          }
        // }
      })
      let maxVal = 0
      // console.log(passLengthStats)
      _.each(passLengthStats, (stat) => {
        stat.name = `${stat._id}`
        stat.label=`${stat._id}`
        stat.value = stat.count
        if(stat.value > maxVal){
          maxVal = stat.value
        }
      })
      let maxReuseVal = 0
      // console.log(passLengthStats)
      _.each(passReuseStats, (stat) => {
        stat.name = `${stat.hash}`
        stat.label=`${stat.hash}`
        stat.value = stat.count
        if(stat.value > maxReuseVal){
          maxReuseVal = stat.value
        }
      })
      let maxReuseValCracked = 0
      _.each(passReuseStatsCracked, (stat) => {
        stat.name = `${stat.hash}`
        stat.label=`${stat.hash}`
        stat.value = stat.count
        if(stat.value > maxReuseValCracked){
          maxReuseValCracked = stat.value
        }
      })
      // console.log(passReuseStats)
      // console.log(groupData)

      let crackedStatOverview = []
      crackedStatOverview.push({
        "name":"Cracked",
        "label":"Cracked",
        "value":crackedTotal
      })
      crackedStatOverview.push({
        "name":"Uncracked",
        "label":"Uncracked",
        "value":totalTotal-crackedTotal
      })
      // ids contains the potential list of hashFiles to analyze
      let uploadGroupsClicked = () => {
        (async () => {
        // e.preventDefault(); 
        const {value: file} = await Swal.fire({
          title: 'Select Groups File',
          text:'Upload a text file with one username per line. The name of this file will be used in the report. So if you want statistics around members of the Domain Admin\'s group the create "Domain Admins.txt" and upload it here',
          input: 'file',
          inputAttributes: {
            'accept': '*/*',
            'aria-label': 'Upload groups file'
          }
        })
        
        if (file) {
          // console.log(this.props)
          let ids = this.props.match.params._ids.split('.');
          // console.log(ids)
          let hashFileID = ids[ids.length -1 ]
          // console.log(hashFileID)
          const reader = new FileReader
          reader.onload = (e) => {
            Meteor.call('uploadGroupFile', file.name,reader.result,hashFileID, (err)=>{
              if(err){
                Swal.fire({
                  title: 'Upload Failed',
                  type: 'error',
                  timer:3000,
                  toast:true,
                  position:'top-right',
                  animation:false,
                })
              }
              else {
                Swal.fire({
                  title: 'Upload Successful',
                  text: 'It may take a moment for results to populate based off of uploaded file size',
                  type: 'success',
                  timer:3000,
                  toast:true,
                  position:'top-right',
                  animation:false,
                })
              }
            })
          }
          reader.readAsDataURL(file)
        }
        })();
      }

      let removeGroupsClicked = (data) => {
        let ids = this.props.match.params._ids.split('.');
        // console.log(ids)
        let hashFileID = ids[ids.length -1 ]
        // console.log(hashFileID)
        // console.log(data)
        Meteor.call('removeGroupFile', data,hashFileID, (err)=>{
          if(err){
            Swal.fire({
              title: 'Remove Failed',
              type: 'error',
              timer:3000,
              toast:true,
              position:'top-right',
              animation:false,
            })
          }
          else {
            Swal.fire({
              title: 'Remove Successful',
              type: 'success',
              timer:3000,
              toast:true,
              position:'top-right',
              animation:false,
            })
          }
        })
      }   

      return (
        <>
        { hashFiles.length > 0 ? (
        <div style={{marginTop:'2%'}} className="landing-page">
          <h4>Reports for {hashFiles[0].name}</h4>
          <div className="break"></div>
          <LineChart
            type="line"
            data={passLengthStats}
            title="Password Length Frequency"
            color={randombase}
            // max={maxVal}
            xLabel="Password Length"
          />
          <DoughnutChart
            semiCircle={true}
            data={crackedStatOverview}
            title="Hash Crack Success Rate"
            colors={colorsArray.slice(0,2)}
          />
          { categoriesStatOverview.length > 0 ? (
            <>
            <DoughnutChart
                // hideLegend={true}
                // className="ChartCardFullWidth"
                legendPosition="left"
                data={categoriesStatOverview}
                title="Wordlist Source Statistics"
                // color={"#8ee3f5"}
                colors={colorsArray.slice(0,categoriesStatOverview.length)}
                />
            </>
          ) : (null) }
          {breachListStatsOverview.length > 0 ? (
              // if there is categories and breach list stats lets put both charts
              <>
                <LineChart
                  // hideLegend={true}
                  // className="ChartCardFullWidth"
                  // semiCircle={true}
                  // legendPosition="left"
                  type="bar"
                  data={breachListStatsOverview}
                  title="Breach/Leak Statistics"
                  xLabel=""
                  // colors={breachListStatsColors.slice(0,breachListStatsOverview.length)}
                  color={randombase}
                />
              </>
            ) : ( null )}
          <ChartItem
            data={passReuseStats}
            className="ChartCardFullWidth"
            title="Password Reuse Statistics"
            color={randombase}
            max={maxReuseVal}
          />
          {passReuseStatsCracked.length > 0 ? (
            <ChartItem
            data={passReuseStatsCracked}
            className="ChartCardFullWidth"
            title="Cracked Password Reuse Statistics"
            color={randombase}
            max={maxReuseValCracked}
          />
          ) : (null)}
          {
            // Insert passReuseCracked Stats here
          }
          {groupData ? (<div style={{marginTop:'.5em'}} className="break"></div>) : (null)}
          { Object.keys(groupData).map((key,index)=>{
            let maxReuseVal = 0

            if(typeof groupData[key].stats !== 'undefined'){

              if(typeof groupData[key].stats.passReuseStats !== 'undefined' && groupData[key].stats.passReuseStats.length > 0) {
                // console.log(passLengthStats)
                _.each(groupData[key].stats.passReuseStats, (stat) => {
                  stat.name = `${stat.hash}`
                  stat.label=`${stat.hash}`
                  stat.value = stat.count
                  if(stat.value > maxReuseVal){
                    maxReuseVal = stat.value
                  }
                })
              }
              console.log(groupData[key].stats.complete)
              // let users = groupData[key].data
              // let stats = groupData[key].stats
              groupData[key].crackedStatOverview = groupData[key].stats.crackedStatOverview
              groupData[key].passReuseStatsArray = []
              groupData[key].passReuseStats = groupData[key].stats.passReuseStats
              groupData[key].passLengthStats = groupData[key].stats.passwordLengthStats
              groupData[key].categoriesStatOverview = []
              groupData[key].breachListStatsOverview = []
        
              groupData[key].crackedUsersTable = {
                data: [],
                columns:[{
                  name: "account",
                  label:"Account",
                  options:{
                    display:true,
                    filter:false,
                  },
                }],
                options:{
                  download:false,
                  filter:false,
                  print:false,
                  viewColumns:false,
                  search:false,
                  selectableRows:"none"
                }
              }
              _.each(groupData[key].stats.crackedUsers, (crackedUser) => {
                groupData[key].crackedUsersTable.data.push({
                  account:crackedUser
                })
              })
              // console.log(lookupKey)
              groupData[key].maxReuseVal = 0
              Object.keys(groupData[key].passReuseStats).map((key2, index) => {
                if(groupData[key].passReuseStats[key2] > groupData[key].maxReuseVal){
                  groupData[key].maxReuseVal = groupData[key].passReuseStats[key2]
                }
                groupData[key].passReuseStatsArray.push({
                    name : key2,
                    label:key2,
                    value : groupData[key].passReuseStats[key2],

                })
              })
              // passLengthStats work
              _.each(groupData[key].passLengthStats, (stat) => {
                stat.name = `${stat._id}`
                stat.label=`${stat._id}`
                stat.value = stat.count
              })
              // console.log(groupData[key].passReuseStatsArray)
              if(typeof groupData[key].stats.categoriesStats !== 'undefined') {
                for (let [key2, value] of Object.entries(groupData[key].stats.categoriesStats)) {
                  if(groupData[key].stats.categoriesStats[key2].count > 0) {
                    groupData[key].categoriesStatOverview.push({
                    "name":groupData[key].stats.categoriesStats[key2].label,
                    "label":groupData[key].stats.categoriesStats[key2].label,
                    "value":groupData[key].stats.categoriesStats[key2].count
                    })
                  }
                }
              }
  
              if(typeof groupData[key].stats.breachListStats !== 'undefined') {
                for (let [key2, value] of Object.entries(groupData[key].stats.breachListStats)) {
                  if(groupData[key].stats.breachListStats[key2].count > 0) {
                    groupData[key].breachListStatsOverview.push({
                    "name":groupData[key].stats.breachListStats[key2].label,
                    "label":groupData[key].stats.breachListStats[key2].label,
                    "value":groupData[key].stats.breachListStats[key2].count
                    })
                  }
                }
              }
              // console.log(groupData[key])
            }

            
            
            return(
              <>
              {groupData[key].stats && groupData[key].stats.complete === true ? (
                <>
                <h5 style={{marginTop:'.25em'}}>{key} Statistics</h5>
                    <div className="break"></div>
                    {groupData[key].passLengthStats.length > 1 ? (<LineChart
                      type="line"
                      data={groupData[key].passLengthStats}
                      title="Password Length Frequency"
                      color={randombase}
                      // max={maxVal}
                      xLabel="Password Length"
                    />) : (<LineChart
                      type="bar"
                      data={groupData[key].passLengthStats}
                      title="Password Length Frequency"
                      color={randombase}
                      // max={maxVal}
                      xLabel="Password Length"
                    />)}
                    
                    <DoughnutChart
                      // className="groupDoughnutChart"
                      semiCircle={true}
                      data={groupData[key].crackedStatOverview}
                      title={`Hash Crack Success Rate`}
                      colors={colorsArray}
                    />
                    { groupData[key].categoriesStatOverview.length > 0 ? (
                      <>
                      <DoughnutChart
                          // hideLegend={true}
                          // className="ChartCardFullWidth"
                          legendPosition="left"
                          data={groupData[key].categoriesStatOverview}
                          title="Wordlist Source Statistics"
                          // color={"#8ee3f5"}
                          colors={colorsArray}
                          />
                      </>
                    ) : (null) }
                    {groupData[key].breachListStatsOverview.length > 0 ? (
                        // if there is categories and breach list stats lets put both charts
                        <>
                          <LineChart
                            // hideLegend={true}
                            // className="ChartCardFullWidth"
                            // semiCircle={true}
                            // legendPosition="left"
                            type="bar"
                            data={groupData[key].breachListStatsOverview}
                            title="Breach/Leak Statistics"
                            xLabel=""
                            // colors={breachListStatsColors.slice(0,breachListStatsOverview.length)}
                            color={randombase}
                          />
                        </>
                      ) : ( null )}
                    <div className="break"></div>
                    {/* <div className="ChartCard">
                      <h6>Password Reuse Statistics</h6>
                      {_.each(groupData[key].passReuseStatsArray, (reuseItem) => {

                      })}
                    </div> */}
                    {groupData[key].stats.passReuseStats.length > 0 ? (
                      <><ChartItem
                      data={groupData[key].stats.passReuseStats}
                      className="ChartCardFullWidth"
                      title="Password Reuse Statistics"
                      color={randombase}
                      //max={maxReuseVal}
                    />
                    <div className="break"></div></>
                    ) : (null)}
                    <MUIDataTable
                      className={"reportUsersTable"}
                      title={"Cracked Users"}
                      data={groupData[key].crackedUsersTable.data}
                      columns={groupData[key].crackedUsersTable.columns}
                      options={groupData[key].crackedUsersTable.options}
                    />
                    <div className="break"></div>
                    <div style={{marginTop:'.25em'}}></div>
                    <Button text={`Remove Group`} style={"Secondary"} data={key} handleFunction={removeGroupsClicked}/>
                    <div className="break"></div>
                </>
              ) : (
                <>
                  <h5 style={{marginTop:'.25em'}}>{key} Statistics Loading...</h5>
                  <div className="break"></div>
                </>
              )}
                
              </>
            )
          })}
          <div className="break"></div>
          <div style={{marginTop:'.25em'}}>
            <Button text={"Upload Groups File"} handleFunction={uploadGroupsClicked} />
          </div>
        </div>) : (null) }
        </>
        
      );
    }
    return (
      <div className="landing-page">
        <h1>You're Not Logged In</h1>
        <div className="break"></div>
        <p style={{fontSize:'18px'}}>Click the 'Login' button to the top-right to get started</p>
        {/* {window.location.href = '/login'} */}
      </div>
    );
  }
}

Report.propTypes = {
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
  const awsPricingSub = Meteor.subscribe('aws.getPricing');
  // const hashesSub = Meteor.subscribe('hashes.all',100000);
  const awsPricing = AWSCOLLECTION.find({type:'pricing'}).fetch();
  // const subsReady = hashFilesSub.ready() && awsPricingSub.ready() && hashCrackJobsSub.ready() && hashesSub.ready() && hashFiles && awsPricing && hashCrackJobs;
  const subsReady = hashFilesSub.ready() && awsPricingSub.ready() && hashCrackJobsSub.ready() && hashFiles && awsPricing && hashCrackJobs;
  return {
    subsReady,
    hashFiles,
    awsPricing,
    hashCrackJobs,
    // hashesSub,
  };
})(Report);