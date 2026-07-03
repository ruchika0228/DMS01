import React, { useState, useEffect } from 'react';
import ConnectionManager from '../components/connection/ConnectionManager';
import api from '../api/axios';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { MdArrowBack } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import './ConnectionsPage.css';

const ConnectionsPage = () => {
    const [connections, setConnections] = useState([]);
    const [friendCode, setFriendCode] = useState('');
    // eslint-disable-next-line no-unused-vars
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleGoBack = () => {
        navigate(-1);
    };

    const fetchConnections = async () => {
        try {
            const response = await api.get('/connections');
            setConnections(response.data);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch connections", err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnections();
    }, []);

    const handleSendRequest = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            await api.post('/connections/request', { friend_code: friendCode });
            setSuccess('Friend request sent successfully!');
            setFriendCode('');
            fetchConnections(); // Refresh list
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to send request');
        }
    };

    const handleAccept = async (connectionId) => {
        try {
            await api.put(`/connections/accept/${connectionId}`);
            fetchConnections(); // Refresh list
        } catch (err) {
            console.error("Failed to accept request", err);
            alert("Failed to accept request");
        }
    };

    // Filter connections
    const sentRequests = connections.filter(c => c.is_requester && c.status === 'pending').map(c => ({
        id: c.id,
        user: {
            name: c.friend_user.username,
            email: c.friend_user.email,
            avatar: c.friend_user.profile_picture || null,
            role: 'User'
        },
        status: c.status,
        sentDate: c.created_at
    }));

    const receivedRequests = connections.filter(c => !c.is_requester && c.status === 'pending').map(c => ({
        id: c.id,
        user: {
            name: c.friend_user.username,
            email: c.friend_user.email,
            avatar: c.friend_user.profile_picture || null,
            role: 'User'
        },
        status: c.status,
        receivedDate: c.created_at
    }));



    return (
        <div className="connections-page">
            <div className="page-header">
                <div className="header-left">
                    <button className="back-button icon-only" onClick={handleGoBack} title="Back">
                        <MdArrowBack />
                    </button>
                    <h1 className="page-title">Connections</h1>
                </div>
            </div>

            <div className="add-friend-section">
                <h2>Add a Friend</h2>
                <form onSubmit={handleSendRequest} className="add-friend-form">
                    <Input
                        placeholder="Enter Friend Code (e.g., DMS-12345)"
                        value={friendCode}
                        onChange={(e) => setFriendCode(e.target.value)}
                        required
                    />
                    <Button type="submit">Send Request</Button>
                </form>
                {error && <p className="error-message" style={{ color: 'red' }}>{error}</p>}
                {success && <p className="success-message" style={{ color: 'green' }}>{success}</p>}
            </div>

            <ConnectionManager
                sentRequests={sentRequests}
                receivedRequests={receivedRequests}
                onAccept={handleAccept}
                onReject={() => { }} // Reject not implemented in backend yet
            />


        </div>
    );
};

export default ConnectionsPage;
