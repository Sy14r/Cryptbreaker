import React from 'react';
import PropTypes from 'prop-types';

import './Alert.scss';

const Alert = ({ errMsg }) => (
  <div className="alert alert-warning fade show" role="alert">
    {errMsg}
  </div>
);

Alert.propTypes = {
  errMsg: PropTypes.string.isRequired,
};

export default Alert;
