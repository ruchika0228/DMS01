import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { MdCheck, MdClose, MdVisibility, MdInfo } from 'react-icons/md';
import './PendingApprovalsPage.css';

const PendingApprovalsPage = () => {
    const navigate = useNavigate();
    const [pendingStages, setPendingStages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStage, setSelectedStage] = useState(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [actionType, setActionType] = useState(''); // 'Approved' or 'Rejected'

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const res = await api.get('/workflow/pending-approvals');
            setPendingStages(res.data);
        } catch (error) {
            console.error("Failed to fetch pending approvals", error);
        } finally {
            setLoading(false);
        }
    };

    const handleActionClick = (stage, type) => {
        setSelectedStage(stage);
        setActionType(type);
        setRemarks('');
        setIsActionModalOpen(true);
    };

    const handleConfirmAction = async () => {
        try {
            await api.post(`/workflow/stages/${selectedStage.id}/action`, {
                status: actionType,
                remarks: remarks
            });
            setIsActionModalOpen(false);
            fetchPending();
        } catch (error) {
            console.error("Action failed", error);
            alert("Action failed: " + (error.response?.data?.detail || "Unknown error"));
        }
    };

    if (loading) return <div className="loading-state">Scanning for pending authorizations...</div>;

    return (
        <div className="pending-approvals-page reveal">
            <header className="page-header">
                <h1>Pending Authorizations</h1>
                <p>Documents awaiting your approval in the hierarchical chain</p>
            </header>

            <div className="pending-grid">
                {pendingStages.length > 0 ? (
                    pendingStages.map(stage => (
                        <Card key={stage.id} className="pending-card glass-card">
                            <div className="pending-card-header">
                                <Badge variant="primary">Stage {stage.stage_number}</Badge>
                                <span className="due-date">Due: {new Date(stage.due_date).toLocaleString()}</span>
                            </div>
                            <div className="pending-card-body">
                                <h3>{stage.document?.title || "Untitled Document"}</h3>
                                <p className="stage-name-label">{stage.stage_name}</p>
                                <div className="doc-meta">
                                    <span><MdInfo /> Created by {stage.document?.creator?.username}</span>
                                    {stage.document?.file?.cid && (
                                        <span className="cid-badge">
                                            CID: {stage.document.file.cid.substring(0, 10)}...
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="pending-card-actions">
                                <Button 
                                    variant="secondary" 
                                    onClick={() => {
                                        const mockFile = {
                                            id: stage.document?.file_id,
                                            name: stage.document?.title || stage.document?.file?.file_name || 'Untitled Document',
                                            type: stage.document?.file?.file_type || 'unknown',
                                            size: stage.document?.file?.file_size || 0,
                                            cid: stage.document?.file?.cid,
                                            sections: stage.document?.file?.sections || []
                                        };
                                        navigate('/document-view', {
                                            state: {
                                                file: mockFile
                                            }
                                        });
                                    }}
                                >
                                    <MdVisibility /> View
                                </Button>
                                <div className="action-buttons">
                                    <button className="approve-btn" onClick={() => handleActionClick(stage, 'Approved')}>
                                        <MdCheck /> Approve
                                    </button>
                                    <button className="reject-btn" onClick={() => handleActionClick(stage, 'Rejected')}>
                                        <MdClose /> Reject
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="no-pending glass-card">
                        <MdCheck className="done-icon" />
                        <h2>All Clear!</h2>
                        <p>No documents are currently awaiting your authorization.</p>
                    </div>
                )}
            </div>

            <Modal 
                isOpen={isActionModalOpen} 
                onClose={() => setIsActionModalOpen(false)} 
                title={`${actionType} Document`}
            >
                <div className="action-modal-content">
                    <p>You are about to <strong>{actionType.toLowerCase()}</strong> the document: 
                       <br/><em>{selectedStage?.document?.title}</em>
                    </p>
                    <div className="form-group">
                        <label className="input-label">Remarks (Optional)</label>
                        <textarea 
                            className="custom-textarea"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Add any comments or justifications..."
                        />
                    </div>
                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
                        <Button 
                            variant={actionType === 'Approved' ? 'success' : 'danger'} 
                            onClick={handleConfirmAction}
                        >
                            Confirm {actionType}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PendingApprovalsPage;
