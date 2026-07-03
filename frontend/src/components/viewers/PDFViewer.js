import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { MdNavigateBefore, MdNavigateNext } from 'react-icons/md';
import './PDFViewer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFViewer = ({ file, url }) => {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState(null);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setError(null);
    };

    const onDocumentLoadError = (error) => {
        console.error('Error loading PDF:', error);
        setError('Failed to load PDF file. The file may be corrupted or invalid.');
    };

    const goToPrevPage = () => {
        setPageNumber(prevPage => Math.max(prevPage - 1, 1));
    };

    const goToNextPage = () => {
        setPageNumber(prevPage => Math.min(prevPage + 1, numPages));
    };

    if (error) {
        return (
            <div className="pdf-viewer-error">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="pdf-viewer">
            <Document
                file={url || file}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                    <div className="pdf-loading">
                        <div className="loading-spinner"></div>
                        <p>Loading PDF...</p>
                    </div>
                }
            >
                <Page
                    pageNumber={pageNumber}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="pdf-page"
                />
            </Document>

            {numPages && (
                <div className="pdf-controls">
                    <button
                        onClick={goToPrevPage}
                        disabled={pageNumber <= 1}
                        className="pdf-nav-btn"
                    >
                        <MdNavigateBefore />
                    </button>
                    <span className="pdf-page-info">
                        Page {pageNumber} of {numPages}
                    </span>
                    <button
                        onClick={goToNextPage}
                        disabled={pageNumber >= numPages}
                        className="pdf-nav-btn"
                    >
                        <MdNavigateNext />
                    </button>
                </div>
            )}
        </div>
    );
};

export default PDFViewer;
