import React from 'react';
import { Roles } from 'meteor/alanning:roles';
import PropTypes from 'prop-types';
import { withTracker } from 'meteor/react-meteor-data';
import MUIDataTable from "mui-datatables";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { Hashes, HashFiles, HashCrackJobs } from '/imports/api/hashes/hashes.js';
import CustomToolbarSelect from "./CustomToolbarSelect";
import ReactDOM from 'react-dom';
import { AWSCOLLECTION } from '/imports/api/aws/aws.js'
import Spinner from '/imports/ui/components/Spinner';
import Swal from 'sweetalert2'


import './Landing.scss';

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
          },
        },
        {
          name: "duration",
          label:"Duration",
          options:{
            filter:false,
          },
        },
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
        }      
      ];
  
      let data = HashFiles.find().fetch();
      _.each(data,(item) => {
        item.uploadDate = item.uploadDate.toLocaleString().split(',')[0];
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
        expandableRows: true,
        expandableRowsOnClick: true,  
        renderExpandableRow: (rowData, rowMeta) => {
          let innerData = Hashes.find({'meta.source':rowData[0]}).fetch()
          let rowSourceID = rowData[0];
          _.each(innerData, (item) => {
            // console.log(item)
            if(item.meta.cracked === true){
              item.cracked = "yes"
            } else {
              item.cracked = "no"
            }
            if(typeof item.meta.lists !== 'undefined'){
              // if we have lists
              item.meta.inLists = "yes"
            } else {
              item.meta.inLists = "no"
            }
          })

          let innerOptions = {
            download:true,
            onDownload:  (buildHead, buildBody, columns,data) => {
              
              const realHandleDownload = async (buildHead, buildBody, columns,data, htmlValues, valuesCount) => {
                // first have UI popup similar to the 'start crack' flow
                
                const { value: formValues } = await Swal.fire({
                  title: 'Choose Columns to Export',
                  html: htmlValues,
                  focusConfirm: false,
                  preConfirm: () => {
                    let values = []
                    let i;
                    for (i = 0; i < htmlAndIndex[1]; i++) {
                      let element = document.getElementById(`swal-input${i}`)
                      values.push({value: element.value, isChecked: element.checked})
                    }
                    return values
                  }
                })
                
                if (formValues) {
                  const replaceDoubleQuoteInString = columnData =>
                  typeof columnData === 'string' ? columnData.replace(/\"/g, '""') : columnData;

                  const getArrayContents = columnData => {
                    if (typeof columnData === 'object'){                
                      return Object.values(columnData).join(",")
                    } else {
                      return columnData;
                    }
                  }

                  let newColumns = columns
                  _.forEach(newColumns, (column) => {
                    _.forEach(formValues, (value) => {
                      if(value.value === column.label) {
                        column.download = value.isChecked
                      }
                    })
                  })
                  
                  let reducedData = data.reduce(
                    (soFar, row) => 
                      soFar +
                      '"' +
                      row.data
                        .filter((_, index) => columns[index].download)
                        .map(columnData => getArrayContents(columnData))
                        .map(columnData => replaceDoubleQuoteInString(columnData))
                        .join('"' + ',' + '"') +
                      '"\r\n',
                    '',
                  ).trim()
                  
                  //console.log(columns)
                  //console.log(`reducedData ${reducedData}`)
                  // return false;
                  var element = document.createElement('a');
                  element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(buildHead(newColumns) + reducedData));
                  element.setAttribute('download', "export.csv");

                  element.style.display = 'none';
                  document.body.appendChild(element);

                  element.click();

                  document.body.removeChild(element);
                  // return buildHead(columns) + reducedData;
                }
              }

              const generateOptions = (columns) => {
                let htmlValues = ''
                let index = 0
                  // '<input id="swal-input1" class="swal2-check">' +
                  // '<input id="swal-input2" class="swal2-input">'
                _.forEach(columns, (column) => {
                  htmlValues += `<div class="dataExportOption"><input type="checkbox" id="swal-input${index}" value="${column.label}" checked>${column.label}</input></div>`
                  index++
                })
                return [htmlValues, index]
              }

              let htmlAndIndex = generateOptions(columns)
              realHandleDownload(buildHead, buildBody, columns,data, htmlAndIndex[0], htmlAndIndex[1])              
              return false;
            },
            downloadOptions: {
              filterOptions:{
                useDisplayedRowsOnly:true
              }
            },
            filter:true,
            print:false,
            viewColumns:false,
          }
  
          if(Roles.userIsInRole(Meteor.userId(), 'admin')){
            innerOptions.searchText = this.state.searchText
            innerOptions.customSearch = (searchQuery, currentRow, columns) => {
              let isFound = false;
              //custom 'filter:' logic
              if(searchQuery.toLowerCase().split(':').length > 1 && searchQuery.toLowerCase().split(':')[0] == 'filter'){
                // passLength query
                if(searchQuery.toLowerCase().split(':')[1].includes('password.length')){
                  if(currentRow[2] == "yes" && currentRow[3].length > 0){
                    let splitVal = searchQuery.toLowerCase().split(':')[1].split(' ')
                    if(splitVal.length > 2){
                      if(["<",">","==","<=",">="].includes(splitVal[1])){
                        switch(splitVal[1]){
                          case "<":
                            if(currentRow[3].length < splitVal[2]) {
                              isFound = true
                            }
                            break
                          case ">":
                            if(currentRow[3].length > splitVal[2]) {
                              isFound = true
                            }
                            break
                          case "<=":
                            if(currentRow[3].length <= splitVal[2]) {
                              isFound = true
                            }
                            break
                          case ">=":
                            if(currentRow[3].length >= splitVal[2]) {
                              isFound = true
                            }
                            break
                          case "==":
                            if(currentRow[3].length == splitVal[2]) {
                              isFound = true
                            }
                            break
                        }
                      }
                    }
                    // console.log(currentRow[3])
                  }
                }
              } 
              currentRow.forEach(col => {
                if(typeof col !== 'undefined'){
                  //if (col.toString().indexOf(searchQuery) >= 0) {
                  if (JSON.stringify(col).indexOf(searchQuery) >= 0) {
                      isFound = true;
                  }
                }
              });
              return isFound;
            },
            innerOptions.expandableRows = true
            innerOptions.expandableRowsOnClick= true
            innerOptions.renderExpandableRow = (rowData, rowMeta) => {
              // console.log(rowData)
              return(
                <TableRow>
                  <TableCell style={{padding:'2em'}} colSpan={colSpan}>
                    { rowData[4][0] === "" ? (null) : (<><h4>Users</h4>{rowData[4][rowSourceID].map((user, i) => <p style={{paddingBottom:'.5em', marginBottom:'0em'}} >{user}</p>)}</>)}
                    {rowData[2] === "yes" ? (<><h4>Password:</h4><p style={{paddingBottom:'0em', marginBottom:'0em'}} >{rowData[3]}</p> </>) : (<><h4>Password:</h4><p style={{paddingBottom:'0em', marginBottom:'0em'}} >Not Yet Cracked</p> </>)}
                    {rowData[6] === "yes" ? (<><h4>Lists:</h4>{rowData[5].map((list, i) => <p style={{paddingBottom:'.5em', marginBottom:'0em'}} >{list}</p>)}</>) : (null)}
                  </TableCell>
                </TableRow>
              )
              
            }
          }
  
          const colSpan = rowData.length + 1;
          
          return (
            <TableRow>
              <TableCell style={{padding:'2em'}} colSpan={colSpan}>
                {/* <h4>Affected Hosts:</h4> */}
                <MuiThemeProvider theme={getMuiTheme()}>
                  <MUIDataTable
                      title={"Hashes"}
                      data={innerData}
                      columns={innerColumns}
                      options={innerOptions}
                      fullWidth
                    />
                </MuiThemeProvider>
                {/* <table style={{width:'25em',padding:'.5em'}}>
                  <tr>
                    <th>IP</th>
                    <th>Port(s)</th>
                  </tr>
                  {affectedHosts.map((host, i) => <tr><td>{host.split(' ')[1]}</td><td>{host.split(':')[2]}</td></tr>)}
                </table> */}
                {/* {affectedHosts.map((host, i) => <p style={{paddingBottom:'0em', marginBottom:'0em'}} >{host}</p>)}
                <h4 style={{paddingTop:'.5em'}}>Synopsis</h4>
                {details[0].synopsis}
                <h4 style={{paddingTop:'.5em'}}>Description</h4>
                {rowData[6]}
                <h4 style={{paddingTop:'.5em'}}>Solution</h4>
                {details[0].solution}
      
                { (details[0].output.length > 0 && !isGrouping) ? ( <><h4 style={{paddingTop:'.5em'}}>Output</h4>
                <pre style={{marginTop:'-15px',paddingTop:'0em'}}>{details[0].output}</pre></> ): (null) }
                { isGrouping ? (
                  <><h4 style={{paddingTop:'.5em'}}>Related Findings</h4>
                  <MuiThemeProvider theme={getMuiTheme()}>
                  <MUIDataTable
                    data={innerRows}
                    columns={columns}
                    options={innerOptions}
                    fullWidth
                  />
                </MuiThemeProvider></>) : (null)}
                 */}
              </TableCell>
            </TableRow>
          );
        },
        customToolbarSelect: (selectedRows, displayData, setSelectedRows) => (
          <CustomToolbarSelect selectedRows={selectedRows} displayData={displayData} setSelectedRows={setSelectedRows} pricing={this.props.awsPricing}  />
        ),
      };
  
      const hcjOptions = {
        download:false,
        filter:true,
        print:false,
        viewColumns:false,
        onRowClick: (rowData, rowState) => {
          // let _id = rowData[5]
          // this.props.history.push({
          //     pathname: `/issue/${_id}`,
          //     state: {issue: data[rowState.rowIndex]}
          //   })
          // console.log(rowData)
          if(rowData[1].toLowerCase().includes("configure spot instances")) {
            console.log("REDIRECT HERE")
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
        }
      };
      return (
          <div style={{marginTop:'2%'}} className="landing-page">          
            {this.props.subsReady ? (
              <>
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
  const awsPricingSub = Meteor.subscribe('aws.getPricing');
  const hashesSub = Meteor.subscribe('hashes.all');
  //const hashes = Hashes.find();
  const awsPricing = AWSCOLLECTION.find({type:'pricing'}).fetch();
  const subsReady = hashFilesSub.ready() && awsPricingSub.ready() && hashCrackJobsSub.ready() && hashesSub.ready() && hashFiles && awsPricing && hashCrackJobs;
  return {
    subsReady,
    hashFiles,
    awsPricing,
    hashCrackJobs,
    //hashes,
  };
})(Landing);