import React, { Component } from 'react';

import './Spinner.scss';

class Spinner extends Component {
  constructor(props){
    super(props);
  }

  render = () => {
    return(
      <div className="login-spinner">
        <div style={{display:'flex',justifyContent: 'center',alignItems: 'center',flexWrap: 'wrap'}}>
        {this.props.title ? (<><h3>{this.props.title}</h3><div className="break"></div></>) : (null)}
          <i className="fa fa-circle-o-notch fa-spin" />
        </div>
      </div>
    );
  }
}



export default Spinner;
