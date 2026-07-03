import React from 'react';
import Button from '../ui/Button';
import './HistoryModal.css';

const HistoryModal = ({ isOpen, onClose, fileName, history }) => {
    if (!isOpen) return null;

    return (
        <div className="history-modal-overlay" onClick={onClose}>
            <div className="history-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="history-modal-header">
                    <h3>Transfer History for "{fileName}"</h3>
                </div>

                {history.length === 0 ? (
                    <p style={{ color: 'var(--color-text-muted)' }}>No transfers yet.</p>
                ) : (
                    <ul className="history-list">
                        {history.map(transfer => (
                            <li key={transfer.id} className="history-item">
                                Sent to <strong style={{ color: 'var(--color-text-primary)' }}>{transfer.receiver.username}</strong> on {new Date(transfer.sent_at).toLocaleString()}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="history-modal-actions">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
};

export default HistoryModal;
