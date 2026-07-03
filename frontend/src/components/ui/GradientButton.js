import React from 'react';
import './GradientButton.css';

const GradientButton = ({
    children,
    onClick,
    variant = 'accept',
    size = 'medium',
    disabled = false,
    fullWidth = false,
    type = 'button',
    className = ''
}) => {
    const classes = [
        'gradient-btn',
        `gradient-btn-${variant}`,
        `gradient-btn-${size}`,
        fullWidth ? 'gradient-btn-full-width' : '',
        disabled ? 'gradient-btn-disabled' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <button
            type={type}
            className={classes}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
};

export default GradientButton;
