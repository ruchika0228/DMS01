import React, { useRef, useState, useEffect, useCallback } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import ipfsBridge from '../../services/ipfsBridge';
import api from '../../api/axios';
import './SecureRedactionEditor.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * Utility: Generate an AES-GCM 256-bit key
 */
const generateAesKey = async () => {
    return await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
};

/**
 * Utility: Export CryptoKey to Base64
 */
const exportKeyToBase64 = async (key) => {
    const raw = await window.crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
};

/**
 * Utility: Encrypt an ArrayBuffer with AES-GCM
 */
const encryptData = async (buffer, key) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        buffer
    );
    // Prepend IV to ciphertext
    const payload = new Uint8Array(iv.length + ciphertext.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(ciphertext), iv.length);
    return payload;
};

const SecureRedactionEditor = ({ file, onPublishSuccess }) => {
    const canvasRef = useRef(null);
    const interactionRef = useRef(null);

    // State
    const [redactions, setRedactions] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
    const [fileUrl, setFileUrl] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [isPdf, setIsPdf] = useState(false);
    const [pageNumber, setPageNumber] = useState(1);

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setFileUrl(url);
            setIsPdf(file.type === 'application/pdf');

            if (file.type.startsWith('image/')) {
                const img = new Image();
                img.onload = () => {
                    setDimensions({ width: img.width, height: img.height });
                    drawSourceImage(img);
                };
                img.src = url;
            }
        }
        return () => {
            if (fileUrl) URL.revokeObjectURL(fileUrl);
        };
    }, [file]);

    const drawSourceImage = (img) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
    };

    const handlePdfRenderSuccess = () => {
        // Find the canvas rendered by react-pdf inside the component
        const pdfCanvas = document.querySelector('.react-pdf__Page__canvas');
        if (pdfCanvas) {
            setDimensions({ width: pdfCanvas.width, height: pdfCanvas.height });

            // Replicate exactly to our Source Canvas
            const canvas = canvasRef.current;
            canvas.width = pdfCanvas.width;
            canvas.height = pdfCanvas.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(pdfCanvas, 0, 0);
        }
    };

    // -- Interaction Canvas Drawing Logic --

    const getMousePos = (e) => {
        const rect = interactionRef.current.getBoundingClientRect();
        // Calculate scale since canvas might be styled to fit screen
        const scaleX = interactionRef.current.width / rect.width;
        const scaleY = interactionRef.current.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const handleMouseDown = (e) => {
        setIsDrawing(true);
        const pos = getMousePos(e);
        setStartPos(pos);
        setCurrentPos(pos);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing) return;
        setCurrentPos(getMousePos(e));
        drawInteractionLayer();
    };

    const handleMouseUp = (e) => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const endPos = getMousePos(e);

        const x = Math.min(startPos.x, endPos.x);
        const y = Math.min(startPos.y, endPos.y);
        const width = Math.abs(startPos.x - endPos.x);
        const height = Math.abs(startPos.y - endPos.y);

        if (width > 10 && height > 10) {
            setRedactions([...redactions, { id: Date.now(), x, y, width, height }]);
        }

        // Redraw to show the committed redaction box
        setTimeout(drawInteractionLayer, 0);
    };

    const drawInteractionLayer = useCallback(() => {
        const canvas = interactionRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw existing redactions
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        redactions.forEach(r => {
            ctx.beginPath();
            ctx.rect(r.x, r.y, r.width, r.height);
            ctx.fill();
            ctx.stroke();
        });

        // Draw current drawing
        if (isDrawing) {
            const x = Math.min(startPos.x, currentPos.x);
            const y = Math.min(startPos.y, currentPos.y);
            const w = Math.abs(startPos.x - currentPos.x);
            const h = Math.abs(startPos.y - currentPos.y);

            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.fill();
            ctx.stroke();
        }
    }, [redactions, isDrawing, startPos, currentPos]);

    useEffect(() => {
        drawInteractionLayer();
    }, [drawInteractionLayer]);

    // -- The 3-Step Pipeline --

    const handlePublish = async () => {
        if (!file) return;
        setIsPublishing(true);

        try {
            // Step 0: Capture JIT location for security audit
            const { getJitLocation } = await import('../../utils/geolocation');
            const jitLoc = await getJitLocation();

            const sourceCanvas = canvasRef.current;
            const sourceCtx = sourceCanvas.getContext('2d');
            const sections = [];

            // Step A: Generate Restricted Crops
            for (let i = 0; i < redactions.length; i++) {
                const r = redactions[i];

                // 1. Extract clean pixel data from Source Canvas
                const cropData = sourceCtx.getImageData(r.x, r.y, r.width, r.height);

                // 2. We need to convert ImageData to a Blob/File so IPFS bridge can handle it
                // We'll draw it to a temporal canvas and extract a Blob
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = r.width;
                tempCanvas.height = r.height;
                tempCanvas.getContext('2d').putImageData(cropData, 0, 0);

                const cropBlob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
                const cropBuffer = await cropBlob.arrayBuffer();

                // 3. Encrypt via AES-GCM
                const aesKey = await generateAesKey();
                const encryptedPayload = await encryptData(cropBuffer, aesKey);
                const base64Key = await exportKeyToBase64(aesKey);

                // 4. Create a File object from encrypted payload and upload to IPFS
                const encryptedFile = new File([encryptedPayload], `crop_${r.id}.enc`, { type: 'application/octet-stream' });
                const cid = await ipfsBridge.uploadFile(encryptedFile);

                sections.push({
                    section_index: i + 1, // 1-based for crops
                    cid: cid,
                    section_key: base64Key,
                    coordinates: JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height }),
                    authorized_users: JSON.stringify([]) // Add specific users as needed
                });
            }

            // Step B: Generate Public Background (Sanitized)
            // Draw black boxes over original canvas
            sourceCtx.fillStyle = '#000000';
            redactions.forEach(r => {
                sourceCtx.fillRect(r.x, r.y, r.width, r.height);
            });

            // Export sanitized canvas
            const sanitizedBlob = await new Promise(resolve => sourceCanvas.toBlob(resolve, 'image/png'));
            const sanitizedFile = new File([sanitizedBlob], `sanitized_${file.name}.png`, { type: 'image/png' });

            // Upload sanitized background to IPFS
            const backgroundCid = await ipfsBridge.uploadFile(sanitizedFile);

            sections.unshift({ // Add as 0th element (Background)
                section_index: 0,
                cid: backgroundCid,
                section_key: null,
                coordinates: null,
                authorized_users: null
            });

            // Step C: Commit to Backend
            const uploadPayload = {
                file_name: file.name,
                file_type: file.type.split('/')[1] || 'unknown',
                file_size: file.size, // Using original file size or sanitized size
                cid: backgroundCid, // Main CID points to the safe background
                sections: sections,
                latitude: jitLoc.latitude,
                longitude: jitLoc.longitude,
                accuracy_meters: jitLoc.accuracy,
                device_timestamp: jitLoc.device_timestamp,
                location_tier: jitLoc.tier
            };

            const response = await api.post('/files/upload', uploadPayload);

            if (onPublishSuccess) {
                onPublishSuccess(response.data);
            } else {
                alert("Redaction processing and database schema upload complete!");
                // optionally clear state
                setRedactions([]);
                setIsPublishing(false);
            }

        } catch (error) {
            console.error("Publishing pipeline failed:", error);
            alert("Failed to publish: " + error.message);
            setIsPublishing(false);
        }
    };

    const clearRedactions = () => setRedactions([]);

    return (
        <div className="secure-redaction-editor">
            <div className="editor-toolbar">
                <h3>Secure Ingest-Then-Redact</h3>
                <div className="toolbar-actions">
                    <button onClick={clearRedactions} disabled={isPublishing || redactions.length === 0} className="btn-secondary">
                        Clear Redactions
                    </button>
                    <button onClick={handlePublish} disabled={isPublishing || !fileUrl} className="btn-primary">
                        {isPublishing ? 'Publishing...' : 'Publish Redacted File'}
                    </button>
                </div>
            </div>

            <div className="canvas-container">
                {/* 
                    Hidden PDF Render: 
                    We use react-pdf to render initially but visually hide it 
                    since we copy its content to our Source Canvas. 
                */}
                {isPdf && fileUrl && (
                    <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -10 }}>
                        <Document file={fileUrl}>
                            <Page pageNumber={pageNumber} onRenderSuccess={handlePdfRenderSuccess} renderTextLayer={false} renderAnnotationLayer={false} />
                        </Document>
                    </div>
                )}

                {/* Layer 1: Source Canvas */}
                <canvas
                    ref={canvasRef}
                    className="layer-source"
                    width={dimensions.width}
                    height={dimensions.height}
                />

                {/* Layer 2: Interaction Canvas */}
                <canvas
                    ref={interactionRef}
                    className="layer-interaction"
                    width={dimensions.width}
                    height={dimensions.height}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ cursor: 'crosshair' }}
                />
            </div>

            <div className="redaction-sidebar">
                <h4>Active Redactions ({redactions.length})</h4>
                <ul>
                    {redactions.map(r => (
                        <li key={r.id}>
                            Crop at ({Math.round(r.x)}, {Math.round(r.y)}) - {Math.round(r.width)}x{Math.round(r.height)} px
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default SecureRedactionEditor;
