import React from 'react';
import { MdPerson } from 'react-icons/md';
import './Avatar.css';

const Avatar = ({
    src,
    alt = 'User',
    size = 'medium',
    status,
    className = ''
}) => {
    const classes = [
        'avatar',
        `avatar-${size}`,
        status ? 'avatar-with-status' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes}>
            {src ? (
                <img src={src} alt={alt} className="avatar-image" />
            ) : (
                <div className="avatar-placeholder">
                    <MdPerson className="avatar-placeholder-icon" />
                </div>
            )}
            {status && <span className={`avatar-status avatar-status-${status}`}></span>}
        </div>
    );
};

export default Avatar;
