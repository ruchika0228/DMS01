import React, { useState, useEffect } from 'react';
import DocViewer, { DocViewerRenderers } from 'react-doc-viewer';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';
import { MdError, MdFileDownload, MdLock } from 'react-icons/md';
import Button from './ui/Button';
import CADIsometricViewer from './viewers/CADIsometricViewer';
import './UniversalFileViewer.css';

// Crypto Utilities
const importKeyFromBase64 = async (base64Key) => {
    const binaryDerString = window.atob(base64Key);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    return await window.crypto.subtle.importKey(
        "raw",
        binaryDer,
        "AES-GCM",
        true,
        ["encrypt", "decrypt"]
    );
};

const decryptData = async (payload, key) => {
    // Payload starts with 12 bytes IV, rest is ciphertext
    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
    );
    return decrypted;
};

const UniversalFileViewer = ({ file, url }) => {
    const [docxHtml, setDocxHtml] = useState(null);
    const [docxError, setDocxError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewRecipient, setPreviewRecipient] = useState(false);
    const [imgDimensions, setImgDimensions] = useState({ width: 1, height: 1 });
    const [decryptedCrops, setDecryptedCrops] = useState({});
    const [detectedType, setDetectedType] = useState(null);

    // --- Enhanced Type Detection ---
    const getFileType = () => {
        if (detectedType) return detectedType;

        // 1. Check explicit file_type or type
        let type = file?.file_type || file?.type;
        if (type && type !== 'unknown') return type.toLowerCase();

        // 2. Check file name extension
        const name = file?.file_name || file?.name;
        if (name && name.includes('.')) {
            return name.split('.').pop().toLowerCase();
        }

        // 3. Check URL for extension
        if (url) {
            const urlPath = url.split('?')[0];
            if (urlPath.includes('.')) {
                const ext = urlPath.split('.').pop().toLowerCase();
                if (ext.length <= 4) return ext;
            }
        }

        return 'unknown';
    };

    const fileType = getFileType();

    useEffect(() => {
        if (fileType === 'unknown' && url) {
            const checkType = async () => {
                try {
                    const res = await fetch(url, { method: 'HEAD' });
                    const contentType = res.headers.get('Content-Type');
                    if (contentType) {
                        if (contentType.includes('image')) {
                            setDetectedType('image');
                        } else if (contentType.includes('pdf')) {
                            setDetectedType('pdf');
                        } else if (contentType.includes('word') || contentType.includes('officedocument')) {
                            setDetectedType('docx');
                        } else if (contentType.includes('html')) {
                            setDetectedType('html');
                        }
                    }
                } catch (e) {
                    console.warn("Failed to detect content-type via HEAD", e);
                }
            };
            checkType();
        }
    }, [fileType, url]);
    const fileName = file?.file_name || file?.name || 'document';
    
    console.log("[Viewer] Rendering:", { fileName, fileType, url, isComposite: !!file?.sections?.length });
    
    const CAD_EXTENSIONS = [
        'dwg', 'dxf', 'stl', 'step', 'stp', 'iges', 'igs',
        'sldprt', 'sldasm', 'catpart', 'prt', 'ipt', 'f3d', 'x_t', 'x_b'
    ];
    
    const isCad = CAD_EXTENSIONS.includes(fileType);
    const isComposite = file?.sections && file.sections.length > 0;

    useEffect(() => {
        const handleDocx = async () => {
            if (fileType === 'docx' && url && !isComposite) {
                setLoading(true);
                try {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    setDocxHtml(DOMPurify.sanitize(result.value));
                    setDocxError(null);
                } catch (err) {
                    console.error("Mammoth DOCX error:", err);
                    setDocxError("Failed to convert Word document for preview.");
                } finally {
                    setLoading(false);
                }
            }
        };
        handleDocx();
    }, [fileType, url, isComposite]);

    // Handle Composite Decryption (For sections 1..N)
    useEffect(() => {
        const fetchAndDecryptSections = async () => {
            if (!isComposite) return;

            const newCrops = {};
            for (const sec of file.sections) {
                if (sec.section_index > 0) {
                    // Check Authorization (Do they have the AES key?)
                    if (sec.section_key && sec.section_key !== "null" && sec.section_key !== "") {
                        try {
                            // 1. Fetch encrypted blob from IPFS (Try local first)
                            let response;
                            try {
                                response = await fetch(`http://127.0.0.1:8080/ipfs/${sec.cid}`);
                                if (!response.ok) throw new Error("Local gateway error");
                            } catch (err) {
                                console.warn(`[IPFS] Local gateway failed for section ${sec.id}, falling back to public...`);
                                response = await fetch(`https://ipfs.io/ipfs/${sec.cid}`);
                            }

                            if (response.ok) {
                                const buffer = await response.arrayBuffer();

                                // 2. Decrypt
                                const key = await importKeyFromBase64(sec.section_key);
                                const decryptedBuffer = await decryptData(buffer, key);

                                // 3. Create blob URL
                                const blob = new Blob([decryptedBuffer], { type: 'image/png' });
                                newCrops[sec.id] = URL.createObjectURL(blob);
                            } else {
                                console.error(`Failed to fetch IPFS crop for section ${sec.id}`);
                            }
                        } catch (err) {
                            console.error(`Failed to decrypt section ${sec.id}`, err);
                        }
                    }
                }
            }
            setDecryptedCrops(newCrops);
        };

        fetchAndDecryptSections();

        return () => {
            Object.values(decryptedCrops).forEach(url => URL.revokeObjectURL(url));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]); // Run once when file changes

    const handleImageLoad = (e) => {
        setImgDimensions({
            width: e.NaturalWidth || e.target.naturalWidth,
            height: e.NaturalHeight || e.target.naturalHeight
        });
    };

    if (!file || (!url && !isComposite)) {
        return (
            <div className="universal-viewer-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-bg-light)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner"></div>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-md)' }}>Preparing Document Preview...</p>
                </div>
            </div>
        );
    }

    // --- NEW: COMPOSITE VIEW LOGIC ---
    if (isComposite) {
        // Section 0 is always the public background
        const bgSection = file.sections.find(s => s.section_index === 0);
        // Fallback to primary URL if section 0 cid fails or is missing somehow
        // We prioritize local gateway for the background image as well
        const bgUrl = bgSection ? `http://127.0.0.1:8080/ipfs/${bgSection.cid}` : url;

        // Check if user is theoretically authorized (has keys) to show the toggle
        const hasKeys = file.sections.some(s => s.section_index > 0 && !!s.section_key && s.section_key !== "null" && s.section_key !== "");

        return (
            <div className="composite-viewer-wrapper" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
                {hasKeys && (
                    <div style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e2e8f0', zIndex: 50 }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem', color: '#475569', fontWeight: 'bold' }}>
                            <input
                                type="checkbox"
                                checked={previewRecipient}
                                onChange={(e) => setPreviewRecipient(e.target.checked)}
                                style={{ marginRight: '0.5rem', width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            View as Recipient
                        </label>
                    </div>
                )}
                <div className="composite-viewer-container" style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', overflow: 'auto', flex: 1 }}>
                    {/* Background Layer (Safe/Sanitized) */}
                    <img
                        src={bgUrl}
                        alt="Document Background"
                        onLoad={handleImageLoad}
                        onError={(e) => {
                            // If local gateway fails, fallback to public
                            if (bgSection && e.target.src.includes('127.0.0.1')) {
                                console.warn("[IPFS] Background local gateway failed, falling back to public...");
                                e.target.src = `https://ipfs.io/ipfs/${bgSection.cid}`;
                            }
                        }}
                        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                    />

                    {/* Overhead Sections 1..N */}
                    {file.sections.filter(s => s.section_index > 0).map(sec => {
                        let coords = { x: 0, y: 0, w: 0, h: 0 };
                        try {
                            coords = JSON.parse(sec.coordinates);
                        } catch (e) {
                            console.error("Failed to parse section coordinates", e);
                        }

                        const isAuthorized = !previewRecipient && !!sec.section_key && sec.section_key !== "null" && sec.section_key !== "";

                        return (
                            <div
                                key={sec.id}
                                className={`redaction-overlay ${isAuthorized ? 'authorized' : 'unauthorized'}`}
                                style={{
                                    position: 'absolute',
                                    left: `${(coords.x / imgDimensions.width) * 100}%`,
                                    top: `${(coords.y / imgDimensions.height) * 100}%`,
                                    width: `${(coords.w / imgDimensions.width) * 100}%`,
                                    height: `${(coords.h / imgDimensions.height) * 100}%`,
                                    zIndex: sec.section_index + 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isAuthorized ? 'transparent' : 'rgba(0, 0, 0, 1)',
                                    border: isAuthorized ? 'none' : '1px solid #000',
                                    overflow: 'hidden'
                                }}
                                title={isAuthorized ? "Decrypted Original Content" : "Restricted Content"}
                            >
                                {/* CASE A: Authorized */}
                                {isAuthorized && decryptedCrops[sec.id] && (
                                    <img
                                        src={decryptedCrops[sec.id]}
                                        alt="Decrypted Crop"
                                        style={{ width: '100%', height: '100%', objectFit: 'fill' }}
                                    />
                                )}

                                {/* CASE B: Unauthorized */}
                                {!isAuthorized && (
                                    <div style={{ color: 'white', textAlign: 'center' }}>
                                        <MdLock size={Math.min(coords.w, coords.h) > 40 ? 32 : 16} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    // --- END COMPOSITE LOGIC ---

    // 1. Legacy Image Handling
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileType)) {
        return (
            <div className="universal-viewer-container image-viewer">
                <img src={url} alt={fileName} className="preview-image" />
            </div>
        );
    }

    // 2. Legacy PDF Handling
    if (fileType === 'pdf') {
        return (
            <div className="universal-viewer-container pdf-viewer">
                <iframe
                    title={fileName}
                    src={`${url}#toolbar=0`}
                    className="pdf-iframe"
                />
            </div>
        );
    }

    // 3D CAD Viewer (DXF, DWG, STL, STEP, STP, IGES, IGS)
    if (isCad) {
        return (
            <div className="universal-viewer-container cad-viewer">
                <CADIsometricViewer file={file} url={url} />
            </div>
        );
    }

    // 3. Legacy DOCX Handling
    if (fileType === 'docx') {
        if (loading) {
            return (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p>Preparing Word Preview...</p>
                </div>
            );
        }
        if (docxError) {
            return (
                <div className="viewer-error">
                    <MdError className="error-icon" />
                    <p className="error-title">DOCX Preview Failed</p>
                    <p className="error-message">{docxError}</p>
                    <Button variant="outline" className="btn-download-alt" onClick={() => window.open(url)}>
                        <MdFileDownload /> Download to View
                    </Button>
                </div>
            );
        }
        return (
            <div className="universal-viewer-container docx-viewer">
                <div className="docx-content" dangerouslySetInnerHTML={{ __html: docxHtml }} />
            </div>
        );
    }

    // 4. Legacy HTML Handling
    if (['html', 'htm'].includes(fileType)) {
        return (
            <div className="universal-viewer-container html-viewer">
                <iframe
                    title={fileName}
                    src={url}
                    sandbox="allow-scripts"
                    className="html-iframe"
                />
            </div>
        );
    }

    // 5. Fallback - Try iframe for unknown if it might be a document
    if (fileType === 'unknown' && url) {
        return (
            <div className="universal-viewer-container unknown-viewer">
                <iframe
                    title={fileName}
                    src={url}
                    className="full-iframe"
                    onLoad={() => console.log("Iframe loaded for unknown type")}
                    onError={() => console.error("Iframe failed for unknown type")}
                />
                <div className="viewer-fallback-msg" style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)' }}>
                    Attempting to render unknown file type. If it doesn't appear, please use the download button.
                </div>
            </div>
        );
    }

    // 6. Last Resort: DocViewer
    const docs = [{ uri: url, fileType: fileType === 'unknown' ? undefined : fileType, fileName: fileName }];

    return (
        <div className="universal-viewer-container">
            <DocViewer
                documents={docs}
                pluginRenderers={DocViewerRenderers}
                config={{
                    header: {
                        disableHeader: true,
                        disableFileName: true,
                    },
                }}
                theme={{
                    primary: "#6366f1",
                    text_primary: "#ffffff",
                    text_secondary: "#6366f1",
                }}
            />
            <div className="viewer-fallback-msg" style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#666' }}>
                If preview doesn't load, please download the file.
            </div>
        </div>
    );
};

export default UniversalFileViewer;
