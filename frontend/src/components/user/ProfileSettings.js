import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPerson, MdEmail, MdLogout, MdCameraAlt, MdVpnKey, MdAutoFixHigh, MdCheckCircle, MdSync } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './ProfileSettings.css';

const ProfileSettings = ({ user, onClose }) => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [profilePhoto, setProfilePhoto] = useState(user?.profile_picture || null);
    const [selectedFileSource, setSelectedFileSource] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Auto OCR State
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0, status: '' });

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePhoto(reader.result);
                setSelectedFileSource(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSavePhoto = async () => {
        if (!selectedFileSource) return;
        setIsSaving(true);
        try {
            await api.put('/auth/me/profile-picture', {
                profile_picture: selectedFileSource
            });
            alert('Profile picture updated successfully!');
            setSelectedFileSource(null);
            // Optionally could force context refresh depending on how the frontend handles state.
        } catch (error) {
            console.error('Failed to upload picture:', error);
            alert('Failed to update profile picture.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        logout();
        if (onClose) onClose();
        navigate('/');
    };

    const handleAutoOCR = async () => {
        setIsProcessingOCR(true);
        setOcrProgress({ current: 0, total: 0, status: 'Scanning vault...' });
        
        try {
            const pendingRes = await api.get('/files/pending-ocr');
            const pendingFiles = pendingRes.data;
            
            if (pendingFiles.length === 0) {
                setOcrProgress({ current: 0, total: 0, status: 'Vault is fully analyzed!' });
                setTimeout(() => setIsProcessingOCR(false), 3000);
                return;
            }

            setOcrProgress({ current: 0, total: pendingFiles.length, status: 'Starting Auto-OCR...' });

            for (let i = 0; i < pendingFiles.length; i++) {
                const file = pendingFiles[i];
                setOcrProgress(prev => ({ ...prev, current: i + 1, status: `OCR: ${file.file_name}` }));
                try {
                    await api.post('/files/ocr-ipfs', { cid: file.cid, file_id: file.id });
                } catch (err) {
                    console.error(`OCR Fail: ${file.file_name}`, err);
                }
            }

            setOcrProgress({ current: pendingFiles.length, total: pendingFiles.length, status: 'Success! Vault Updated.' });
            setTimeout(() => setIsProcessingOCR(false), 3000);
        } catch (error) {
            console.error('Auto OCR Error:', error);
            let errorMsg = 'Process failed.';
            
            if (error.response?.data?.detail) {
                errorMsg = typeof error.response.data.detail === 'string' 
                    ? error.response.data.detail 
                    : JSON.stringify(error.response.data.detail);
            } else if (error.message) {
                errorMsg = error.message;
            } else if (typeof error === 'string') {
                errorMsg = error;
            } else {
                errorMsg = JSON.stringify(error);
            }

            setOcrProgress({ current: 0, total: 0, status: `Error: ${errorMsg}` });
            setTimeout(() => setIsProcessingOCR(false), 6000);
        }
    };

    return (
        <div className="profile-settings">
            <div className="profile-settings-header">
                <div className="profile-photo-container">
                    <div className="profile-photo-wrapper">
                        {profilePhoto ? (
                            <img src={profilePhoto} alt="Profile" className="profile-photo" />
                        ) : (
                            <div className="profile-photo-placeholder">
                                <MdPerson className="profile-photo-icon" />
                            </div>
                        )}
                        <div className="profile-photo-glow"></div>
                        <label htmlFor="photo-upload" className="photo-upload-button">
                            <MdCameraAlt className="camera-icon" />
                            <input
                                type="file"
                                id="photo-upload"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>
                </div>
                <div className="profile-names">
                    <h2 className="profile-username">{user?.username}</h2>
                    <p className="profile-status">Operator Active</p>
                </div>
                {selectedFileSource && (
                    <button
                        className="save-photo-button"
                        onClick={handleSavePhoto}
                        disabled={isSaving}
                        style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {isSaving ? 'Saving...' : 'Save Photo'}
                    </button>
                )}
            </div>

            <div className="profile-settings-body">
                <div className="profile-section-header">
                    <span className="section-title">Identity Credentials</span>
                    <div className="section-line"></div>
                </div>

                <div className="profile-info-item">
                    <div className="info-icon-wrapper">
                        <MdPerson className="info-icon" />
                    </div>
                    <div className="info-details">
                        <div className="info-label">Username</div>
                        <div className="info-value">{user?.username}</div>
                    </div>
                </div>

                <div className="profile-info-item">
                    <div className="info-icon-wrapper">
                        <MdEmail className="info-icon" />
                    </div>
                    <div className="info-details">
                        <div className="info-label">Email</div>
                        <div className="info-value">{user?.email}</div>
                    </div>
                </div>

                <div className="profile-info-item">
                    <div className="info-icon-wrapper">
                        <MdVpnKey className="info-icon" />
                    </div>
                    <div className="info-details">
                        <div className="info-label">Friend Code</div>
                        <div className="info-value">{user?.friend_code}</div>
                    </div>
                </div>

                <div className={`profile-info-item ${isProcessingOCR ? 'processing' : ''}`} 
                     onClick={!isProcessingOCR ? handleAutoOCR : null}
                     style={{ cursor: isProcessingOCR ? 'default' : 'pointer', borderLeft: isProcessingOCR ? '3px solid var(--color-primary)' : '1px solid var(--glass-border)', marginTop: '10px' }}>
                    <div className="info-icon-wrapper">
                        {isProcessingOCR ? <MdSync className="info-icon spinning" /> : <MdAutoFixHigh className="info-icon" />}
                    </div>
                    <div className="info-details">
                        <div className="info-label">Vault Intelligence</div>
                        <div className="info-value">
                            {isProcessingOCR 
                                ? `Processing ${ocrProgress.current}/${ocrProgress.total}`
                                : 'Run Auto OCR (Batch Process)'}
                        </div>
                        {isProcessingOCR && (
                            <div style={{ fontSize: '10px', color: 'var(--color-primary)', marginTop: '4px', fontStyle: 'italic' }}>
                                {ocrProgress.status}
                            </div>
                        )}
                    </div>
                    {!isProcessingOCR && <MdCheckCircle style={{ color: 'var(--color-primary)', opacity: 0.5 }} />}
                </div>
            </div>

            <div className="profile-settings-footer">
                <button className="logout-button" onClick={handleLogout}>
                    <MdLogout className="logout-icon" />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
};

export default ProfileSettings;
