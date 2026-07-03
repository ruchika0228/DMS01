import React, { useRef, useState } from 'react';
import { MdCloudUpload, MdInsertDriveFile, MdClose, MdCheckCircle } from 'react-icons/md';
import api from '../../api/axios';
import ipfsBridge from '../../services/ipfsBridge';
import './FileUpload.css';

const FileUpload = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setSuccess(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            setSelectedFile(file);
            setSuccess(false);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current.click();
    };

    const handleRemove = () => {
        setSelectedFile(null);
        setSuccess(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleUpload = async (e) => {
        e.stopPropagation();
        if (!selectedFile) return;
        setUploading(true);
        setSuccess(false);

        try {
            // 0. Capture JIT location for security audit
            setStatusMessage('Capturing high-accuracy hardware location...');
            const { getJitLocation } = await import('../../utils/geolocation');
            const jitLoc = await getJitLocation();

            // 1. Upload to IPFS via Extension Bridge
            setStatusMessage('Uploading to IPFS (this may take a moment)...');
            const cid = await ipfsBridge.uploadFile(selectedFile);

            // 2. Prepare metadata for backend
            setStatusMessage('Registering document with secure backend...');
            const mockData = {
                file_name: selectedFile.name,
                file_type: selectedFile.name.split('.').pop() || 'unknown',
                file_size: selectedFile.size,
                cid: cid,
                latitude: jitLoc.latitude,
                longitude: jitLoc.longitude,
                accuracy_meters: jitLoc.accuracy,
                device_timestamp: jitLoc.device_timestamp,
                location_tier: jitLoc.tier
            };

            // 3. Save to Backend
            await api.post('/files/upload', mockData);
            setSuccess(true);
            setStatusMessage('Upload Complete!');
            setTimeout(() => {
                setSelectedFile(null);
                setSuccess(false);
                setStatusMessage('');
            }, 3000);
        } catch (error) {
            console.error("Upload failed", error);
            setStatusMessage('');
            
            let errorDetail = error.message;
            if (error.response && error.response.data && error.response.data.detail) {
                errorDetail = error.response.data.detail;
            }
            
            alert(`Upload failed: ${errorDetail}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="file-upload">
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="file-input-hidden"
            />

            <div
                className={`upload-area ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleButtonClick}
            >
                {!selectedFile ? (
                    <>
                        <MdCloudUpload className="upload-icon" />
                        <h3 className="upload-title">Upload Your Files</h3>
                        <p className="upload-description">
                            Click to browse or drag and drop your files here
                        </p>
                        <div className="upload-formats">
                            Supports: PDF, CAD (DWG, STEP, SLDPRT, etc.), DOC, IMG
                        </div>
                    </>
                ) : (
                    <div className="file-preview">
                        <MdInsertDriveFile className="file-icon" />
                        <div className="file-details">
                            <h4 className="file-name">{selectedFile.name}</h4>
                            <p className="file-size">{formatFileSize(selectedFile.size)}</p>
                        </div>
                        {!success && (
                            <button
                                className="remove-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove();
                                }}
                            >
                                <MdClose />
                            </button>
                        )}
                        {success && <MdCheckCircle className="success-icon" />}
                    </div>
                )}
            </div>

            {selectedFile && !success && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <button
                        className="upload-submit-btn"
                        onClick={handleUpload}
                        disabled={uploading}
                    >
                        {uploading ? 'Processing...' : 'Upload File'}
                    </button>
                    {uploading && statusMessage && (
                        <p className="upload-status-text">
                            {statusMessage}
                        </p>
                    )}
                </div>
            )}
            {success && (
                <div className="upload-success-msg">
                    File Uploaded Successfully!
                </div>
            )}
        </div>
    );
};

export default FileUpload;
