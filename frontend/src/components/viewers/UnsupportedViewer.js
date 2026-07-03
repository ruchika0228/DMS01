import React from 'react';
import { MdWarning } from 'react-icons/md';
import './UnsupportedViewer.css';

const UnsupportedViewer = ({ file }) => {
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const getFileExtension = (filename) => {
        return filename.split('.').pop().toUpperCase();
    };

    return (
        <div className="unsupported-viewer">
            <div className="unsupported-content">
                <MdWarning className="warning-icon" />
                <h3 className="unsupported-title">Preview Not Available</h3>
                <p className="unsupported-message">
                    This file format is not supported for preview.
                </p>

                <div className="file-info-card">
                    <div className="file-info-row">
                        <span className="info-label">File Name:</span>
                        <span className="info-value">{file?.name || 'Unknown'}</span>
                    </div>
                    <div className="file-info-row">
                        <span className="info-label">File Type:</span>
                        <span className="info-value">{getFileExtension(file?.name || '')}</span>
                    </div>
                    <div className="file-info-row">
                        <span className="info-label">File Size:</span>
                        <span className="info-value">{formatFileSize(file?.size || 0)}</span>
                    </div>
                </div>

                <div className="supported-formats">
                    <h4>Supported Formats:</h4>
                    <ul>
                        <li>Images: PNG, JPG, JPEG, GIF, WEBP, SVG</li>
                        <li>Documents: PDF, DOCX, TXT</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default UnsupportedViewer;
