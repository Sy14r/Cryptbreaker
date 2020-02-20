import { Meteor } from 'meteor/meteor';
import React from "react";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import AddIcon from "@material-ui/icons/Add";
import Swal from 'sweetalert2'
import { withStyles } from "@material-ui/core/styles";

const defaultToolbarStyles = {
  iconButton: {
  },
};

class CustomAPIToolbar extends React.Component {
  
  handleClick = () => {
    Meteor.call('createKey', "test", (err)=>{
      if(err){
        console.log(err)
        Swal.fire({
          title: 'Error Creating API Key ',
          type: 'error',
          timer:3000,
          toast:true,
          position:'top-right',
          animation:false,
        })
      }
    })
  }

  render() {
    const { classes } = this.props;

    return (
      <React.Fragment>
        <Tooltip title={"custom icon"}>
          <IconButton className={classes.iconButton} onClick={this.handleClick}>
            <AddIcon className={classes.deleteIcon} />
          </IconButton>
        </Tooltip>
      </React.Fragment>
    );
  }

}

export default withStyles(defaultToolbarStyles, { name: "CustomAPIToolbar" })(CustomAPIToolbar);