import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/ui/Avatar';
import GradientButton from '../components/ui/GradientButton';
import Button from '../components/ui/Button';
import LocationMapModal from '../components/modals/LocationMapModal';
import api from '../api/axios';
import ipfsBridge from '../services/ipfsBridge';
import { MdInsertDriveFile, MdImage, MdPictureAsPdf, MdDescription, MdArrowBack } from 'react-icons/md';
import { IoCopy, IoCloudDownload, IoCloudUpload } from 'react-icons/io5';
import './ReceivedDocumentsPage.css';

const ReceivedDocumentsPage = () => {
    const navigate = useNavigate();
    // eslint-disable-next-line no-unused-vars
    const [startDate, setStartDate] = useState('');
    // eslint-disable-next-line no-unused-vars
    const [endDate, setEndDate] = useState('');
    const [documents, setDocuments] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [uploadingDocId, setUploadingDocId] = useState(null);
    const fileInputRef = React.useRef(null);
    const [selectedDocForUpload, setSelectedDocForUpload] = useState(null);
    const [mapModal, setMapModal] = useState({ isOpen: false, lat: null, lng: null, address: '', title: '' });

    useEffect(() => {
        const fetchDocuments = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/files/received?page=${page}&size=20`);
                const mappedDocs = response.data.items.map(doc => ({
                    id: doc.id,
                    fileId: doc.file?.id || '',
                    documentName: doc.file?.file_name || 'Unknown Document',
                    fileType: doc.file?.file_type || 'unknown',
                    fileSize: doc.file?.file_size || 0,
                    sections: doc.file?.sections || [],
                    description: `Received from ${doc.sender?.username || 'Unknown Sender'}`,
                    sender: {
                        name: doc.sender?.username || 'Unknown Sender',
                        email: doc.sender?.email || '',
                        avatar: doc.sender?.profile_picture || null
                    },
                    receivedDate: doc.sent_at,
                    accessControl: doc.access_control,
                    deadline: doc.deadline,
                    cid: doc.file?.cid || '', // Ensure CID is available for pinning logic
                    senderLat: doc.sender_latitude,
                    senderLng: doc.sender_longitude,
                    senderAddr: doc.sender_address,
                    receiverLat: doc.receiver_latitude,
                    receiverLng: doc.receiver_longitude,
                    receiverAddr: doc.receiver_address
                }));
                setDocuments(mappedDocs);
                setTotalPages(response.data.pages);
                setLoading(false);

                // Auto-pin files
                mappedDocs.forEach(doc => {
                    if (doc.cid) {
                        ipfsBridge.pinFile(doc.cid);
                    }
                });
            } catch (err) {
                console.error("Failed to fetch received documents", err);
                setDocuments([]); // Ensure it's reset
                setLoading(false);
            }
        };

        fetchDocuments();
    }, [page]);

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getFileIcon = (fileType) => {
        if (['jpg', 'png', 'jpeg', 'gif'].includes(fileType)) {
            return <MdImage className="file-type-icon image" />;
        } else if (fileType === 'pdf') {
            return <MdPictureAsPdf className="file-type-icon pdf" />;
        } else if (['doc', 'docx', 'txt'].includes(fileType)) {
            return <MdDescription className="file-type-icon doc" />;
        } else {
            return <MdInsertDriveFile className="file-type-icon default" />;
        }
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    const handlePreview = async (document) => {
        try {
            // Force location update and record receipt
            const { forceLocationUpdate } = await import('../utils/geolocation');
            const coords = await forceLocationUpdate();

            // Call the backend to record the receipt of the file
            await api.put(`/files/transfer/${document.id}/receive`, {
                latitude: coords ? String(coords.latitude) : null,
                longitude: coords ? String(coords.longitude) : null,
                location_string: "Current Location" // Trigger placeholder logic
            });
        } catch (error) {
            console.error("Geolocation failed or receipt record failed", error);
            alert("Location permission is required to view received documents.");
            return;
        }

        const mockFile = {
            id: document.fileId,
            name: document.documentName,
            type: document.fileType,
            size: document.fileSize,
            cid: document.cid,
            sections: document.sections || []
        };

        navigate('/document-view', {
            state: {
                file: mockFile,
                receivedFrom: document.sender,
                receivedDate: document.receivedDate,
                description: document.description
            }
        });
    };

    const handleDownload = async (document) => {
        try {
            // Force location update and record receipt
            const { forceLocationUpdate } = await import('../utils/geolocation');
            const coords = await forceLocationUpdate();

            // Call the backend to record the receipt of the file
            await api.put(`/files/transfer/${document.id}/receive`, {
                latitude: coords ? String(coords.latitude) : null,
                longitude: coords ? String(coords.longitude) : null,
                location_string: "Current Location" // Trigger placeholder logic
            });
        } catch (error) {
            console.error("Geolocation failed or receipt record failed", error);
            alert("Location permission is required to download received documents.");
            return;
        }

        try {
            const response = await api.get(`/files/${document.fileId}/download`, {
                responseType: 'blob'
            });

            let filename = document.documentName;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const blobUrl = window.URL.createObjectURL(response.data);
            const link = window.document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

        } catch (error) {
            console.error("Download failed:", error);
            alert("Failed to download file.");
        }
    };

    const handleUploadClick = (document) => {
        setSelectedDocForUpload(document);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file || !selectedDocForUpload) return;

        // Reset input so the exact same file can be selected again if needed
        event.target.value = '';

        setUploadingDocId(selectedDocForUpload.id);

        try {
            // 0. Force location update before proceeding
            const { forceLocationUpdate } = await import('../utils/geolocation');
            await forceLocationUpdate();

            // 1. Upload to IPFS via Extension Bridge
            const newCid = await ipfsBridge.uploadFile(file);

            // 2. Prepare metadata for backend
            const updateData = {
                cid: newCid,
                file_name: file.name,
                file_type: file.name.split('.').pop() || 'unknown',
                file_size: file.size
            };

            // 3. Save to Backend
            const response = await api.put(`/files/${selectedDocForUpload.fileId}/update`, updateData);
            const updatedFile = response.data;

            // 4. Update UI State
            setDocuments(prevDocs => prevDocs.map(doc => {
                if (doc.id === selectedDocForUpload.id) {
                    return {
                        ...doc,
                        documentName: updatedFile.file_name,
                        fileType: updatedFile.file_type || 'unknown',
                        fileSize: updatedFile.file_size,
                        cid: updatedFile.cid
                    };
                }
                return doc;
            }));

            // 5. Pin the new CID
            ipfsBridge.pinFile(updatedFile.cid);

            alert("File updated successfully!");
        } catch (error) {
            console.error("Update failed", error);
            alert(`Update failed: ${error.message}`);
        } finally {
            setUploadingDocId(null);
            setSelectedDocForUpload(null);
        }
    };

    // Filter documents based on date range
    const filteredDocuments = useMemo(() => {
        return documents.filter(doc => {
            // Filter by date range
            const docDate = new Date(doc.receivedDate);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            let matchesDate = true;
            if (start && end) {
                matchesDate = docDate >= start && docDate <= end;
            } else if (start) {
                matchesDate = docDate >= start;
            } else if (end) {
                matchesDate = docDate <= end;
            }

            return matchesDate;
        });
    }, [startDate, endDate, documents]);

    const handleCopyId = (id) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(id)
                .then(() => alert("File ID copied to clipboard!"))
                .catch(err => console.error("Failed to copy: ", err));
        } else {
            // Fallback for non-secure contexts (HTTP)
            const textArea = document.createElement("textarea");
            textArea.value = id;

            // Ensure it's not visible but part of the DOM
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);

            textArea.focus();
            textArea.select();

            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    alert("File ID copied to clipboard!");
                } else {
                    console.error("Fallback: Copy command was unsuccessful");
                }
            } catch (err) {
                console.error("Fallback: Oops, unable to copy", err);
            }

            document.body.removeChild(textArea);
        }
    };

    const handleViewOnMap = (lat, lng, address, title) => {
        if (!lat || !lng || lat === '0' || lng === '0') return;
        setMapModal({ isOpen: true, lat, lng, address, title });
    };

    return (
        <div className="received-documents-page">
            <LocationMapModal 
                isOpen={mapModal.isOpen}
                onClose={() => setMapModal({ ...mapModal, isOpen: false })}
                lat={mapModal.lat}
                lng={mapModal.lng}
                address={mapModal.address}
                title={mapModal.title}
            />
            <div className="page-header page-header-with-filters">
                <div className="header-left">
                    <button className="back-button icon-only" onClick={handleGoBack} title="Back">
                        <MdArrowBack />
                    </button>
                    <div>
                        <h1 className="page-title">Received Documents</h1>
                        <p className="page-subtitle">
                            Documents shared with you • {filteredDocuments.length} documents
                        </p>
                    </div>
                </div>

            </div>

            {/* Hidden File Input for Uploading */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            <div className="documents-list">
                {loading ? (
                    <p>Loading documents...</p>
                ) : filteredDocuments.length === 0 ? (
                    <div className="no-documents">
                        <p>No documents found</p>
                    </div>
                ) : (
                    filteredDocuments.map((document) => (
                        <div key={document.id} className="document-card glass-card selection-glow">
                            <div className="document-icon">
                                {getFileIcon(document.fileType)}
                            </div>

                            <div className="document-info">
                                <h3 className="document-name">
                                    {document.documentName}
                                    {document.accessControl === 'View' ? (
                                        <span className="badge-status warning">View Only</span>
                                    ) : (
                                        <span className="badge-status success">Can Update</span>
                                    )}
                                    {document.deadline && new Date() > new Date(document.deadline) && (
                                        <span className="badge-status error">Expired</span>
                                    )}
                                </h3>
                                <p className="document-description">{document.description}</p>

                                <div className="document-meta">
                                    <div className="sender-info">
                                        <Avatar
                                            src={document.sender.avatar}
                                            alt={document.sender.name}
                                            size="small"
                                        />
                                        <div className="sender-details">
                                            <span className="sender-name">{document.sender.name}</span>
                                            <span className="sender-email">{document.sender.email}</span>
                                        </div>
                                    </div>

                                    {/* Location Info */}
                                    <div className="location-info-block">
                                        <div className="location-row">
                                            <span className="location-label">From: </span>
                                            <span className="location-addr" title={document.senderAddr}>{document.senderAddr || 'Unknown'}</span>
                                            {document.senderLat && document.senderLat !== '0' && (
                                                <button className="map-btn-mini" onClick={() => handleViewOnMap(document.senderLat, document.senderLng, document.senderAddr, `Sender Location: ${document.documentName}`)}>📍</button>
                                            )}
                                        </div>
                                        {document.receiverLat && document.receiverLat !== '0' && (
                                            <div className="location-row">
                                                <span className="location-label">To: </span>
                                                <span className="location-addr" title={document.receiverAddr}>{document.receiverAddr || 'Unknown'}</span>
                                                <button className="map-btn-mini" onClick={() => handleViewOnMap(document.receiverLat, document.receiverLng, document.receiverAddr, `Receiver Location: ${document.documentName}`)}>📍</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="document-stats">
                                        <span className="stat-item">
                                            {formatFileSize(document.fileSize)}
                                        </span>
                                        <span className="stat-divider">•</span>
                                        <span className="stat-item">
                                            {formatDate(document.receivedDate)}
                                        </span>
                                    </div>
                                    <div className="document-id-container">
                                        <span>File ID: {document.fileId.substring(0, 8)}...</span>
                                        <button className="copy-btn" onClick={() => handleCopyId(document.fileId)} title="Copy Full ID">
                                            <IoCopy />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="document-actions">
                                <GradientButton
                                    variant="accept"
                                    size="small"
                                    onClick={() => handlePreview(document)}
                                >
                                    Preview
                                </GradientButton>
                                <Button
                                    size="small"
                                    variant="outline"
                                    onClick={() => handleDownload(document)}
                                >
                                    <IoCloudDownload /> Download
                                </Button>
                                {document.accessControl === 'View & Update' && (!document.deadline || new Date() < new Date(document.deadline)) && (
                                    <Button
                                        size="small"
                                        variant="outline"
                                        onClick={() => handleUploadClick(document)}
                                        disabled={uploadingDocId === document.id}
                                    >
                                        {uploadingDocId === document.id ? (
                                            <span>...</span>
                                        ) : (
                                            <><IoCloudUpload /> Upload</>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem', paddingBottom: '2rem' }}>
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Previous
                    </Button>
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ReceivedDocumentsPage;
