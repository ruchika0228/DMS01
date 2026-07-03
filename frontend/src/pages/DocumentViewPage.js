import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import GradientButton from '../components/ui/GradientButton';
import Toast from '../components/ui/Toast';
import SendToModal from '../components/modals/SendToModal';
import HistoryModal from '../components/modals/HistoryModal';
import TranslationModal from '../components/modals/TranslationModal';
import UniversalFileViewer from '../components/UniversalFileViewer';
import { MdArrowBack } from 'react-icons/md';
import { forceLocationUpdate } from '../utils/geolocation';
import './DocumentViewPage.css';

const DocumentViewPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [showSendToModal, setShowSendToModal] = useState(false);
    const [connections, setConnections] = useState([]);

    // History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [fileHistory, setFileHistory] = useState([]);

    // Translation Modal State
    const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);
    const googleApiKey = "AIzaSyDVx0n-Q3S_V7On2Aayocl_4HHATL8BOz0";

    // AI Analysis State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [ocrText, setOcrText] = useState(null);

    // Get file from location state (passed from FileUpload/Vault)
    const [uploadedFile, setUploadedFile] = useState(location.state?.file || null);

    // Parse query parameters
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const fileId = queryParams.get('id');
        const cidFromUrl = queryParams.get('cid');

        if (!uploadedFile && fileId && fileId !== 'undefined') {
            const fetchFileDetails = async () => {
                setLoadingUrl(true);
                try {
                    const response = await api.get(`/files/${fileId}`);
                    const fileData = response.data;
                    setUploadedFile({
                        id: fileData.id,
                        name: fileData.file_name,
                        type: fileData.file_type,
                        size: fileData.file_size,
                        cid: fileData.cid,
                        sections: fileData.sections || []
                    });
                } catch (err) {
                    console.error("Failed to fetch file details from ID", err);
                    // Fallback to CID if fetch fails
                    if (cidFromUrl) {
                        setUploadedFile({
                            id: null,
                            cid: cidFromUrl,
                            name: 'IPFS Document',
                            type: 'unknown'
                        });
                    } else {
                        setToastMessage("Failed to load file details.");
                        setShowToast(true);
                    }
                } finally {
                    setLoadingUrl(false);
                }
            };
            fetchFileDetails();
        } else if (!uploadedFile && cidFromUrl) {
            // Direct CID viewing - try to detect type from head request if possible
            const detectType = async () => {
                setLoadingUrl(true);
                try {
                    // Try to get content-type from a fast gateway
                    const headRes = await fetch(`https://cloudflare-ipfs.com/ipfs/${cidFromUrl}`, { method: 'HEAD' });
                    const contentType = headRes.headers.get('Content-Type');
                    
                    let detectedType = 'unknown';
                    if (contentType) {
                        if (contentType.includes('pdf')) detectedType = 'pdf';
                        else if (contentType.includes('image')) detectedType = contentType.split('/')[1];
                        else if (contentType.includes('word')) detectedType = 'docx';
                        else if (contentType.includes('html')) detectedType = 'html';
                    }

                    setUploadedFile({
                        id: null,
                        cid: cidFromUrl,
                        name: `IPFS Document (${detectedType.toUpperCase()})`,
                        type: detectedType
                    });
                } catch (err) {
                    setUploadedFile({
                        id: null,
                        cid: cidFromUrl,
                        name: 'IPFS Document',
                        type: 'unknown'
                    });
                } finally {
                    setLoadingUrl(false);
                }
            };
            detectType();
        }
    }, [location.search, uploadedFile]);

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const response = await api.get('/connections');
                // Transform to match SendToModal expectation
                const activeFriends = response.data
                    .filter(c => c.status === 'accepted')
                    .map(c => ({
                        id: c.friend_user.id,
                        name: c.friend_user.username,
                        email: c.friend_user.email,
                        status: 'active', // Required for SendToModal filter
                        role: 'Friend', // Placeholder
                        avatar: c.friend_user.profile_picture || null
                    }));
                setConnections(activeFriends);
            } catch (err) {
                console.error("Failed to fetch connections", err);
            }
        };

        fetchConnections();
    }, []);


    const handleAIAnalysis = async () => {
        if (!uploadedFile || !uploadedFile.id || !uploadedFile.cid) {
            setToastMessage("File metadata or IPFS CID missing.");
            setShowToast(true);
            return;
        }

        setIsAnalyzing(true);
        setOcrText(null);
        setToastMessage("Analyzing Document...");
        setShowToast(true);

        try {
            // Use backend proxy to avoid CORS — backend calls the OCR server server-side
            const response = await api.post('/files/ocr-ipfs', {
                cid: uploadedFile.cid,
                file_id: String(uploadedFile.id)
            });

            const data = response.data;
            
            // Handle asynchronous OCR processing status
            if (data.status === 'processing') {
                setOcrText("Document is still being processed by the OCR engine. Please try again in a few moments. (Job ID: " + (data.job_id || 'N/A') + ")");
                setToastMessage("Processing initiated...");
                setShowToast(true);
                return;
            }

            // Extract text from the nested structure provided in the user's example
            let textContent = "";
            if (data.results && Array.isArray(data.results) && data.results.length > 0) {
                textContent = data.results[0].ocr_text || data.results[0].text || "";
            } else {
                textContent = data.extracted_text || data.text || data.result || (typeof data === 'string' ? data : "");
            }

            if (!textContent && typeof data === 'object') {
                // Final fallback if no obvious text field exists
                textContent = JSON.stringify(data, null, 2);
            }

            setOcrText(textContent);
            setToastMessage("Analysis Complete!");
            setShowToast(true);
        } catch (err) {
            console.error("AI Analysis failed", err);
            setToastMessage(err.response?.data?.detail || err.message || "AI analysis failed.");
            setShowToast(true);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSendDocument = async (receiverId, deadline = null, accessControl = 'Read Only') => {
        if (!uploadedFile || !uploadedFile.id) {
            console.error("File ID missing for send");
            setToastMessage("Cannot send: File ID missing.");
            setShowToast(true);
            return;
        }

        try {
            // 0. Capture JIT location for security audit
            console.log("[Send] Capturing hardware location...");
            const { getJitLocation } = await import('../utils/geolocation');
            const jitLoc = await getJitLocation();

            console.log(`[Send] Sending document ${uploadedFile.id} to ${receiverId}...`);
            const response = await api.post('/files/send', {
                file_id: uploadedFile.id,
                receiver_id: receiverId,
                due_date: deadline || null,
                access_control: accessControl,
                latitude: jitLoc.latitude,
                longitude: jitLoc.longitude,
                accuracy_meters: jitLoc.accuracy,
                device_timestamp: jitLoc.device_timestamp,
                location_tier: jitLoc.tier
            });

            if (response.data && response.data.sync_success === false) {
                setToastMessage(`Document sent, but blockchain sync delayed: ${response.data.sync_message || 'Unknown issue'}`);
            } else {
                setToastMessage(`Document sent to user successfully!`);
            }
            setShowToast(true);
        } catch (err) {
            console.error("Failed to send document error object:", err);
            let detail = "Unknown error";

            if (err.response) {
                // Server responded with non-2xx
                detail = err.response.data?.detail || `Server Error (${err.response.status})`;
            } else if (err.request) {
                // Request made but no response (CORS or Network issue)
                detail = "Network error or CORS block. Check if backend is running and origins match.";
            } else {
                detail = err.message || "Request setup error";
            }

            setToastMessage(`Failed to send: ${detail}`);
            setShowToast(true);
        } finally {
            // End processing
        }
    };

    const handleOpenHistory = async () => {
        if (!uploadedFile || !uploadedFile.id) {
            setToastMessage("Cannot fetch history: File ID missing.");
            setShowToast(true);
            return;
        }

        setIsHistoryModalOpen(true);
        try {
            const response = await api.get(`/files/${uploadedFile.id}/history`);
            setFileHistory(response.data);
        } catch (err) {
            console.error("Failed to fetch history", err);
            setToastMessage("Failed to fetch history.");
            setShowToast(true);
        }
    };

    const handleOpenTranslation = async () => {
        if (!uploadedFile || !uploadedFile.id) {
            setToastMessage("Cannot translate: File metadata missing.");
            setShowToast(true);
            return;
        }

        // If ocrText is already present, just open the modal
        if (ocrText) {
            setIsTranslationModalOpen(true);
            return;
        }

        // Otherwise, try to fetch it from the database/OCR service
        setIsAnalyzing(true);
        setToastMessage("Fetching document text...");
        setShowToast(true);

        try {
            const response = await api.post('/files/ocr-ipfs', {
                cid: uploadedFile.cid,
                file_id: String(uploadedFile.id)
            });

            const data = response.data;
            let textContent = "";
            if (data.results && Array.isArray(data.results) && data.results.length > 0) {
                textContent = data.results[0].ocr_text || data.results[0].text || "";
            } else {
                textContent = data.extracted_text || data.text || data.result || (typeof data === 'string' ? data : "");
            }

            if (!textContent && typeof data === 'object') {
                textContent = JSON.stringify(data, null, 2);
            }

            if (textContent) {
                setOcrText(textContent);
                setIsTranslationModalOpen(true);
                setToastMessage("Text fetched successfully!");
            } else {
                setToastMessage("No text could be extracted from this document.");
            }
            setShowToast(true);
        } catch (err) {
            console.error("Failed to fetch OCR text", err);
            setToastMessage("Failed to fetch document text for translation.");
            setShowToast(true);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    // Determine file type and return appropriate viewer
    const getFileViewer = () => {
        if (!uploadedFile) {
            // Show default dummy content if no file uploaded
            return <DummyDocumentContent />;
        }

        return <UniversalFileViewer file={uploadedFile} url={fileUrl} />;
    };

    const getDocumentTitle = () => {
        if (uploadedFile) {
            return uploadedFile.name || uploadedFile.file_name;
        }
        return 'Project Documentation';
    };

    // IPFS URL Fallback Logic
    const [fileUrl, setFileUrl] = useState(null);
    const [loadingUrl, setLoadingUrl] = useState(false);

    useEffect(() => {
        const resolveFileUrl = async () => {
            if (!uploadedFile) return;
            
            const cid = uploadedFile.cid;
            const fileId = uploadedFile.id;

            if (!cid && !fileId) return;

            setLoadingUrl(true);
            
            // Priority 1: Try Local IPFS Gateway (Instant if user has IPFS node)
            if (cid) {
                const localUrl = `http://127.0.0.1:8080/ipfs/${cid}`;
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout for local check
                    
                    await fetch(localUrl, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
                    clearTimeout(timeoutId);
                    setFileUrl(localUrl);
                    setLoadingUrl(false);
                    return; // Success!
                } catch (e) {
                    console.warn("[IPFS] Local gateway unreachable or timed out.");
                }
            }

            // Priority 2: Fast Public Gateways & Backend Download in Parallel
            const gateways = cid ? [
                `https://cloudflare-ipfs.com/ipfs/${cid}`,
                `https://ipfs.io/ipfs/${cid}`,
                `https://gateway.pinata.cloud/ipfs/${cid}`,
                `https://dweb.link/ipfs/${cid}`
            ] : [];

            try {
                // We create an array of promises and use Promise.any to find the first one that actually has data
                const downloadPromise = fileId && fileId !== 'undefined' ? 
                    api.get(`/files/${fileId}/download`, { responseType: 'blob' })
                        .then(res => URL.createObjectURL(res.data)) : 
                    Promise.reject("No file ID");

                const gatewayPromises = gateways.map(gUrl => 
                    fetch(gUrl, { method: 'GET' }) // Use GET to ensure we can actually fetch it
                        .then(res => {
                            if (!res.ok) throw new Error("Gateway error");
                            return gUrl; // Return the URL itself for iframe/img use
                        })
                );

                const fastestUrl = await Promise.any([...gatewayPromises, downloadPromise]);
                setFileUrl(fastestUrl);
                console.log("Resolved file URL:", fastestUrl);
            } catch (error) {
                console.error("All file resolution methods failed", error);
                setToastMessage("Content not found on IPFS or Registry. Please check if the document is still propagating.");
                setShowToast(true);
            } finally {
                setLoadingUrl(false);
            }
        };

        resolveFileUrl();

        return () => {
            // Memory cleanup: revoke blob URLs when component unmounts
            if (fileUrl && fileUrl.startsWith('blob:')) {
                URL.revokeObjectURL(fileUrl);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uploadedFile]);

    const getDocumentSubtitle = () => {
        if (uploadedFile) {
            const fileSize = ((uploadedFile.size || uploadedFile.file_size || 0) / 1024).toFixed(2);
            return `${fileSize} KB • ${uploadedFile.type || uploadedFile.file_type || 'Unknown type'} ${uploadedFile.cid ? '• IPFS' : ''}`;
        }
        return 'File Management System Overview';
    };

    return (
        <div className="document-view-page">
            {/* Page Header */}
            <div className="page-header document-view-header">
                <div className="header-left">
                    <button className="back-button icon-only" onClick={handleGoBack} title="Back">
                        <MdArrowBack />
                    </button>
                    <h1 className="page-title">Document Viewer</h1>
                </div>
                <div className="header-right">
                    <GradientButton
                        variant="primary"
                        size="small"
                        onClick={handleOpenHistory}
                        className="history-btn"
                    >
                        History
                    </GradientButton>
                    <GradientButton
                        variant="primary"
                        size="small"
                        onClick={handleOpenTranslation}
                    >
                        Translation
                    </GradientButton>
                    <GradientButton
                        variant="primary"
                        size="small"
                        onClick={() => setShowSendToModal(true)}
                    >
                        Send To
                    </GradientButton>
                    <GradientButton
                        variant="accept"
                        size="small"
                        onClick={handleAIAnalysis}
                    >
                        AI Analysis
                    </GradientButton>
                </div>
            </div>

            {/* Document Container */}
            <div className="document-container">
                <div className="document-content">
                    {/* Document Header */}
                    <div className="document-header">
                        <h1 className="document-title">{getDocumentTitle()}</h1>
                        <p className="document-subtitle">{getDocumentSubtitle()}</p>
                        {uploadedFile && (
                            <div className="document-meta">
                                {location.state?.receivedFrom && (
                                    <>
                                        <span className="meta-item">
                                            From: <strong>{location.state.receivedFrom.name}</strong>
                                        </span>
                                        <span className="meta-divider">•</span>
                                    </>
                                )}
                                <span className="meta-item">
                                    {location.state?.receivedDate
                                        ? `Received: ${new Date(location.state.receivedDate).toLocaleString()}`
                                        : `Uploaded: ${new Date().toLocaleString()}`
                                    }
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Document Viewer */}
                    <div className="document-viewer-container">
                        {loadingUrl ? (
                            <div className="loading-url">Resolving IPFS Content...</div>
                        ) : (
                            getFileViewer()
                        )}
                    </div>

                    {/* AI Analysis Result Section */}
                    {(isAnalyzing || ocrText) && (
                        <div className="ocr-result-section">
                            <h2 className="ocr-title">
                                {isAnalyzing ? "AI Analysis in Progress..." : "AI Extracted Text"}
                            </h2>
                            <div className="ocr-content-wrapper">
                                {isAnalyzing ? (
                                    <div className="ocr-loading-spinner">
                                        <div className="spinner"></div>
                                        <p>Running elite-grade OCR engine...</p>
                                    </div>
                                ) : (
                                    <pre className="ocr-text">{ocrText}</pre>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Toast Notification */}
            {showToast && (
                <Toast
                    message={toastMessage}
                    type="info"
                    duration={3000}
                    onClose={() => setShowToast(false)}
                />
            )}

            {/* Send To Modal */}
            <SendToModal
                isOpen={showSendToModal}
                onClose={() => setShowSendToModal(false)}
                users={connections}
                documentName={getDocumentTitle()}
                fileId={uploadedFile?.id}
                onSend={handleSendDocument}
            />

            {/* History Modal */}
            <HistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                fileName={getDocumentTitle()}
                history={fileHistory}
            />

            {/* Translation Modal */}
            <TranslationModal
                isOpen={isTranslationModalOpen}
                onClose={() => setIsTranslationModalOpen(false)}
                text={ocrText}
                apiKey={googleApiKey}
            />
        </div>
    );
};

// Dummy content component (shown when no file is uploaded)
const DummyDocumentContent = () => {
    return (
        <div className="document-body">
            {/* Introduction Section */}
            <section className="document-section">
                <h2 className="section-title">Introduction</h2>
                <p className="section-content">
                    The Document Management System (DMS) represents a paradigm shift in how organizations
                    handle their digital assets. Built on cutting-edge decentralized technology, DMS
                    provides enterprise-grade security while maintaining the flexibility and accessibility
                    users demand in modern cloud solutions.
                </p>
                <p className="section-content">
                    In an era where data sovereignty and security are paramount, DMS offers a solution
                    that eliminates single points of failure while ensuring your files remain accessible
                    from anywhere in the world. Our innovative approach combines the reliability of
                    traditional file systems with the resilience of distributed networks.
                </p>
            </section>

            {/* Features Section */}
            <section className="document-section">
                <h2 className="section-title">Core Features</h2>
                <p className="section-content">
                    Our platform offers comprehensive file management capabilities designed for the
                    modern enterprise. Each feature has been carefully crafted to provide maximum
                    value while maintaining simplicity and ease of use.
                </p>
            </section>

            {/* IPFS Integration Section */}
            <section className="document-section">
                <h2 className="section-title">IPFS Integration</h2>
                <p className="section-content">
                    Integration with the InterPlanetary File System (IPFS) ensures your data remains
                    accessible and secure without relying on centralized servers. This revolutionary
                    approach to file storage provides numerous advantages over traditional cloud solutions.
                </p>
            </section>
        </div>
    );
};

export default DocumentViewPage;
