import React from 'react';
import './Card.css';

const Card = ({
    children,
    className = '',
    hover = false,
    onClick,
    padding = 'medium'
}) => {
    const classes = [
        'card',
        hover ? 'card-hover' : '',
        `card-padding-${padding}`,
        onClick ? 'card-clickable' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} onClick={onClick}>
            {children}
        </div>
    );
};

export default Card;
