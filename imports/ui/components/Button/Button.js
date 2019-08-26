import { Meteor } from 'meteor/meteor';
import React, { Component } from 'react';

import { countersIncrease } from '../../../api/counters/methods';

import './Button.scss';

class Button extends Component {
  constructor(props){
    super(props)
  }

  handlePress = () => { console.log("Button Clicked"); }

  render = () => {
    // console.log(this.props)
    return(
      <>
      {this.props.handleFunction ? 
        (
          <>
          {this.props.style === "Secondary" ? (
            <button className="btn btn-primary" onClick={() => this.props.handleFunction(this.props.data)}>
              {this.props.text ? (this.props.text) :("Click Me")}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => this.props.handleFunction(this.props.data)}>
              {this.props.text ? (this.props.text) :("Click Me")}
            </button>
          )}
        </>
        ) : 
        (  
          <>
            {this.props.style === "Secondary" ? (
              <button className="btn btn-primary" onClick={this.handlePress}>
                {this.props.text ? (this.props.text) :("Click Me")}
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={this.handlePress}>
                {this.props.text ? (this.props.text) :("Click Me")}
              </button>
            )}
          </>
          
        )
      }
    </>
    )  
  }
}

export default Button;
