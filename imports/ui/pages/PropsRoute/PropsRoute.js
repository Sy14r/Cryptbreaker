/**
 * <PropsRoute/> is used in place of <Route/>
 * This allows additional props to be passed in
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Route } from 'react-router-dom';

const renderMergedProps = (component, ...rest) => {
  const finalProps = Object.assign({}, ...rest);
  return React.createElement(component, finalProps);
};

const PropsRoute = ({ component, ...rest }) => (
  <Route
    {...rest}
    render={routeProps => renderMergedProps(component, routeProps, rest)}
  />
);

PropsRoute.propTypes = {
  component: PropTypes.func.isRequired,
};

export default PropsRoute;
