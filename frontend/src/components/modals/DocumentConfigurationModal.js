import React, { useState } from 'react';
import { MdClose, MdSettingsSuggest, MdSecurity } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import GradientButton from '../ui/GradientButton';
import './DocumentConfigurationModal.css';

const DocumentConfigurationModal = ({ isOpen, onClose, onConfirm, userName, recipientId, documentName, fileId, isBatch = false }) => {
    const [deadlineEnabled, setDeadlineEnabled] = useState(false);
    const [deadline, setDeadline] = useState('');

    const [accessControlEnabled, setAccessControlEnabled] = useState(true);
    const [accessControl, setAccessControl] = useState('View');

    const [redactionEnabled, setRedactionEnabled] = useState(false);

    const [error, setError] = useState('');
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (deadlineEnabled && !deadline) {
            setError('Please set a document deadline');
            return;
        }
        setError('');

        onConfirm({
            deadline: deadlineEnabled ? deadline : null,
            accessControl: accessControlEnabled ? accessControl : null
        });
        onClose();
    };

    return (
        <div className="modal-overlay doc-config-overlay" onClick={onClose}>
            <div className="doc-config-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="header-title-container">
                        <MdSettingsSuggest className="header-icon" />
                        <div>
                            <h2 className="modal-title">Document Configuration</h2>
                            <p className="modal-subtitle">
                                {isBatch ? (
                                    'Configuring for All Users'
                                ) : (
                                    <>Sending to: <strong>{userName}</strong></>
                                )}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}>
                        <MdClose />
                    </button>
                </div>

                <div className="modal-content">
                    <div className="document-info-banner">
                        <span className="doc-label">Document:</span>
                        <span className="doc-name">{documentName}</span>
                    </div>

                    <div className="config-sections">
                        {/* SECTION 1: Set Document Deadline */}
                        <div className="config-section">
                            <div className="section-header">
                                <h3 className="section-label">Set Document Deadline</h3>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={deadlineEnabled}
                                        onChange={(e) => setDeadlineEnabled(e.target.checked)}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>

                            <div className={`form-group ${!deadlineEnabled ? 'section-disabled' : ''}`}>
                                <label htmlFor="deadline">Date & Time</label>
                                <input
                                    type="datetime-local"
                                    id="deadline"
                                    className={`config-input ${error ? 'input-error' : ''}`}
                                    value={deadline}
                                    onChange={(e) => {
                                        setDeadline(e.target.value);
                                        if (e.target.value) setError('');
                                    }}
                                    disabled={!deadlineEnabled}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                                {error && <p className="error-text">{error}</p>}
                                <p className="input-helper">
                                    Recipient will need to complete the action by this time.
                                </p>
                            </div>
                        </div>

                        {/* SECTION 2: Access Control */}
                        <div className="config-section">
                            <div className="section-header">
                                <h3 className="section-label">Access Control</h3>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={accessControlEnabled}
                                        onChange={(e) => setAccessControlEnabled(e.target.checked)}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>

                            <div className={`form-group ${!accessControlEnabled ? 'section-disabled' : ''}`}>
                                <label htmlFor="access-control">Permission Level</label>
                                <select
                                    id="access-control"
                                    className="config-input"
                                    value={accessControl}
                                    onChange={(e) => setAccessControl(e.target.value)}
                                    disabled={!accessControlEnabled}
                                >
                                    <option value="View">View</option>
                                    <option value="View & Update">View & Update</option>
                                </select>
                                <p className="input-helper">
                                    Define what the recipient can do with this document.
                                </p>
                            </div>
                        </div>

                        {/* SECTION 3: Role Based Redaction */}
                        <div className="config-section">
                            <div className="section-header">
                                <h3 className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MdSecurity style={{ color: '#fbbf24' }} /> Role Based Redaction
                                </h3>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={redactionEnabled}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setRedactionEnabled(isChecked);
                                            if (isChecked) {
                                                // Navigate immediately upon enabling
                                                navigate('/redaction', {
                                                    state: {
                                                        file_id: fileId,
                                                        documentName,
                                                        userName,
                                                        recipientId,
                                                        deadline: deadlineEnabled ? deadline : null,
                                                        accessControl: accessControlEnabled ? accessControl : null,
                                                        isBatch
                                                    }
                                                });
                                            }
                                        }}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>

                            <div className={`form-group ${!redactionEnabled ? 'section-disabled' : ''}`}>
                                <p className="input-helper">
                                    Enabling this will direct you to a redaction interface to hide sensitive information.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        Cancel
                    </button>
                    <GradientButton
                        variant="accept"
                        size="medium"
                        onClick={handleConfirm}
                    >
                        Confirm & Send
                    </GradientButton>
                </div>
            </div>
        </div>
    );
};

export default DocumentConfigurationModal;
