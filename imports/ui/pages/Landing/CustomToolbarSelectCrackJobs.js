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

class CustomToolbarSelectCrackJobs extends React.Component {

  getIdsFromSelection(){
    let ids = []
    let allGood = true
    _.each(this.props.selectedRows.data, (selection) => {
        if(this.props.displayData[selection.index].data[1] === "Job Completed" || this.props.displayData[selection.index].data[1] === "Job Paused") {
          ids.push(this.props.displayData[selection.index].data[0])
        } else {
          allGood = false
          Swal.fire({
            title: 'ERROR:',
            text: `In order to delete a job wait for it to complete or cancel it first.`,
            type: 'error',
            showConfirmButton: false,
            toast:true,
            position:'top-right',
            timer:3000,
            animation:false,
          })
          
        }
    })
    if(!allGood) {
      return []
    } 
    else {
      return ids;
    }
  }

  //TODO: Update with actual toast vs swal
  handleClickDelete = () => {
    let ids = this.getIdsFromSelection();
    if(ids.length > 0){
      Meteor.call('deleteHashCrackJobs',ids, (err) =>   {
        if(typeof err !== 'undefined'){
          // If we had an error...
          Swal.fire({
            title: 'Could not delete hash crack jobs requested',
            type: 'error',
            showConfirmButton: false,
            toast:true,
            position:'top-right',
            timer:3000,
            animation:false,
          })
        } else {
          Swal.fire({
            title: 'hash crack jobs deleted',
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
    
  };

  render() {
    const { classes } = this.props;

    return (
      <div className={classes.iconContainer}>
        <Tooltip title={"Delete"}>
          <IconButton className={classes.iconButton} onClick={this.handleClickDelete}>
            <DeleteOutlineIcon className={classes.icon} />
          </IconButton>
        </Tooltip>
      </div>
    );
  }
}

export default withStyles(defaultToolbarSelectStyles, { name: "CustomToolbarSelect" })(CustomToolbarSelectCrackJobs);