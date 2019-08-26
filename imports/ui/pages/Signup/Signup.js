import { Accounts } from 'meteor/accounts-base';
import React from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';

// import components
import Alert from '../../components/Alert';

// import notifications
import Swal from 'sweetalert2';
import { NotificationsContainer, notification } from 'react-easy-notifications';

// import styles
import './Signup.scss';

import '/imports/ui/notifications.css';

class Signup extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      email: '',
      password: '',
      errMsg: '',
      adminCreated: true,
    };
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  componentWillMount() {
    if (this.props.loggedIn) {
      return this.props.history.push('/profile');
    }
    Meteor.call('adminCreated',(error,result) => {
      this.setState({adminCreated: result});
    });
  }

  shouldComponentUpdate(nextProps) {
    if (nextProps.loggedIn) {
      nextProps.history.push('/profile');
      return false;
    }
    return true;
  }

  handleSubmit(e) {
    e.preventDefault();
    const { email, password } = this.state;
    if(this.state.adminCreated) {
      Meteor.call('handleAccountRequest',email, password, (error,result) => {
        if(result === true){
          Swal.fire({
            title: 'Success!',
            toast:true,
            position:'top-right',
            text: `Account request submitted to admin for review`,
            showConfirmButton:false,
            timer: 3000,
            type: 'success',
            animation:false,
          })
      }
    else {
      Swal.fire({
        title: 'Error!',
        toast:true,
        position:'top-right',
        text: `Requested account already submitted for review`,
        showConfirmButton:false,
        timer: 3000,
        type: 'info',
        animation:false,
      })
    }});
      return
    }
    Accounts.createUser({ email, password }, err => {
      if (err) {
        this.setState({ errMsg: err.reason });
      }
    });
  }

  render() {
    if (this.props.loggedIn || this.props.adminCreated) {
      return null;
    }
    const { errMsg } = this.state;
    return (
        <section className="signup-page">
        <NotificationsContainer position="top-right" name="target"/>
        <div className="card mx-auto" style={{ maxWidth: '28rem' }}>
          <div className="card-header">
            <div className="brand">
              <div className="text-center">
                <img
                  className="rounded-circle"
                  src="/images/CryptbreakerLogin.png"
                  alt="logo"
                />
              </div>
            </div>
            <div className="card-body">
              <h4 className="card-title">Sign up</h4>
              <form onSubmit={this.handleSubmit}>
                <div className="form-group">
                  <label htmlFor="email">E-Mail Address</label>

                  <input
                    id="email"
                    type="email"
                    className="form-control"
                    name="email"
                    value={this.state.email}
                    onChange={e => this.setState({ email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    className="form-control"
                    name="password"
                    value={this.state.password}
                    onChange={e => this.setState({ password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    <input type="checkbox" name="aggree" value="1" required /> I
                    agree to the Terms and Conditions
                  </label>
                </div>
                <div className="form-group no-margin">
                  <button
                    type="submit"
                    className="btn btn-primary btn-block mb-2"
                  >
                    Sign up
                  </button>
                  {errMsg && <Alert errMsg={errMsg} />}
                </div>
                <div className="margin-top20">
                  Already have an account? <NavLink to="/login">Login</NavLink>
                </div>
              </form>
            </div>
          </div>
          <div className="footer text-center">
            &copy; {new Date().getFullYear()}
          </div>
        </div>
      </section>
    );
  }
}

Signup.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
};

export default Signup;
