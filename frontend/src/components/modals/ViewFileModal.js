import React from 'react';
import { MdClose } from 'react-icons/md';
import UniversalFileViewer from '../UniversalFileViewer';
import './ViewFileModal.css';

const ViewFileModal = ({ isOpen, onClose, file, url }) => {
    if (!isOpen || !file) return null;

    return (
        <div className="view-file-modal-overlay" onClick={onClose}>
            <div className="view-file-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="view-file-modal-header">
                    <h2>{file.file_name}</h2>
                    <button className="close-btn" onClick={onClose}>
                        <MdClose />
                    </button>
                </div>
                <div className="view-file-modal-body">
                    <UniversalFileViewer file={file} url={url} />
                </div>
            </div>
        </div>
    );
};

export default ViewFileModal;
