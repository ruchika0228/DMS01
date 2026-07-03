import React, { useEffect } from 'react';
import { MdClose, MdCheckCircle, MdInfo, MdWarning, MdError } from 'react-icons/md';
import './Toast.css';

const Toast = ({
    message,
    type = 'info',
    duration = 3000,
    onClose
}) => {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <MdCheckCircle className="toast-icon" />;
            case 'warning':
                return <MdWarning className="toast-icon" />;
            case 'error':
                return <MdError className="toast-icon" />;
            default:
                return <MdInfo className="toast-icon" />;
        }
    };

    return (
        <div className={`toast toast-${type}`}>
            {getIcon()}
            <span className="toast-message">{message}</span>
            <button className="toast-close" onClick={onClose}>
                <MdClose />
            </button>
        </div>
    );
};

export default Toast;
