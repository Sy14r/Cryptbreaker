/**
 * A basic bootstrap 4 modal
 * jw
 */

import { Meteor } from 'meteor/meteor';
import React from 'react';
import PropTypes from 'prop-types';

import './Modal.scss';

export const Button = ({ target, type, title, onClick }) => (
  <button
    type="button"
    className={`btn btn-${type}`}
    data-toggle="modal"
    data-target={`#${target}`}
    onClick={onClick}
  >
    {title}
  </button>
);

Button.propTypes = {
  target: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf([
    'primary',
    'secondary',
    'success',
    'danger',
    'warning',
    'info',
    'light',
    'dark',
  ]).isRequired,
};

const Modal = ({ target, title, body, counter }) => (
  <div
    className="modal fade modal-01"
    id={target}
    tabIndex="-1"
    role="dialog"
    aria-labelledby={target}
    aria-hidden="true"
  >
    <div className="modal-dialog" role="document">
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title" id={target}>
            {title}
          </h5>
          <button
            type="button"
            className="close"
            data-dismiss="modal"
            aria-label="Close"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div className="modal-body">
          Meteor.userId():<code> {body}</code>
          <br />
          <br />
          Meteor.user():<br />{' '}
          <code>
            {' '}
            <pre>{JSON.stringify(Meteor.user(), null, 2)}</pre>
          </code>
          Counter:<br />{' '}
          <code>
            {' '}
            <pre>{JSON.stringify(counter, null, 2)}</pre>
          </code>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            data-dismiss="modal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
);

Modal.propTypes = {
  target: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  body: PropTypes.string.isRequired,
  counter: PropTypes.shape({
    _id: PropTypes.string,
    count: PropTypes.number,
  }).isRequired,
};

export default Modal;
