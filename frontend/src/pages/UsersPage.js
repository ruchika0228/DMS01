import React, { useState, useEffect } from 'react';
import UserList from '../components/user/UserList';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSearch } from 'react-icons/md';
import './UsersPage.css';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    const handleGoBack = () => {
        navigate(-1);
    };

    useEffect(() => {
        const fetchFriends = async () => {
            try {
                const response = await api.get('/connections');
                // Filter only accepted connections and map to user format
                const friends = response.data
                    .filter(c => c.status === 'accepted')
                    .map(c => ({
                        id: c.friend_user.id,
                        name: c.friend_user.username,
                        email: c.friend_user.email,
                        friend_code: c.friend_user.friend_code,
                        role: 'User',
                        joinedDate: c.created_at, // Using connection date as "joined" date relative to user
                        status: 'active',
                        avatar: c.friend_user.profile_picture || null
                    }));
                setUsers(friends);
                setLoading(false);
            } catch (err) {
                console.error("Failed to fetch friends for users page", err);
                setLoading(false);
            }
        };

        fetchFriends();
    }, []);

    return (
        <div className="users-page">
            <div className="page-header">
                <div className="header-left">
                    <button className="back-button icon-only" onClick={handleGoBack} title="Back">
                        <MdArrowBack />
                    </button>
                    <div>
                        <h1 className="page-title">User Management</h1>
                        <p className="page-subtitle">Search and view details of your connected friends.</p>
                    </div>
                </div>
                <div className="header-right">
                    <div className="user-search">
                        <div className="search-input-wrapper">
                            <MdSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by name or email"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="user-search-input"
                            />
                            {searchQuery && (
                                <button
                                    className="clear-search-btn"
                                    onClick={() => setSearchQuery('')}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {loading ? (
                <p>Loading users...</p>
            ) : (
                <UserList users={users} searchQuery={searchQuery} onAcceptUser={() => { }} />
            )}
        </div>
    );
};

export default UsersPage;
