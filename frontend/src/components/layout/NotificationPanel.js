import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCheckmarkDoneOutline, IoTimeOutline, IoAlertCircleOutline, IoCloseCircleOutline } from 'react-icons/io5';
import './NotificationPanel.css';
import api from '../../api/axios';

const NotificationPanel = ({ notifications, onMarkRead, onClose }) => {
    const navigate = useNavigate();

    const handleNotificationClick = async (notif) => {
        // Mark as read if not already
        if (!notif.is_read) {
            try {
                await api.put(`/workflow/notifications/${notif.id}/read`);
                onMarkRead(notif.id);
            } catch (err) {
                console.error("Failed to mark notification as read", err);
            }
        }

        // Navigate based on document_id if available
        if (notif.document_id) {
            // Check if it's an approval request or just a status update
            if (notif.title.includes("Approval Request")) {
                navigate('/pending-approvals');
            } else {
                navigate('/workflow');
            }
        }
        onClose();
    };

    const getIcon = (title) => {
        if (title.includes("Approved")) return <IoCheckmarkDoneOutline className="notif-icon approved" />;
        if (title.includes("Rejected")) return <IoCloseCircleOutline className="notif-icon rejected" />;
        if (title.includes("Approval Request")) return <IoTimeOutline className="notif-icon pending" />;
        return <IoAlertCircleOutline className="notif-icon info" />;
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInMs = now - date;
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInMins < 1) return 'Just now';
        if (diffInMins < 60) return `${diffInMins}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return `${diffInDays}d ago`;
    };

    return (
        <div className="notification-panel">
            <div className="notif-header">
                <h3>Notifications</h3>
                <button className="mark-all-btn" onClick={() => notifications.forEach(n => !n.is_read && handleNotificationClick(n))}>
                    Mark all read
                </button>
            </div>
            <div className="notif-list">
                {notifications.length === 0 ? (
                    <div className="empty-notif">No notifications</div>
                ) : (
                    notifications.map((notif) => (
                        <div 
                            key={notif.id} 
                            className={`notif-item ${notif.is_read ? 'read' : 'unread'}`}
                            onClick={() => handleNotificationClick(notif)}
                        >
                            <div className="notif-icon-container">
                                {getIcon(notif.title)}
                            </div>
                            <div className="notif-content">
                                <p className="notif-title">{notif.title}</p>
                                <p className="notif-message">{notif.message}</p>
                                <span className="notif-time">{formatTime(notif.created_at)}</span>
                            </div>
                            {!notif.is_read && <span className="unread-dot"></span>}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NotificationPanel;
