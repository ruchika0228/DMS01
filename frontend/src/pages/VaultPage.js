import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ipfsBridge from '../services/ipfsBridge';
import Button from '../components/ui/Button';
import GradientButton from '../components/ui/GradientButton';
import { IoCloudDownload, IoCloudUpload, IoEye, IoCopy } from 'react-icons/io5';
import { 
    MdArrowBack, MdInsertDriveFile, MdStorage, MdHistory, MdGpsFixed, 
    MdFolder, MdLocalAtm, MdSecurity, MdHealthAndSafety, MdGavel, 
    MdBuild, MdSchool, MdPerson, MdDashboard, MdSearch, MdAutoAwesome,
    MdLanguage, MdDescription, MdClose
} from 'react-icons/md';
import './VaultPage.css';

const categoryIcons = {
    "All": <MdDashboard />,
    "Government": <MdSecurity />,
    "Financial": <MdLocalAtm />,
    "Medical": <MdHealthAndSafety />,
    "Legal": <MdGavel />,
    "Technical": <MdBuild />,
    "Educational": <MdSchool />,
    "Personal": <MdPerson />,
    "Uncategorized": <MdFolder />
};

const VaultPage = () => {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [uploadingDocId, setUploadingDocId] = useState(null);
    const fileInputRef = useRef(null);
    const [selectedDocForUpload, setSelectedDocForUpload] = useState(null);

    // AI Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchingAI, setIsSearchingAI] = useState(false);
    const [searchResponse, setSearchResponse] = useState(null);
    const [isAISearchLoading, setIsAISearchLoading] = useState(false);

    // Categorization State
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryCounts, setCategoryCounts] = useState({});
    const [isUpdatingCategory, setIsUpdatingCategory] = useState(null);

    const categories = ["Uncategorized", "Government", "Financial", "Medical", "Legal", "Technical", "Educational", "Personal"];

    const handleCategoryChange = async (fileId, newCategory) => {
        try {
            setIsUpdatingCategory(fileId);
            const file = files.find(f => f.id === fileId);
            if (!file) return;

            const updateData = {
                cid: file.cid,
                category: newCategory
            };

            await api.put(`/files/${fileId}/update`, updateData);
            
            // Update UI
            setFiles(prev => prev.map(f => f.id === fileId ? { ...f, category: newCategory } : f));
            fetchCategories(); // Refresh counts
            
        } catch (err) {
            console.error("Failed to update category", err);
        } finally {
            setIsUpdatingCategory(null);
        }
    };

    const fetchFiles = async () => {
        try {
            setLoading(true);
            const categoryParam = selectedCategory ? `&category=${selectedCategory}` : '';
            const response = await api.get(`/files/vault?page=${page}&size=20${categoryParam}`);
            setFiles(response.data.items);
            setTotalPages(response.data.pages);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch vault", err);
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await api.get('/files/categories');
            setCategoryCounts(response.data);
        } catch (err) {
            console.error("Failed to fetch categories", err);
        }
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    useEffect(() => {
        fetchFiles();
        fetchCategories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, selectedCategory]);

    const handleAISearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        
        setIsAISearchLoading(true);
        setIsSearchingAI(true);
        try {
            const response = await api.get(`/search/meta?query=${encodeURIComponent(searchQuery)}`);
            setSearchResponse(response.data);
        } catch (err) {
            console.error("AI Search failed", err);
            alert("AI Search failed. Check if backend is running.");
        } finally {
            setIsAISearchLoading(false);
        }
    };

    const clearAISearch = () => {
        setIsSearchingAI(false);
        setSearchResponse(null);
        setSearchQuery("");
    };

    const handleDownload = async (file) => {
        try {
            const response = await api.get(`/files/${file.id}/download`, {
                responseType: 'blob'
            });

            let filename = file.file_name;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const blobUrl = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

        } catch (error) {
            console.error("Download failed:", error);
            alert("Failed to download file.");
        }
    };

    const handleUploadClick = (file) => {
        setSelectedDocForUpload(file);
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
            const response = await api.put(`/files/${selectedDocForUpload.id}/update`, updateData);
            const updatedFile = response.data;

            // 4. Update UI State
            setFiles(prevFiles => prevFiles.map(f => {
                if (f.id === selectedDocForUpload.id) {
                    return updatedFile; // The endpoint returns the full updated File response
                }
                return f;
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

    const handleOpenView = (file) => {
        const mockFile = {
            id: file.id,
            name: file.file_name,
            type: file.file_type,
            size: file.file_size,
            cid: file.cid,
            sections: file.sections || []
        };

        navigate('/document-view', {
            state: {
                file: mockFile,
                receivedDate: file.created_at
            }
        });
    };

    const handleCopyId = (id) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(id)
                .then(() => alert("File ID copied to clipboard!"))
                .catch(err => console.error("Failed to copy: ", err));
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = id;
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

    const handleForceLocationSync = async () => {
        try {
            const { forceLocationUpdate } = await import('../utils/geolocation');
            const data = await forceLocationUpdate();
            const accuracyInfo = data.accuracy ? ` (Accuracy: ${data.accuracy})` : '';
            alert(`Location Updated!\n\nLat: ${data.latitude.toFixed(6)}\nLng: ${data.longitude.toFixed(6)}\nSource: ${data.source}${accuracyInfo}`);
        } catch (err) {
            console.error("Manual location sync failed", err);
            alert("Failed to sync location. Check browser permissions.");
        }
    };

    if (loading) {
        return <div className="vault-page">Loading...</div>;
    }

    return (
        <div className="vault-page">
            <div className="page-header vault-header">
                <div className="header-left">
                    <button className="back-button icon-only" onClick={handleGoBack} title="Back">
                        <MdArrowBack />
                    </button>
                    <div>
                        <h2 className="page-title">My Vault</h2>
                        <p className="page-subtitle">Manage and share your secure documents</p>
                    </div>
                </div>
                <div className="header-right">
                    <button
                        className="location-sync-btn"
                        onClick={handleForceLocationSync}
                        title="Sync Geolocation"
                    >
                        <MdGpsFixed />
                    </button>
                </div>
            </div>

            {/* Hidden File Input for Uploading */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            <div className="vault-content-wrapper">
                {/* Sidebar for Categorization */}
                <div className="vault-sidebar">
                    <div 
                        className={`sidebar-item ${!selectedCategory ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(null)}
                    >
                        <span className="item-icon">{categoryIcons["All"]}</span>
                        <span className="item-label">All Documents</span>
                    </div>
                    
                    <div className="sidebar-divider">Categories</div>
                    
                    {Object.keys(categoryIcons).filter(cat => cat !== "All").map(cat => (
                        <div 
                            key={cat}
                            className={`sidebar-item ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            <span className="item-icon">{categoryIcons[cat]}</span>
                            <span className="item-label">{cat}</span>
                            {categoryCounts[cat] !== undefined && (
                                <span className="item-count">{categoryCounts[cat]}</span>
                            )}
                        </div>
                    ))}
                </div>

                <div className="vault-main-area">
                    {/* Meta Search AI Bar */}
                    <div className="search-ai-container">
                        <form onSubmit={handleAISearch} className="search-ai-form">
                            <div className="search-input-wrapper">
                                <MdSearch className="search-icon" />
                                <input 
                                    type="text" 
                                    placeholder="Search documents or ask AI..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="search-ai-input"
                                />
                                {isSearchingAI && (
                                    <button type="button" className="clear-search-btn" onClick={clearAISearch} title="Clear Search">
                                        <MdClose />
                                    </button>
                                )}
                                <button type="submit" className="ai-search-submit-btn" disabled={isAISearchLoading}>
                                    {isAISearchLoading ? <span className="spinning-loader" /> : <MdAutoAwesome />}
                                    <span>AI Meta Search</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {isSearchingAI ? (
                        <div className="ai-search-results-area">
                            {isAISearchLoading ? (
                                <div className="ai-loading-placeholder">
                                    <div className="pulse-loader"></div>
                                    <p>AI is searching through your vault and the web...</p>
                                </div>
                            ) : (
                                <div className="search-results-content">
                                    {searchResponse?.answer && (
                                        <div className="ai-answer-card glass-card">
                                            <div className="card-header">
                                                <MdAutoAwesome className="ai-icon-small" />
                                                <h4>AI Meta Answer</h4>
                                            </div>
                                            <p className="ai-answer-text">{searchResponse.answer}</p>
                                        </div>
                                    )}

                                    <div className="results-grid-meta">
                                        <div className="results-column">
                                            <h3><MdDescription /> Local Documents</h3>
                                            {searchResponse?.document_results?.length > 0 ? (
                                                searchResponse.document_results.map((res, i) => (
                                                    <div key={i} className="result-item glass-card">
                                                        <div className="result-meta">
                                                            <span className="res-filename">{res.filename}</span>
                                                            <span className="res-type">{res.search_type}</span>
                                                            <button 
                                                                className="res-view-btn" 
                                                                onClick={() => {
                                                                    const fileObj = files.find(f => f.id === res.document_id);
                                                                    if (fileObj) {
                                                                        handleOpenView(fileObj);
                                                                    } else {
                                                                        // Fallback: Fetch details if not in current page
                                                                        api.get(`/files/${res.document_id}`).then(resp => {
                                                                            handleOpenView(resp.data);
                                                                        }).catch(err => alert("Could not open document details."));
                                                                    }
                                                                }}
                                                            >
                                                                <IoEye /> View
                                                            </button>
                                                        </div>
                                                        <div 
                                                            className="res-content" 
                                                            dangerouslySetInnerHTML={{ __html: res.highlighted_content || res.content }} 
                                                        />
                                                    </div>
                                                ))
                                            ) : <p className="no-res">No local matches found.</p>}
                                        </div>

                                        <div className="results-column">
                                            <h3><MdLanguage /> Web Results</h3>
                                            {searchResponse?.web_results?.length > 0 ? (
                                                searchResponse.web_results.map((res, i) => (
                                                    <div key={i} className="result-item glass-card web-result">
                                                        <a href={res.url} target="_blank" rel="noopener noreferrer" className="res-title">
                                                            {res.title}
                                                        </a>
                                                        <p className="res-content">{res.content}</p>
                                                        <span className="res-url">{res.url.substring(0, 50)}...</span>
                                                    </div>
                                                ))
                                            ) : <p className="no-res">No web matches found.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="files-grid">
                        {files.map(file => (
                            <div key={file.id} className="file-card glass-card selection-glow">
                                <div className="file-card-header">
                                    <div className="file-category-badge" title={`Category: ${file.category || 'Uncategorized'}`}>
                                        {categoryIcons[file.category] || categoryIcons["Uncategorized"]}
                                    </div>
                                    <div className="file-type-tag">{file.file_type?.toUpperCase()}</div>
                                </div>

                                <div className="file-icon-main">
                                    <MdInsertDriveFile size={48} />
                                </div>

                                <div className="file-info">
                                    <h3 title={file.file_name}>{file.file_name}</h3>
                                    <div className="file-meta">
                                        <span className="meta-item"><MdStorage /> {(file.file_size / 1024).toFixed(1)} KB</span>
                                        <span className="meta-item"><MdHistory /> {new Date(file.created_at).toLocaleDateString()}</span>
                                    </div>
                                    
                                    {/* Manual Category Selector */}
                                    <div className="card-category-selector">
                                        <select 
                                            value={file.category || "Uncategorized"}
                                            onChange={(e) => handleCategoryChange(file.id, e.target.value)}
                                            disabled={isUpdatingCategory === file.id}
                                            className={isUpdatingCategory === file.id ? 'loading' : ''}
                                        >
                                            {categories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="file-id-container">
                                        <span className="file-id-text">ID: {file.id.substring(0, 8)}...</span>
                                        <button
                                            className="copy-id-btn"
                                            onClick={() => handleCopyId(file.id)}
                                            title="Copy Full ID"
                                        >
                                            <IoCopy />
                                        </button>
                                    </div>
                                </div>

                                <div className="file-actions">
                                    <GradientButton size="small" variant="primary" onClick={() => handleOpenView(file)}>
                                        <IoEye /> View
                                    </GradientButton>
                                    <div className="secondary-actions">
                                        <Button size="small" variant="outline" onClick={() => handleDownload(file)} title="Download">
                                            <IoCloudDownload />
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outline"
                                            onClick={() => handleUploadClick(file)}
                                            disabled={uploadingDocId === file.id}
                                            title="Update File"
                                        >
                                            {uploadingDocId === file.id ? (
                                                <span className="spinning">...</span>
                                            ) : (
                                                <IoCloudUpload />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    )}

                    {
                        !isSearchingAI && totalPages > 1 && (
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
                        )
                    }
                </div>
            </div>
        </div >
    );
};

export default VaultPage;
