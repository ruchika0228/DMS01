import React from 'react';
import './Badge.css';

const Badge = ({
    children,
    variant = 'primary',
    size = 'medium',
    className = ''
}) => {
    const classes = [
        'badge',
        `badge-${variant}`,
        `badge-${size}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <span className={classes}>
            {children}
        </span>
    );
};

export default Badge;
