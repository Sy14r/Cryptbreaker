import React from "react";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import { withStyles } from "@material-ui/core/styles";
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

class CustomAPIKeySelect extends React.Component {

  getIdsFromSelection(){
    let ids = []
    _.each(this.props.selectedRows.data, (selection) => {
        ids.push(this.props.displayData[selection.index].data[0])
    })
    return ids;
  }

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

export default withStyles(defaultToolbarSelectStyles, { name: "CustomAPIKeySelect" })(CustomAPIKeySelect);