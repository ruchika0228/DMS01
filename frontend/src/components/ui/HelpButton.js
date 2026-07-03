import React from 'react';
import { IoHelpCircleOutline } from 'react-icons/io5';
import './HelpButton.css';

const HelpButton = ({ onClick }) => {
    return (
        <button
            className="help-button navbar-icon-btn"
            onClick={onClick}
            aria-label="Help"
            title="View help and setup guide"
        >
            <IoHelpCircleOutline className="icon" />
        </button>
    );
};

export default HelpButton;
