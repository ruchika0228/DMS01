import React, { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import './DOCXViewer.css';

const DOCXViewer = ({ file, url }) => {
    const [content, setContent] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDocx = async () => {
            setLoading(true);
            try {
                let arrayBuffer;
                if (url) {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Failed to fetch document');
                    arrayBuffer = await response.arrayBuffer();
                } else if (file && file instanceof Blob) {
                    arrayBuffer = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = () => reject(new Error('Failed to read file'));
                        reader.readAsArrayBuffer(file);
                    });
                } else {
                    setLoading(false);
                    return;
                }

                const result = await mammoth.convertToHtml({ arrayBuffer });
                setContent(result.value);
                setError(null);
            } catch (err) {
                console.error('Error reading DOCX:', err);
                setError('Failed to read DOCX file. The file may be corrupted or in an unsupported format.');
            } finally {
                setLoading(false);
            }
        };

        loadDocx();
    }, [file, url]);

    if (loading) {
        return (
            <div className="docx-loading">
                <div className="loading-spinner"></div>
                <p>Loading document...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="docx-error">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="docx-viewer">
            <div
                className="docx-content"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        </div>
    );
};

export default DOCXViewer;
