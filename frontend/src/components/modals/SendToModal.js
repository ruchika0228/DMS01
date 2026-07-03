import React, { useState } from 'react';
import Avatar from '../ui/Avatar';
import GradientButton from '../ui/GradientButton';
import { MdClose, MdSend } from 'react-icons/md';
import DocumentConfigurationModal from './DocumentConfigurationModal';
import './SendToModal.css';

const SendToModal = ({ isOpen, onClose, users, documentName, fileId, onSend }) => {
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [pendingUser, setPendingUser] = useState(null);
    const [isBatchSend, setIsBatchSend] = useState(false);

    if (!isOpen) return null;

    // Filter only active users
    const activeUsers = users.filter(user => user.status === 'active');

    const handleSendClick = (user) => {
        setPendingUser(user);
        setIsBatchSend(false);
        setShowConfigModal(true);
    };

    const handleConfirmSend = (configData) => {
        const { deadline, accessControl } = configData;

        if (isBatchSend) {
            const allIds = activeUsers.map(u => u.id);
            if (onSend) {
                allIds.forEach(id => onSend(id, deadline, accessControl));
            }
            setSelectedUsers([...selectedUsers, ...allIds]);
            setTimeout(() => {
                onClose();
            }, 1000);
        } else if (pendingUser) {
            if (onSend) {
                onSend(pendingUser.id, deadline, accessControl);
            }
            setSelectedUsers([...selectedUsers, pendingUser.id]);
        }

        setShowConfigModal(false);
        setPendingUser(null);
        setIsBatchSend(false);
    };

    const handleSendToAll = () => {
        setIsBatchSend(true);
        setShowConfigModal(true);
    };

    const isSent = (userId) => selectedUsers.includes(userId);

    const handleCloseConfigModal = () => {
        setShowConfigModal(false);
        setPendingUser(null);
        setIsBatchSend(false);
    };

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="send-to-modal" onClick={(e) => e.stopPropagation()}>
                    {/* Modal Header */}
                    <div className="modal-header">
                        <div>
                            <h2 className="modal-title">Send Document</h2>
                            <p className="modal-subtitle">{documentName}</p>
                        </div>
                        <button className="modal-close-btn" onClick={onClose}>
                            <MdClose />
                        </button>
                    </div>

                    {/* User List */}
                    <div className="modal-content">
                        {activeUsers.length === 0 ? (
                            <div className="no-users">
                                <p>No active users available</p>
                            </div>
                        ) : (
                            <div className="user-list">
                                {activeUsers.map((user) => (
                                    <div key={user.id} className="user-item">
                                        <div className="user-info">
                                            <Avatar
                                                src={user.avatar}
                                                alt={user.name}
                                                size="medium"
                                            />
                                            <div className="user-details">
                                                <span className="user-name">{user.name}</span>
                                                <span className="user-email">{user.email}</span>
                                                <span className="user-role">{user.role}</span>
                                            </div>
                                        </div>
                                        <button
                                            className={`send-btn ${isSent(user.id) ? 'sent' : ''}`}
                                            onClick={() => handleSendClick(user)}
                                            disabled={isSent(user.id)}
                                        >
                                            {isSent(user.id) ? (
                                                'Sent ✓'
                                            ) : (
                                                <>
                                                    <MdSend />
                                                    Send
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="modal-footer">
                        <button className="cancel-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <GradientButton
                            variant="accept"
                            size="small"
                            onClick={handleSendToAll}
                            disabled={activeUsers.length === 0}
                        >
                            Send to All Users
                        </GradientButton>
                    </div>
                </div>
            </div>

            {/* Document Configuration Modal */}
            {showConfigModal && (
                <DocumentConfigurationModal
                    isOpen={showConfigModal}
                    onClose={handleCloseConfigModal}
                    onConfirm={handleConfirmSend}
                    userName={pendingUser?.name}
                    recipientId={pendingUser?.id}
                    documentName={documentName}
                    fileId={fileId}
                    isBatch={isBatchSend}
                />
            )}
        </>
    );
};

export default SendToModal;

