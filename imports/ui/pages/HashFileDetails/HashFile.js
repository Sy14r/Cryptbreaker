import React from 'react';
import { Roles } from 'meteor/alanning:roles';
import PropTypes from 'prop-types';
import { withTracker } from 'meteor/react-meteor-data';
import MUIDataTable from "mui-datatables";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { Hashes, HashFiles, HashCrackJobs } from '/imports/api/hashes/hashes.js';
import Spinner from '/imports/ui/components/Spinner';
import Swal from 'sweetalert2'

import './HashFile.scss';

class HashFileDetails extends React.Component {
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
          // width: "20em"
        }
      }
    }
  })

  render() {
    if (this.props.loggedIn && this.props.userReady) {
      let ids = this.props.match.params._ids.split('.');
      if(this.props.subsReady) {
        let fileFromID = HashFiles.findOne({"_id":ids[0]})
        // console.log(fileFromID)
        let filenameFromID = fileFromID.name
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
        innerColumns.push(
          {
            name: "meta.compliant",
            label:"Compliant w/Policy",
            options:{
              filter:true,
              display:false,
              sortDirection: 'desc',
            },
          })
  
        
      let innerData = Hashes.find({'meta.source':ids[0]}).fetch()
      let rowSourceID = ids[0];
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
        if(typeof fileFromID.policyViolations !== 'undefined'){
          if(fileFromID.policyViolations.includes(item._id)) {
            item.meta.compliant = "Noncompliant"
          } else {
            if(item.meta.cracked === true){
              item.meta.compliant = "Compliant"
            } else {
              item.meta.compliant = "Unknown"
            }
          }
        } else {
          item.meta.compliant = "Unknown"
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
            let htmlValues = '<div id="generatedSwalSelection">'
            let index = 0
              // '<input id="swal-input1" class="swal2-check">' +
              // '<input id="swal-input2" class="swal2-input">'
            _.forEach(columns, (column) => {
              htmlValues += `<div class="dataExportOption"><input type="checkbox" id="swal-input${index}" value="${column.label}" checked>${column.label}</input></div>`
              index++
            })
            htmlValues += '</div>'
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
            if(searchQuery.toLowerCase().split(':')[1].includes('user.ingroup')){
                let splitVal = searchQuery.split(':')[1].split(" ")
                if(splitVal.length > 1){
                  if(splitVal[1].length > 0 && (splitVal[1].match(/"/g)||[]).length == 2){
                    // console.log(splitVal[1].split('"')[1])
                    // console.log(currentRow[4][fileFromID._id])
                    let groupString = splitVal[1].split('"')[1]
                    for (let [key, value] of Object.entries(fileFromID.groups)) {
                      // console.log(`${key}: ${value}`);
                      if(key === groupString){
                        _.each(currentRow[4][fileFromID._id], (username) => {
                          if(value.data.includes(username)){
                            isFound = true;
                          }
                        })
                      }
                    }
                  }
                }
                // console.log(currentRow[3])
              
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
              <TableCell style={{padding:'2em'}}>
                { rowData[4][0] === "" ? (null) : (<><h4>Users</h4>{rowData[4][rowSourceID].map((user, i) => <p style={{paddingBottom:'.5em', marginBottom:'0em'}} >{user}</p>)}</>)}
                {rowData[2] === "yes" ? (<><h4>Password:</h4><p style={{paddingBottom:'0em', marginBottom:'0em'}} >{rowData[3]}</p> </>) : (<><h4>Password:</h4><p style={{paddingBottom:'0em', marginBottom:'0em'}} >Not Yet Cracked</p> </>)}
                {rowData[6] === "yes" ? (<><h4>Lists:</h4>{rowData[5].map((list, i) => <p style={{paddingBottom:'.5em', marginBottom:'0em'}} >{list}</p>)}</>) : (null)}
              </TableCell>
            </TableRow>
          )
          
        }
      }
        
  
        return (
            <div style={{marginTop:'2%'}} className="landing-page">          
              {this.props.subsReady ? (
                <>
                <MuiThemeProvider theme={getMuiTheme()}>
                  <MUIDataTable
                      className={"hashTable"}
                      title={`Hashes - ${filenameFromID}`}
                      data={innerData}
                      columns={innerColumns}
                      options={innerOptions}
                    />
                </MuiThemeProvider>
              </>
            ) : (
              <>
                <Spinner title={"Loading Data"} />
              </>
            ) }        
  
          </div>
        );
      } else {
        return (
          <div style={{marginTop:'2%'}} className="landing-page">   
            <Spinner title={"Loading Data"} />
          </div>
          )
      }
      
    } else {
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
}

HashFileDetails.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
};

export default withTracker(() => {
  const hashesSub = Meteor.subscribe('hashes.all');
  //const hashes = Hashes.find();
  const hashFilesSub = Meteor.subscribe('hashFiles.all');
  const hashFiles = HashFiles.find().fetch();
  const subsReady = hashesSub.ready() && hashFilesSub.ready() && hashFiles;
  return {
    subsReady,
    hashFiles,
    //hashes,
  };
})(HashFileDetails);