import React from 'react';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import GradientButton from '../ui/GradientButton';
import Card from '../ui/Card';
import './UserList.css';

const UserList = ({ users, searchQuery, onAcceptUser }) => {
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusVariant = (status) => {
        switch (status) {
            case 'active': return 'gradient-success';
            case 'pending': return 'gradient-warning';
            case 'inactive': return 'error';
            default: return 'ghost';
        }
    };

    return (
        <div className="user-list">
            <div className="user-grid">
                {filteredUsers.map((user) => (
                    <Card key={user.id} className="user-card" hover>
                        <div className="user-card-header">
                            <Avatar
                                src={user.avatar}
                                alt={user.name}
                                size="large"
                                status={user.status === 'active' ? 'online' : 'offline'}
                            />
                            <div className="user-header-info">
                                <h3 className="user-name">{user.name}</h3>
                                <p className="user-email">{user.email}</p>
                            </div>
                        </div>

                        <div className="user-card-body">
                            <span className="user-role">{user.role}</span>
                            <p className="user-joined">Joined: {new Date(user.joinedDate).toLocaleDateString()}</p>
                        </div>

                        {user.status === 'pending' && (
                            <div className="user-card-footer">
                                <GradientButton
                                    variant="accept"
                                    size="small"
                                    fullWidth
                                    onClick={() => onAcceptUser(user.id)}
                                >
                                    Accept Request
                                </GradientButton>
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {filteredUsers.length === 0 && (
                <div className="no-results">
                    <p>No connections found matching your search.</p>
                </div>
            )}
        </div>
    );
};

export default UserList;
