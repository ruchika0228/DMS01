import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { MdDescription, MdTimeline, MdCheckCircle, MdCancel, MdHourglassEmpty } from 'react-icons/md';
import './WorkflowDashboard.css';

const WorkflowDashboard = () => {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await api.get('/workflow/my-documents');
            setDocuments(res.data);
        } catch (error) {
            console.error("Failed to fetch documents", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Approved': return <MdCheckCircle className="status-icon text-success" />;
            case 'Rejected': return <MdCancel className="status-icon text-danger" />;
            default: return <MdHourglassEmpty className="status-icon text-warning" />;
        }
    };

    if (loading) return <div className="loading-state">Accessing G-DMAS Registry...</div>;

    return (
        <div className="workflow-dashboard reveal">
            <header className="page-header">
                <h1>My G-DMAS Documents</h1>
                <p>Track the approval progress of your submitted documents</p>
            </header>

            <div className="document-list">
                {documents.length > 0 ? (
                    documents.map(doc => (
                        <Card key={doc.id} className="document-card glass-card">
                            <div className="doc-header">
                                <div className="doc-title-section">
                                    {getStatusIcon(doc.status)}
                                    <h3>{doc.title}</h3>
                                </div>
                                <Badge variant={doc.status === 'Approved' ? 'success' : doc.status === 'Rejected' ? 'danger' : 'warning'}>
                                    {doc.status}
                                </Badge>
                            </div>
                            
                            <div className="doc-body">
                                <p className="doc-desc">{doc.description}</p>
                                <div className="workflow-timeline">
                                    {doc.stages.map((stage, idx) => (
                                        <div key={stage.id} className={`timeline-stage ${stage.status}`}>
                                            <div className="stage-dot"></div>
                                            <div className="stage-info">
                                                <span className="stage-name">{stage.stage_name}</span>
                                                <span className="stage-user">{stage.user?.username}</span>
                                                <Badge variant={stage.status === 'Approved' ? 'success' : stage.status === 'Rejected' ? 'danger' : stage.status === 'Pending' ? 'warning' : 'secondary'}>
                                                    {stage.status}
                                                </Badge>
                                            </div>
                                            {idx < doc.stages.length - 1 && <div className="timeline-connector"></div>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="doc-footer">
                                <span className="timestamp">Updated: {new Date(doc.updated_at).toLocaleString()}</span>
                                <Button variant="secondary" onClick={() => {
                                    const mockFile = {
                                        id: doc.file_id,
                                        name: doc.title || doc.file?.file_name || 'IPFS Document',
                                        type: doc.file?.file_type || 'unknown',
                                        size: doc.file?.file_size || 0,
                                        cid: doc.file?.cid,
                                        sections: doc.file?.sections || []
                                    };
                                    navigate('/document-view', {
                                        state: {
                                            file: mockFile
                                        }
                                    });
                                }}>
                                    View Source File
                                </Button>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="no-docs glass-card">
                        <MdDescription className="empty-icon" />
                        <h2>No Documents Found</h2>
                        <p>You haven't initiated any approval workflows yet.</p>
                        <Button variant="primary" onClick={() => window.location.href='/create-document'}>
                            Create New Document
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkflowDashboard;
