import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles'
import React from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import NotificationsIcon from "@material-ui/icons/NotificationsNone"
import Swal from 'sweetalert2'
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';


import './Navbar.scss';






const PublicNav = () => [
  <li key="login" className="nav-item">
    <span className="nav-link">
      <NavLink to="/login">Login</NavLink>
    </span>
  </li>,
  <li key="signup" className="nav-item">
    <span className="nav-link">
      <NavLink to="/signup">Signup</NavLink>
    </span>
  </li>,
];

const SearchBar = () => (
  <form className="form-inline my-2 my-lg-0">
    <input
      className="form-control mr-sm-2"
      type="search"
      placeholder="Search"
      aria-label="Search"
    />
    <button className="btn btn-outline-secondary my-2 my-sm-0" type="submit">
      <i className="fa fa-search" />
    </button>
  </form>
);

const UploadButton = () => {
  async function handleClick(e){
    e.preventDefault();
    const {value: file} = await Swal.fire({
      title: 'Select Hash Files',
      input: 'file',
      inputAttributes: {
        'accept': '*/*',
        'aria-label': 'Upload your hash files'
      }
    })
    
    if (file) {
      const reader = new FileReader
      reader.onload = (e) => {
        Meteor.call('uploadHashData', file.name,reader.result, (err)=>{
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
          // else {
          //   Swal.fire({
          //     title: 'Upload Successful',
          //     text: 'It may take a moment for results to populate based off of uploaded file size',
          //     type: 'success',
          //     timer:3000,
          //     toast:true,
          //     position:'top-right',
          //     animation:false,
          //   })
          // }
        })
      }
      reader.readAsDataURL(file)
    }
  }
  return(
  <form className="form-inline my-2 my-lg-0" style={{paddingRight:'.5em'}}>
    <button className="btn btn-outline-secondary my-2 my-sm-0" onClick={handleClick} >
      <i className="fa fa-plus" style={{paddingRight:'.5em'}}/>
      Upload File
    </button>
  </form>
)};

const LoggedInNav = () => {
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const openDocs = () => {
    window.open('https://www.opensecurity.io/blog/quick-password-cracks-and-audits')
  }
  return(
  <>
    <UploadButton key="upload" />
    {/* <SearchBar key="searchbar" /> */}
    { Roles.userIsInRole(Meteor.userId(), 'admin', Roles.GLOBAL_GROUP) === true ? (
      <li className="nav-item">
        <NavLink to="/admin">
          <button type="button" className="dropdown-item">
            Admin
          </button>
        </NavLink>
      </li>
      ) : 
      (
        null
      )
    }
    <li className="nav-item">
      <NavLink to="/profile">
        <button type="button" className="dropdown-item">
          Profile
        </button>
      </NavLink>
    </li>
    <li className="nav-item">
      <button type="button" className="dropdown-item" onClick={openDocs}>
        Docs
      </button>
    </li>
    <li className="nav-item">
      <div className="dropdown-divider" />
    </li>
    <li>
      <NavLink to="/login" onClick={() => Meteor.logout()}>
        <button type="button" className="dropdown-item">
          Logout
        </button>
      </NavLink>
    </li>
    {/*
    <li className="nav-item">
      <button aria-controls="simple-menu" aria-haspopup="true" onClick={handleClick} type="button" className="dropdown-item">
        <NotificationsIcon />
      </button>
      <Menu
        id="simple-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={handleClose}>Profile</MenuItem>
        <MenuItem onClick={handleClose}>My account</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
      </Menu>
    </li>
    */}
  </>
)};

const Status = ({ loggedIn }) => (
  <div className="my-2 mr-3">
    {loggedIn ? (
      <span className="text-success">
        <i className="fa fa-circle" />
      </span>
    ) : (
      <span className="text-secondary">
        <i className="fa fa-circle" />
      </span>
    )}
  </div>
);

Status.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
};

const Navbar = ({ loggedIn }) => (
  <nav className="navbar navbar-expand-lg navbar-light bg-light">
    <Status loggedIn={loggedIn} />
    <span className="navbar-brand" href="#">
      <NavLink to="/">Cryptbreaker</NavLink>
    </span>
    <button
      className="navbar-toggler"
      type="button"
      data-toggle="collapse"
      data-target="#navbarSupportedContent"
      aria-controls="navbarSupportedContent"
      aria-expanded="false"
      aria-label="Toggle navigation"
    >
      <span className="navbar-toggler-icon" />
    </button>
    <div className="collapse navbar-collapse" id="navbarSupportedContent">
      <ul className="navbar-nav ml-auto">
        {loggedIn ? <LoggedInNav /> : <PublicNav />}
      </ul>
    </div>
  </nav>
);

Navbar.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
};

export default Navbar;
