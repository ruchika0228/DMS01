import React from 'react';
import Avatar from '../ui/Avatar';
import GradientButton from '../ui/GradientButton';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { IoSend, IoDownload, IoCheckmarkCircle, IoCloseCircle, IoTime } from 'react-icons/io5';
import './ConnectionManager.css';

const ConnectionManager = ({ sentRequests, receivedRequests, onAccept, onReject }) => {
    const getPendingCount = () => {
        return receivedRequests.filter(req => req.status === 'pending').length;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="connection-manager reveal">
            <div className="connection-header glass-card scanning-beam">
                <h2 className="connection-title">Network Operator Hub</h2>
                <p className="connection-subtitle">
                    Manage direct p2p channel authorizations
                    {getPendingCount() > 0 && (
                        <Badge variant="error" size="small" className="pending-count pulse">
                            {getPendingCount()} NEW
                        </Badge>
                    )}
                </p>
            </div>

            <div className="connection-sections">
                <div className="connection-section">
                    <h3 className="section-title">
                        <IoSend className="section-icon" />
                        Sent Requests
                        <Badge variant="ghost" size="small">{sentRequests.length}</Badge>
                    </h3>

                    <div className="request-list">
                        {sentRequests.map((request) => (
                            <div key={request.id} className="request-card glass-card selection-glow">
                                <div className="request-content">
                                    <Avatar
                                        src={request.user.avatar}
                                        alt={request.user.name}
                                        size="large"
                                    />

                                    <div className="request-info">
                                        <h4 className="request-name">{request.user.name}</h4>
                                        <p className="request-email">{request.user.email}</p>
                                        <p className="request-role">{request.user.role}</p>
                                        <p className="request-date">Sent: {formatDate(request.sentDate)}</p>
                                    </div>

                                    <div className="request-status">
                                        <Badge
                                            variant={request.status === 'accepted' ? 'gradient-success' : 'gradient-warning'}
                                            size="medium"
                                        >
                                            {request.status === 'accepted' ? <IoCheckmarkCircle /> : (request.status === 'pending' ? <IoTime /> : <IoCloseCircle />)}
                                            {request.status}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {sentRequests.length === 0 && (
                        <div className="empty-state">
                            <p>No sent requests</p>
                        </div>
                    )}
                </div>

                <div className="connection-section">
                    <h3 className="section-title">
                        <IoDownload className="section-icon" />
                        Received Requests
                        <Badge variant="ghost" size="small">{receivedRequests.length}</Badge>
                    </h3>

                    <div className="request-list">
                        {receivedRequests.map((request) => (
                            <div key={request.id} className="request-card glass-card selection-glow">
                                <div className="request-content">
                                    <Avatar
                                        src={request.user.avatar}
                                        alt={request.user.name}
                                        size="large"
                                    />

                                    <div className="request-info">
                                        <h4 className="request-name">{request.user.name}</h4>
                                        <p className="request-email">{request.user.email}</p>
                                        <p className="request-role">{request.user.role}</p>
                                        <p className="request-date">Received: {formatDate(request.receivedDate)}</p>
                                    </div>

                                    {request.status === 'pending' ? (
                                        <div className="request-actions">
                                            <GradientButton
                                                variant="accept"
                                                size="small"
                                                onClick={() => onAccept(request.id)}
                                            >
                                                Accept
                                            </GradientButton>
                                            <GradientButton
                                                variant="reject"
                                                size="small"
                                                onClick={() => onReject(request.id)}
                                            >
                                                Reject
                                            </GradientButton>
                                        </div>
                                    ) : (
                                        <div className="request-status">
                                            <Badge
                                                variant={request.status === 'accepted' ? 'success' : 'error'}
                                                size="medium"
                                                className="status-badge-with-icon"
                                            >
                                                {request.status === 'accepted' ? <IoCheckmarkCircle /> : <IoCloseCircle />}
                                                {request.status}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {receivedRequests.length === 0 && (
                        <div className="empty-state">
                            <p>No received requests</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConnectionManager;
