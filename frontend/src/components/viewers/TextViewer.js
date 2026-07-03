import React, { useState, useEffect } from 'react';
import './TextViewer.css';

const TextViewer = ({ file, url }) => {
    const [content, setContent] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                if (url) {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Failed to fetch text content');
                    const text = await response.text();
                    setContent(text);
                    setError(null);
                } else if (file && file instanceof Blob) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        setContent(e.target.result);
                        setError(null);
                        setLoading(false);
                    };
                    reader.onerror = () => {
                        setError('Failed to read the text file.');
                        setLoading(false);
                    };
                    reader.readAsText(file);
                    return; // Return to avoid setting loading=false twice
                } else {
                    // Metadata only or no file
                    setError('No content available to display.');
                }
            } catch (err) {
                console.error("Error loading text:", err);
                setError('Failed to load text content.');
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [file, url]);

    if (loading) {
        return (
            <div className="text-loading">
                <div className="loading-spinner"></div>
                <p>Loading text...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-error">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="text-viewer">
            <pre className="text-content">{content}</pre>
        </div>
    );
};

export default TextViewer;
