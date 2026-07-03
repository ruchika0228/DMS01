import React, { useState } from 'react';
import { MdContentCopy } from 'react-icons/md';
import Card from '../ui/Card';
import LocationMapModal from '../modals/LocationMapModal';
import './BlockchainViewer.css';

const BlockchainViewer = ({ blocks, loading }) => {
    const [copiedField, setCopiedField] = useState(null);
    const [mapModal, setMapModal] = useState({ isOpen: false, lat: null, lng: null, address: '', title: '' });

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const parsed = new Date(timestamp);
        return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
    };

    const handleCopy = (text, fieldId) => {
        const safeText = text || 'N/A';
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(safeText).catch(err => {
                console.error('Async: Could not copy text: ', err);
            });
        } else {
            // Fallback for non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = safeText;
            textArea.style.position = "fixed";  // Avoid scrolling to bottom
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }
            document.body.removeChild(textArea);
        }
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };
    const formatCoord = (val) => {
        if (!val || val === '0' || val === 0) return null;
        const num = parseFloat(val);
        return Number.isNaN(num) || num === 0 ? null : num.toFixed(6);
    };

    const handleViewOnMap = (lat, lng, address, title) => {
        const fLat = parseFloat(lat);
        const fLng = parseFloat(lng);
        if (isNaN(fLat) || isNaN(fLng) || fLat === 0 || fLng === 0) {
            alert("No exact GPS coordinates available for this location.");
            return;
        }
        setMapModal({ isOpen: true, lat, lng, address, title });
    };

    return (
        <div className="blockchain-viewer">
            <LocationMapModal 
                isOpen={mapModal.isOpen}
                onClose={() => setMapModal({ ...mapModal, isOpen: false })}
                lat={mapModal.lat}
                lng={mapModal.lng}
                address={mapModal.address}
                title={mapModal.title}
            />
            <div className="blockchain-container">
                <div className="blockchain-chain">
                    {loading ? (
                        <div className="no-results">
                            <p>Searching blockchain...</p>
                        </div>
                    ) : blocks && blocks.length > 0 ? (
                        blocks.map((block, index) => (
                            <React.Fragment key={block.id || block.tx_id || index}>
                                <div className="blockchain-block glass-card selection-glow">
                                    <div className="block-version-header">Block Version #{index + 1}</div>
                                    <div className="block-field-row" style={{ marginTop: '1rem' }}>
                                        <span className="field-label">Status:</span>
                                        <span className="field-value status-badge">{block.action || 'Unknown'}</span>
                                    </div>

                                    <div className="block-location-section card-top-location">
                                        {block.action === 'Transferred' || block.action === 'Redacted Copy Shared' || (block.receiverAddr && block.receiverAddr !== 'Pending') ? (
                                            <>
                                                <div className="location-row-group">
                                                    <div className="location-row">
                                                        <span className="field-label">Sender:</span>
                                                        <div className={`coordinate-badge ${!formatCoord(block.senderLat) ? 'missing' : ''}`}>
                                                            {formatCoord(block.senderLat) ? (
                                                                <>
                                                                    <span className="coord-val">Lat: {formatCoord(block.senderLat)}</span>
                                                                    <span className="coord-divider">|</span>
                                                                    <span className="coord-val">Lng: {formatCoord(block.senderLng)}</span>
                                                                </>
                                                            ) : (
                                                                <span className="coord-val">GPS Unavailable</span>
                                                            )}
                                                        </div>
                                                        {formatCoord(block.senderLat) && (
                                                            <button 
                                                                className="view-map-btn"
                                                                onClick={() => handleViewOnMap(block.senderLat, block.senderLng, block.senderAddr, `Sender Location (Block #${index + 1})`)}
                                                                title="View on Map"
                                                            >
                                                                📍 Map
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="address-row">
                                                        <span className="address-text">{block.senderAddr || 'No Address Data'}</span>
                                                    </div>
                                                </div>

                                                <div className="location-row-group" style={{ marginTop: '0.8rem' }}>
                                                    <div className="location-row">
                                                        <span className="field-label">Receiver:</span>
                                                        <div className={`coordinate-badge receiver ${!formatCoord(block.receiverLat) ? 'missing' : ''}`}>
                                                            {formatCoord(block.receiverLat) ? (
                                                                <>
                                                                    <span className="coord-val">Lat: {formatCoord(block.receiverLat)}</span>
                                                                    <span className="coord-divider">|</span>
                                                                    <span className="coord-val">Lng: {formatCoord(block.receiverLng)}</span>
                                                                </>
                                                            ) : (
                                                                <span className="coord-val">GPS Unavailable</span>
                                                            )}
                                                        </div>
                                                        {formatCoord(block.receiverLat) && (
                                                            <button 
                                                                className="view-map-btn"
                                                                onClick={() => handleViewOnMap(block.receiverLat, block.receiverLng, block.receiverAddr, `Receiver Location (Block #${index + 1})`)}
                                                                title="View on Map"
                                                            >
                                                                📍 Map
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="address-row">
                                                        <span className={`address-text ${block.receiverAddr === 'Pending Receipt' ? 'pending' : 'verified'}`}>
                                                            {block.receiverAddr || 'No Address Data'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="location-row-group">
                                                <div className="location-row">
                                                    <span className="field-label">{block.action === 'Transferred' || block.action === 'Redacted Copy Shared' ? 'Sender:' : 'User:'}</span>
                                                    <div className={`coordinate-badge ${!formatCoord(block.senderLat) ? 'missing' : ''}`}>
                                                        {formatCoord(block.senderLat) ? (
                                                            <>
                                                                <span className="coord-val">Lat: {formatCoord(block.senderLat)}</span>
                                                                <span className="coord-divider">|</span>
                                                                <span className="coord-val">Lng: {formatCoord(block.senderLng)}</span>
                                                            </>
                                                        ) : (
                                                            <span className="coord-val">GPS Unavailable</span>
                                                        )}
                                                    </div>
                                                    {formatCoord(block.senderLat) && (
                                                        <button 
                                                            className="view-map-btn"
                                                            onClick={() => handleViewOnMap(block.senderLat, block.senderLng, block.senderAddr, `User Location (Block #${index + 1})`)}
                                                            title="View on Map"
                                                        >
                                                            📍 Map
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="address-row">
                                                    <span className="address-text">{block.senderAddr || 'No Address Data'}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="block-field-row">
                                        <span className="field-label">File Name:</span>
                                        <span className="field-value">{block.fileName || 'N/A'}</span>
                                    </div>
                                    <div className="block-field-row">
                                        <span className="field-label">File Type:</span>
                                        <span className="field-value">{block.fileType ? block.fileType.toUpperCase() : 'N/A'}</span>
                                    </div>
                                    <div className="block-field-row">
                                        <span className="field-label">IPFS CID :</span>
                                        <div className="hash-display">
                                            <span className="hash-text">{block.fileHash || 'N/A'}</span>
                                        </div>
                                        <button
                                            className="copy-btn mini"
                                            onClick={() => handleCopy(block.fileHash, `file-${block.id}`)}
                                            title="Copy File Hash"
                                        >
                                            <MdContentCopy />
                                            {copiedField === `file-${block.id}` && <span className="copy-tooltip">Copied!</span>}
                                        </button>
                                    </div>

                                    <div className="blockchain-tx-section">
                                        <div className="tx-header">
                                            <span className="field-label">Previous Hash:</span>
                                        </div>
                                        <div className="tx-content">
                                            <div className="hash-display tx-hash">
                                                <span className="hash-text">
                                                    {block.previousHash || 'GENESIS'}
                                                </span>
                                            </div>
                                            <button
                                                className="copy-btn mini"
                                                onClick={() => handleCopy(block.previousHash, `prev-${block.id}`)}
                                                title="Copy Prev Hash"
                                            >
                                                <MdContentCopy />
                                                {copiedField === `prev-${block.id}` && <span className="copy-tooltip">Copied!</span>}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="blockchain-tx-section">
                                        <div className="tx-header">
                                            <span className="field-label">Current Hash:</span>
                                        </div>
                                        <div className="tx-content">
                                            <div className="hash-display tx-hash">
                                                <span className="hash-text">
                                                    {block.hash || block.fileHash || 'N/A'}
                                                </span>
                                            </div>
                                            <button
                                                className="copy-btn mini"
                                                onClick={() => handleCopy(block.hash || block.fileHash, `tx-${block.id}`)}
                                                title="Copy TX Hash"
                                            >
                                                <MdContentCopy />
                                                {copiedField === `tx-${block.id}` && <span className="copy-tooltip">Copied!</span>}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="block-field-row">
                                        <span className="field-label">Initiated By:</span>
                                    </div>
                                    <div className="author-value">
                                        {block.initiatedBy ? (
                                            block.initiatedBy.length > 30 ?
                                                `${block.initiatedBy.substring(0, 30)}...` :
                                                block.initiatedBy
                                        ) : 'System'}
                                    </div>

                                    <div className="block-field-row">
                                        <span className="field-label">Last Edit By:</span>
                                    </div>
                                    <div className="author-value">
                                        {block.lastEditBy ? (
                                            block.lastEditBy.length > 30 ?
                                                `${block.lastEditBy.substring(0, 30)}...` :
                                                block.lastEditBy
                                        ) : 'N/A'}
                                    </div>

                                    <div className="block-field-row">
                                        <span className="field-label">Timestamp:</span>
                                        <span className="field-value">{formatTimestamp(block.timestamp)}</span>
                                    </div>

                                    <div className="block-field-row">
                                        <span className="field-label">Size:</span>
                                        <span className="field-value">{block.size || '0 KB'}</span>
                                    </div>
                                </div>

                                {index < blocks.length - 1 && (
                                    <div className="block-connector"></div>
                                )}
                            </React.Fragment>
                        ))
                    ) : (
                        <div className="no-results">
                            <p>No history found. Enter a valid File ID or CID to search.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlockchainViewer;
