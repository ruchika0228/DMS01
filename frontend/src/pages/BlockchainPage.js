import React, { useState } from 'react';
import api from '../api/axios';
import BlockchainViewer from '../components/blockchain/BlockchainViewer';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSearch } from 'react-icons/md';
import './BlockchainPage.css';

const BlockchainPage = () => {
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [queryMeta, setQueryMeta] = useState({ queriedId: '', resolvedPrimaryId: '' });
    const navigate = useNavigate();

    const handleGoBack = () => {
        navigate(-1);
    };

    const handleSearch = async (fileId) => {
        if (!fileId) {
            setBlocks([]);
            setQueryMeta({ queriedId: '', resolvedPrimaryId: '' });
            return;
        }

        setLoading(true);
        try {
            // Using local API router
            const response = await api.get(`/api/files/${fileId}/history`, {
                headers: {
                    "X-Api-Key": "secret123"
                }
            });

            if (response.data && response.data.success && Array.isArray(response.data.data)) {
                setQueryMeta({
                    queriedId: response.data.queried_id || '',
                    resolvedPrimaryId: response.data.resolved_primary_id || ''
                });

                // Map main blockchain history to BlockchainViewer expected format
                const mappedBlocks = response.data.data.map((item, index, arr) => {
                    const blockData = item.data || {};
                    let actionType = blockData.action || "Edited";
                    
                    if (!blockData.action) {
                        if (item.prev_tx_id === "GENESIS") {
                            actionType = "Registered";
                        } else {
                            const prevBlock = arr[index - 1];
                            if (prevBlock) {
                                const prevData = prevBlock.data || {};
                                if (prevData.owner_id !== blockData.owner_id) {
                                    actionType = "Transferred";
                                } else if (prevData.owner_id === blockData.owner_id &&
                                    (prevData.cid !== blockData.cid || Number(prevData.file_size) !== Number(blockData.file_size))) {
                                    actionType = "Edited";
                                }
                            }
                        }
                    }

                    return {
                        id: item.tx_id,
                        hash: item.tx_id,
                        previousHash: item.prev_tx_id,
                        fileHash: blockData.cid,
                        timestamp: item.timestamp,
                        size: blockData.file_size ? `${(blockData.file_size / 1024).toFixed(2)} KB` : 'N/A',
                        initiatedBy: blockData.owner_id || 'System',
                        lastEditBy: blockData.last_edited_by || blockData.transferred_by || 'N/A',
                        fileName: blockData.file_name,
                        fileType: blockData.file_type,
                        action: actionType,
                        senderLat: blockData.sender_latitude,
                        senderLng: blockData.sender_longitude,
                        senderAddr: blockData.sender_address,
                        receiverLat: blockData.receiver_latitude,
                        receiverLng: blockData.receiver_longitude,
                        receiverAddr: blockData.receiver_address
                    };
                });

                // Map redacted copies (if present) into same viewer format and append after main chain
                const redactedCopies = Array.isArray(response.data.redacted_copies)
                    ? response.data.redacted_copies
                    : [];

                const mappedRedacted = redactedCopies.map((copy, index) => {
                    const redactedCid = copy.redacted_cid || 'N/A';
                    return {
                        id: copy.id || `redacted-${index}`,
                        hash: copy.tx_id || redactedCid,
                        previousHash: copy.primary_file_id || 'N/A',
                        fileHash: redactedCid,
                        timestamp: copy.created_at || null,
                        size: 'N/A',
                        initiatedBy: copy.redacted_by || 'N/A',
                        lastEditBy: copy.shared_with || 'N/A',
                        fileName: 'Redacted Copy',
                        fileType: 'redacted',
                        action: 'Redacted Copy Shared',
                        senderLat: copy.sender_latitude,
                        senderLng: copy.sender_longitude,
                        senderAddr: copy.sender_address,
                        receiverLat: copy.receiver_latitude,
                        receiverLng: copy.receiver_longitude,
                        receiverAddr: copy.receiver_address
                    };
                });

                setBlocks([...mappedBlocks, ...mappedRedacted]);
            } else {
                setBlocks([]);
                setQueryMeta({ queriedId: '', resolvedPrimaryId: '' });
                console.warn("Unexpected API response structure", response.data);
            }
        } catch (err) {
            console.error("Failed to fetch blockchain history", err);
            setBlocks([]);
            setQueryMeta({ queriedId: '', resolvedPrimaryId: '' });
        } finally {
            setLoading(false);
        }
    };

    const [searchHash, setSearchHash] = useState('');

    const handleSearchSubmit = () => {
        handleSearch(searchHash);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearchSubmit();
        }
    };

    return (
        <div className="blockchain-page">
            <div className="page-header">
                <div className="header-left">
                    <button className="back-button icon-only" onClick={handleGoBack} title="Back">
                        <MdArrowBack />
                    </button>
                    <div>
                        <h1 className="page-title">Blockchain Explorer</h1>
                        <p className="page-subtitle">View and verify document history on the immutable ledger</p>
                        {queryMeta.queriedId && (
                            <p className="page-subtitle" style={{ marginTop: '0.2rem', fontSize: '0.85rem' }}>
                                Query: {queryMeta.queriedId}
                                {queryMeta.resolvedPrimaryId ? ` • Primary: ${queryMeta.resolvedPrimaryId}` : ''}
                            </p>
                        )}
                    </div>
                </div>
                <div className="header-right">
                    <div className="blockchain-search">
                        <div className="search-input-wrapper selection-glow">
                            <MdSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Enter File ID or CID..."
                                value={searchHash}
                                onChange={(e) => setSearchHash(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="hash-search-input"
                                disabled={loading}
                            />
                            {searchHash && (
                                <button
                                    className="clear-search-btn"
                                    onClick={() => {
                                        setSearchHash('');
                                        handleSearch('');
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <BlockchainViewer
                blocks={blocks}
                loading={loading}
            />
        </div>
    );
};

export default BlockchainPage;
