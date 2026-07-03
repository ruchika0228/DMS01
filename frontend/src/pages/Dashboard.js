import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import FileUpload from '../components/ui/FileUpload';
import Footer from '../components/layout/Footer';
import { MdInbox, MdCloudUpload, MdLink, MdDashboard, MdFileUpload, MdTimeline, MdHistory, MdGroup, MdEdit, MdStorage, MdMyLocation, MdLocationOn } from 'react-icons/md';
import { forceLocationUpdate } from '../utils/geolocation';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const [locStatus, setLocStatus] = useState({ loading: false, data: null });

    const handleUpdateLocation = async () => {
        setLocStatus({ loading: true, data: null });
        try {
            const res = await forceLocationUpdate();
            setLocStatus({ loading: false, data: res });
            if (res.source === 'error') {
                alert(`Location Error: ${res.error}`);
            } else {
                alert(`Success! Device Location Fetched:\nLat: ${res.latitude}\nLon: ${res.longitude}\nSource: ${res.source}`);
                window.location.reload(); // Reload to see the new address in profile
            }
        } catch (err) {
            setLocStatus({ loading: false, data: null });
            alert(`Failed to update location: ${err.message || 'Unknown error'}`);
        }
    };

    const stats = [
        { label: 'Total Documents', value: '1,284', trend: '+12.4%', icon: <MdFileUpload /> },
        { label: 'Verified Blocks', value: '84%', trend: '+3.1%', icon: <MdTimeline /> },
        { label: 'Recent Edits', value: '156', trend: '+8.6%', icon: <MdHistory /> },
        { label: 'Active Nodes', value: '42', trend: '+2', icon: <MdGroup /> },
    ];

    const recentActivity = [
        { title: 'Project_Alpha.dwg uploaded', time: '2 mins ago', type: 'upload' },
        { title: 'New connection request', time: '1 hour ago', type: 'edit' },
        { title: 'Security audit completed', time: '3 hours ago', type: 'history' },
    ];

    return (
        <div className="dashboard reveal">
            <div className="dashboard-header">
                <div>
                    <h1 className="page-title">Overview</h1>
                    <p className="page-subtitle">Your document network at a glance — secure, verified, in sync.</p>
                </div>
                <span className="accent-chip dashboard-live-chip">
                    <span className="live-dot"></span> Live
                </span>
            </div>

            <div className="stats-grid">
                {stats.map((stat, index) => (
                    <div key={stat.label} className="stat-card glass-card" style={{ animationDelay: `${0.1 + index * 0.08}s` }}>
                        <div className="stat-card-top">
                            <span className="stat-icon-tile">{stat.icon}</span>
                            <span className="stat-trend">{stat.trend}</span>
                        </div>
                        <div className="stat-label">{stat.label}</div>
                        <div className="stat-value">{stat.value}</div>
                    </div>
                ))}
            </div>

            <div className="dashboard-main-grid">
                <div className="upload-card glass-card scanning-beam">
                    <div className="upload-card-body">
                        <h2>Secure Document Upload</h2>
                        <FileUpload />
                    </div>
                </div>

                <div className="dashboard-activity-col">
                    <div className="activity-card glass-card">
                        <div className="card-header">
                            <h3>Recent Activity</h3>
                        </div>
                        <div className="activity-list">
                            {recentActivity.map((activity, index) => (
                                <div key={index} className="activity-item selection-glow">
                                    <div className="activity-icon-wrap">
                                        {activity.type === 'upload' ? <MdFileUpload /> :
                                            activity.type === 'edit' ? <MdEdit /> :
                                                <MdHistory />}
                                    </div>
                                    <div className="activity-details">
                                        <div className="activity-title">{activity.title}</div>
                                        <div className="activity-time">{activity.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="quick-card glass-card">
                        <div className="card-header">
                            <h3>Quick Terminal Actions</h3>
                        </div>
                        <div className="quick-actions">
                            <button className="quick-action-btn" onClick={handleUpdateLocation} disabled={locStatus.loading}>
                                <MdMyLocation className={`action-icon ${locStatus.loading ? 'spinning' : ''}`} />
                                <span>{locStatus.loading ? 'Capturing...' : 'Update Device Location'}</span>
                            </button>
                            <button className="quick-action-btn" onClick={() => navigate('/vault')}>
                                <MdStorage className="action-icon" />
                                <span>Vault Explorer</span>
                            </button>
                            <button className="quick-action-btn" onClick={() => navigate('/blockchain')}>
                                <MdHistory className="action-icon" />
                                <span>Blockchain</span>
                            </button>
                            <button className="quick-action-btn" onClick={() => navigate('/connections')}>
                                <MdGroup className="action-icon" />
                                <span>Operator List</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
