import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import api from '../api/axios';
import ipfsBridge from '../services/ipfsBridge';
import { useAuth } from '../context/AuthContext';
import GradientButton from '../components/ui/GradientButton';
import Toast from '../components/ui/Toast';
import { MdArrowBack, MdSave } from 'react-icons/md';
import { forceLocationUpdate } from '../utils/geolocation';
import './RedactionPage.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const RedactionPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    // UI State
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('info');
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Document State
    const [fileData, setFileData] = useState(null);
    const [fileUrl, setFileUrl] = useState(null);
    const [fileType, setFileType] = useState('unknown');

    // Canvas & Drawing State
    const containerRef = useRef(null);
    const sourceCanvasRef = useRef(null);
    const interactionCanvasRef = useRef(null);

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentRect, setCurrentRect] = useState(null);
    const [redactions, setRedactions] = useState([]);

    // Location State
    const {
        file_id,
        documentName,
        userName,
        deadline,
        accessControl,
        isBatch,
        recipientId // Extracted for single sends. Might need adjustment if your `send` endpoint needs an array for batch.
    } = location.state || {};

    // 1. Fetch File Data
    useEffect(() => {
        const fetchFileInfo = async () => {
            if (!file_id) {
                setLoading(false);
                return;
            }
            try {
                const response = await api.get(`/files/${file_id}`);
                setFileData(response.data);

                const type = response.data?.file_type?.toLowerCase() ||
                    response.data?.name?.split('.').pop()?.toLowerCase() ||
                    'unknown';
                setFileType(type);

                // Fetch file as blob via backend proxy to avoid IPFS SSL/CORS issues
                const fetchFileBlob = async () => {
                    try {
                        const blobResponse = await api.get(`/files/${file_id}/download`, {
                            responseType: 'blob'
                        });
                        const blobUrl = URL.createObjectURL(blobResponse.data);
                        setFileUrl(blobUrl);
                    } catch (blobErr) {
                        console.error("Backend proxy failed, attempting direct IPFS fetch...", blobErr);
                        
                        // FALLBACK: If backend fails (e.g. server blocked by gateways), 
                        // try fetching directly via the browser's IPFS bridge.
                        try {
                            const cid = response.data.cid;
                            if (cid) {
                                // We try a high-performance public gateway from the browser
                                // which is usually NOT blocked like the server is.
                                const browserGateways = [
                                    `https://cloudflare-ipfs.com/ipfs/${cid}`,
                                    `https://ipfs.io/ipfs/${cid}`,
                                    `https://dweb.link/ipfs/${cid}`
                                ];
                                
                                let success = false;
                                for (const url of browserGateways) {
                                    try {
                                        const res = await fetch(url);
                                        if (res.ok) {
                                            const blob = await res.blob();
                                            const blobUrl = URL.createObjectURL(blob);
                                            setFileUrl(blobUrl);
                                            success = true;
                                            console.log("Direct browser fetch successful!");
                                            break;
                                        }
                                    } catch (e) { continue; }
                                }
                                
                                if (!success) {
                                    throw new Error("All browser gateways failed.");
                                }
                            }
                        } catch (fallbackErr) {
                            console.error("Direct fetch also failed", fallbackErr);
                            showNotification("Failed to load document preview. Gateway access is currently restricted.", "error");
                        }
                    }
                };
                fetchFileBlob();

            } catch (err) {
                console.error("Failed to fetch file info", err);
                showNotification("Failed to load document information.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchFileInfo();
    }, [file_id]);

    const showNotification = (msg, type = 'info') => {
        setToastMessage(msg);
        setToastType(type);
        setShowToast(true);
    };

    // 2. Render Image to Canvas (If it's an image)
    useEffect(() => {
        if (!fileUrl || loading || fileType === 'pdf') return;

        const img = new Image();
        // Since we are using an object URL from the same origin (blob:), 
        // crossOrigin is no longer strictly needed for IPFS but good to keep if needed elsewhere.
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            setDimensions({ width: img.width, height: img.height });

            setTimeout(() => {
                const canvas = sourceCanvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    redrawInteractionLayer(redactions, null);
                }
            }, 50);
        };
        img.onerror = () => {
            console.error("Failed to load image for canvas");
            showNotification("Failed to load image preview into editor.", "error");
        };
        img.src = fileUrl;

        // Cleanup object URL
        return () => {
            if (fileUrl && fileUrl.startsWith('blob:')) {
                URL.revokeObjectURL(fileUrl);
            }
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileUrl, loading, fileType]);

    // PDF Handlers
    const onPdfLoadSuccess = ({ numPages }) => {
        // Just acknowledging load. Usually we'd handle multipage here.
    };

    const renderPdfPageToCanvas = (pageData) => {
        // react-pdf renders its own invisible canvas. We grab it and copy it to ours.
        setTimeout(() => {
            const pdfCanvas = document.querySelector('.react-pdf__Page__canvas');
            if (pdfCanvas) {
                setDimensions({ width: pdfCanvas.width, height: pdfCanvas.height });

                setTimeout(() => {
                    const myCanvas = sourceCanvasRef.current;
                    if (myCanvas) {
                        const ctx = myCanvas.getContext('2d');
                        ctx.drawImage(pdfCanvas, 0, 0);
                        redrawInteractionLayer(redactions, null);

                        // Hide the react-pdf canvas since we drew it on ours
                        pdfCanvas.style.display = 'none';
                    }
                }, 50);
            }
        }, 500);
    };


    // --- Drawing Logic ---
    const getMousePos = (e) => {
        const canvas = interactionCanvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const handleMouseDown = (e) => {
        const pos = getMousePos(e);
        setIsDrawing(true);
        setStartPos(pos);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing) return;
        const pos = getMousePos(e);

        const rect = {
            x: Math.min(startPos.x, pos.x),
            y: Math.min(startPos.y, pos.y),
            width: Math.abs(pos.x - startPos.x),
            height: Math.abs(pos.y - startPos.y)
        };

        setCurrentRect(rect);
        redrawInteractionLayer(redactions, rect);
    };

    const handleMouseUp = () => {
        if (!isDrawing) return;
        setIsDrawing(false);

        if (currentRect && currentRect.width > 10 && currentRect.height > 10) {
            const newRedactions = [...redactions, { ...currentRect, id: Date.now().toString() }];
            setRedactions(newRedactions);
            setCurrentRect(null);
            redrawInteractionLayer(newRedactions, null);
        } else {
            setCurrentRect(null);
            redrawInteractionLayer(redactions, null);
        }
    };

    const redrawInteractionLayer = (completedRedactions, activeRect) => {
        const canvas = interactionCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Semi-transparent black for preview

        completedRedactions.forEach(r => {
            ctx.fillRect(r.x, r.y, r.width, r.height);
        });

        if (activeRect) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(activeRect.x, activeRect.y, activeRect.width, activeRect.height);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(activeRect.x, activeRect.y, activeRect.width, activeRect.height);
        }
    };

    const handleUndoRedaction = () => {
        if (redactions.length > 0) {
            const newRedactions = redactions.slice(0, -1);
            setRedactions(newRedactions);
            redrawInteractionLayer(newRedactions, null);
        }
    };

    // --- Core Derivative Send Logic ---
    const handleDerivativeSend = async () => {
        if (!fileData) {
            showNotification("No file loaded.", "error"); return;
        }

        setIsSaving(true);
        showNotification("Preparing Secure Derivative...", "info");

        try {
            // 0. Capture JIT location for security audit
            showNotification("Capturing high-accuracy hardware location...", "info");
            const { getJitLocation } = await import('../utils/geolocation');
            const jitLoc = await getJitLocation();

            const sourceCanvas = sourceCanvasRef.current;
            const sourceCtx = sourceCanvas.getContext('2d');

            // 1. Permanently Burn In Black Boxes on the Source Canvas
            sourceCtx.fillStyle = '#000000';
            redactions.forEach(r => {
                sourceCtx.fillRect(r.x, r.y, r.width, r.height);
            });

            // 2. Extract Sanitized Blob
            const sanitizedBlob = await new Promise(resolve => sourceCanvas.toBlob(resolve, 'image/png'));
            const safeName = documentName || fileData.file_name || "document";
            const nameWithoutExt = safeName.replace(/\.[^/.]+$/, "") || safeName;
            const derivativeFileName = `[Redacted for ${isBatch ? 'All' : userName}] ${nameWithoutExt}.png`;
            const sanitizedFile = new File([sanitizedBlob], derivativeFileName, { type: 'image/png' });

            // 3. Upload to IPFS
            showNotification("Uploading to IPFS...", "info");
            const derivativeCid = await ipfsBridge.uploadFile(sanitizedFile);

            // 4. Register new Derivative File on Backend
            showNotification("Registering new secure file...", "info");
            const uploadPayload = {
                file_name: derivativeFileName,
                file_type: 'png',
                file_size: sanitizedFile.size,
                cid: derivativeCid,
                // Intentionally empty sections (unlike Phase 2 composite view)
                sections: [],
                latitude: jitLoc.latitude,
                longitude: jitLoc.longitude,
                accuracy_meters: jitLoc.accuracy,
                device_timestamp: jitLoc.device_timestamp,
                location_tier: jitLoc.tier
            };
            const uploadRes = await api.post('/files/upload', uploadPayload);
            const newFileId = uploadRes.data.id;

            // 5. Route Permissions via standard endpoint
            showNotification("Sharing with recipient(s)...", "info");

            // NOTE: This assumes the backend expects a specific field for recipient ID. 
            // In DocumentConfigurationModal, you passed 'userName'. We ideally need recipientId.
            // Assuming your routing passed some valid identifiers. 
            // If backend needs actual array for batch, you might need an alternative endpoint or loop.

            await api.post('/files/send', {
                file_id: newFileId,
                receiver_id: recipientId,
                due_date: deadline || null,
                access_control: accessControl || "View",
                latitude: jitLoc.latitude,
                longitude: jitLoc.longitude,
                accuracy_meters: jitLoc.accuracy,
                device_timestamp: jitLoc.device_timestamp,
                location_tier: jitLoc.tier
            });
            // 6. Register redacted linkage on external sync service (soft-fail)
            let redactedSyncWarning = null;
            try {
                const redactedSyncRes = await api.post('/files/register-redacted', {
                    id: newFileId,
                    primary_file_id: file_id,
                    redacted_by: user?.id,
                    redacted_cid: derivativeCid,
                    shared_with: recipientId,
                    sender_latitude: jitLoc.latitude,
                    sender_longitude: jitLoc.longitude,
                    receiver_latitude: "0",
                    receiver_longitude: "0",
                    accuracy_meters: jitLoc.accuracy,
                    device_timestamp: jitLoc.device_timestamp,
                    location_tier: jitLoc.tier
                });

                if (!redactedSyncRes.data?.sync_success) {
                    redactedSyncWarning = redactedSyncRes.data?.sync_message || "register-redacted sync did not succeed.";
                }
            } catch (syncError) {
                console.error("register-redacted sync failed", syncError);
                redactedSyncWarning = syncError?.response?.data?.sync_message || "register-redacted sync failed.";
            }

            if (redactedSyncWarning) {
                showNotification(`Derivative shared, but redacted sync warning: ${redactedSyncWarning}`, "info");
            } else {
                showNotification("Derivative successfully created and shared!", "success");
            }
            setTimeout(() => navigate(-1), 2000);

        } catch (error) {
            console.error("Derivative Send Failed:", error);
            let detail = error.message || "Unknown error";
            if (error.response) {
                detail = error.response.data?.detail || `Server Error (${error.response.status})`;
            } else if (error.request) {
                detail = "Network error or CORS block. Check backend availability.";
            }
            showNotification(`Failed to send derivative: ${detail}`, "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="redaction-page loading">Loading Document...</div>;

    if (!fileData) return <div className="redaction-page error">File not found. Please try again.</div>;

    return (
        <div className="redaction-page">
            <div className="page-header redaction-header">
                <div className="header-left">
                    <button className="back-button icon-only" onClick={() => navigate(-1)} title="Back">
                        <MdArrowBack />
                    </button>
                    <div>
                        <h1 className="page-title">Send with Redaction</h1>
                        <p className="page-subtitle">{documentName || fileData.file_name} → {isBatch ? "Multiple Users" : userName}</p>
                    </div>
                </div>
                <div className="header-right">
                    <button className="btn-secondary" onClick={handleUndoRedaction} disabled={redactions.length === 0} style={{ marginRight: '1rem' }}>
                        Undo Last
                    </button>
                    <GradientButton variant="accept" size="medium" onClick={handleDerivativeSend} disabled={isSaving}>
                        <MdSave style={{ marginRight: '0.5rem' }} /> {isSaving ? "Encrypting..." : "Send Secure Copy"}
                    </GradientButton>
                </div>
            </div>

            <div className="redaction-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#e2e8f0', padding: '2rem', flex: 1, overflow: 'auto' }}>
                <div className="instructions-banner" style={{ background: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', maxWidth: '800px', width: '100%', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem' }}>
                        <strong>Draw rectangular boxes</strong> over sensitive information.
                        A new permanently redacted copy will be created and shared with the recipient. Your original file remains untouched.
                    </p>
                </div>

                <div
                    className="canvas-wrapper"
                    ref={containerRef}
                    style={{ position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: '#fff', borderRadius: '4px', display: 'inline-block' }}
                >
                    {/* SOURCE LAYER: Has the actual image */}
                    <canvas
                        ref={sourceCanvasRef}
                        width={dimensions.width}
                        height={dimensions.height}
                        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                    />

                    {/* INTERACTION LAYER: Transparent, captures clicks and draws temp boxes */}
                    <canvas
                        ref={interactionCanvasRef}
                        width={dimensions.width}
                        height={dimensions.height}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            cursor: 'crosshair',
                            zIndex: 10
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                </div>

                {/* Render PDF (Hidden) to draw it to canvas - MOVED OUTSIDE of overflow hidden */}
                {fileType === 'pdf' && fileUrl && (
                    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
                        <Document file={fileUrl} onLoadSuccess={onPdfLoadSuccess}>
                            <Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} onRenderSuccess={renderPdfPageToCanvas} scale={1.5} />
                        </Document>
                    </div>
                )}
            </div>

            {showToast && (
                <Toast
                    message={toastMessage}
                    type={toastType}
                    duration={3000}
                    onClose={() => setShowToast(false)}
                />
            )}
        </div>
    );
};

export default RedactionPage;
