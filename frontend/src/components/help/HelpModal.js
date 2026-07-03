import React from 'react';
import Modal from '../ui/Modal';
import Carousel from '../ui/Carousel';
import {
    IoFolderOpen, IoShieldCheckmark, IoLockClosed, IoCloud, IoFlash, IoPeople,
    IoCheckmarkCircle, IoInformationCircle,
    IoDownload, IoExtensionPuzzle, IoRocket, IoLogoWindows, IoLogoTux,
    IoLogoChrome, IoLogoFirefox
} from 'react-icons/io5';
import './HelpModal.css';

const HelpModal = ({ isOpen, onClose }) => {
    const slides = [
        // Slide 1 - DMS Overview
        <div className="help-slide help-slide-1" key="slide-1">
            <div className="slide-header">
                <IoFolderOpen className="slide-icon" />
                <h2 className="slide-title">Document Management System</h2>
                <p className="slide-subtitle">Secure, Decentralized, and Efficient File Storage</p>
            </div>

            <div className="slide-content-single">
                <div className="info-section">
                    <div className="info-block">
                        <h3 className="section-title">
                            <IoShieldCheckmark className="title-icon" />
                            Why Choose DMS?
                        </h3>
                        <p className="section-description">
                            Our Document Management System combines cutting-edge blockchain technology with
                            decentralized storage to provide unparalleled security and reliability for your documents.
                        </p>
                    </div>

                    <div className="benefits-list">
                        <div className="benefit-item">
                            <IoLockClosed className="benefit-icon" />
                            <div>
                                <h4>End-to-End Encryption</h4>
                                <p>Military-grade encryption ensures your files remain private and secure</p>
                            </div>
                        </div>

                        <div className="benefit-item">
                            <IoCloud className="benefit-icon" />
                            <div>
                                <h4>IPFS Integration</h4>
                                <p>Decentralized storage powered by InterPlanetary File System</p>
                            </div>
                        </div>

                        <div className="benefit-item">
                            <IoFlash className="benefit-icon" />
                            <div>
                                <h4>Lightning Fast</h4>
                                <p>Optimized peer-to-peer distribution for instant file access</p>
                            </div>
                        </div>

                        <div className="benefit-item">
                            <IoPeople className="benefit-icon" />
                            <div>
                                <h4>Collaboration</h4>
                                <p>Share and manage files seamlessly with your team</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,

        // Slide 2 - IPFS Installation
        <div className="help-slide help-slide-2" key="slide-2">
            <div className="slide-header">
                <IoCloud className="slide-icon" />
                <h2 className="slide-title">IPFS Installation</h2>
                <p className="slide-subtitle">Enable Decentralized Storage for Your Files</p>
            </div>

            <div className="slide-content-single">
                <div className="info-section">
                    <div className="info-block">
                        <h3 className="section-title">
                            <IoInformationCircle className="title-icon" />
                            What is IPFS?
                        </h3>
                        <p className="section-description">
                            <strong>InterPlanetary File System (IPFS)</strong> is a peer-to-peer hypermedia protocol
                            designed to make the web faster, safer, and more open. It's a distributed system for
                            storing and accessing files, websites, applications, and data.
                        </p>
                    </div>

                    <div className="benefits-list">
                        <div className="benefit-item">
                            <IoCheckmarkCircle className="benefit-icon" />
                            <div>
                                <h4>Decentralized Architecture</h4>
                                <p>No single point of failure - files distributed across multiple nodes</p>
                            </div>
                        </div>

                        <div className="benefit-item">
                            <IoCheckmarkCircle className="benefit-icon" />
                            <div>
                                <h4>Content Addressing</h4>
                                <p>Files identified by content hash, ensuring data integrity</p>
                            </div>
                        </div>

                        <div className="benefit-item">
                            <IoCheckmarkCircle className="benefit-icon" />
                            <div>
                                <h4>Permanent Storage</h4>
                                <p>Files remain accessible even if original uploader goes offline</p>
                            </div>
                        </div>
                    </div>

                    <div className="downloads-container">
                        {/* Linux Section */}
                        <div className="download-block">
                            <h4><IoLogoTux className="os-icon" /> Linux </h4>
                            <p>Automated bash script for IPFS setup</p>
                            <a
                                href="/scripts/install_ipfs.sh"
                                download="install_ipfs.sh"
                                className="download-button"
                                style={{ textDecoration: 'none' }}
                            >
                                <IoDownload className="button-icon" />
                                Download Script
                            </a>

                            <div className="terminal-instructions">
                                <p><strong>Installation Steps:</strong></p>
                                <ol className="instruction-list">
                                    <li>Open Terminal (Ctrl+Alt+T)</li>
                                    <li>Navigate to location where script stores:
                                        <div className="terminal-code inline">
                                            <code>cd ~/Downloads</code>
                                        </div>
                                    </li>
                                    <li>Make script executable:
                                        <div className="terminal-code">
                                            <code>chmod +x install_ipfs.sh</code>
                                        </div>
                                    </li>
                                    <li>Run the script:
                                        <div className="terminal-code">
                                            <code>./install_ipfs.sh</code>
                                        </div>
                                    </li>
                                </ol>
                            </div>
                        </div>

                        {/* Windows Section */}
                        <div className="download-block">
                            <h4><IoLogoWindows className="os-icon" /> Windows</h4>
                            <p>PowerShell script for automated setup</p>
                            <a
                                href="/scripts/install_ipfs.bat"
                                download="install_ipfs.bat"
                                className="download-button"
                                style={{ textDecoration: 'none' }}
                            >
                                <IoDownload className="button-icon" />
                                Download Script
                            </a>

                            <div className="terminal-instructions">
                                <p><strong>Installation Steps:</strong></p>
                                <ol className="instruction-list">
                                    <li>Double click to execute the script:
                                        <div className="terminal-code">
                                            <code>install_ipfs.bat</code>
                                        </div>
                                    </li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,

        // Slide 3 - Extension Setup
        <div className="help-slide help-slide-3" key="slide-3">
            <div className="slide-header">
                <IoExtensionPuzzle className="slide-icon" />
                <h2 className="slide-title">Browser Extension Setup</h2>
                <p className="slide-subtitle">Seamless Integration with Your Browser</p>
            </div>

            <div className="slide-content-single">
                <div className="info-section">
                    <div className="info-block">
                        <h3 className="section-title">
                            <IoRocket className="title-icon" />
                            Quick Setup Guide
                        </h3>
                        <p className="section-description">
                            Install the DMS browser extension to upload and manage files directly from any webpage.
                            The extension provides quick access to your file vault and enables drag-and-drop uploads.
                        </p>
                    </div>

                    <div className="setup-steps-list">
                        <div className="step-item">
                            <div className="step-number">1</div>
                            <div className="step-content">
                                <h4>Download Extension</h4>
                                <p>Click the button below to download the extension package</p>
                            </div>
                        </div>

                        <div className="step-item">
                            <div className="step-number">2</div>
                            <div className="step-content">
                                <h4>Extract Files</h4>
                                <p>Unzip the downloaded file to a folder on your computer</p>
                            </div>
                        </div>

                        <div className="step-item">
                            <div className="step-number">3</div>
                            <div className="step-content">
                                <h4>Enable Developer Mode</h4>
                                <p>Go to chrome://extensions and toggle Developer Mode</p>
                            </div>
                        </div>

                        <div className="step-item">
                            <div className="step-number">4</div>
                            <div className="step-content">
                                <h4>Load Extension</h4>
                                <p>Click "Load unpacked" and select the extracted folder</p>
                            </div>
                        </div>
                    </div>

                    <div className="downloads-container">
                        {/* Chrome Extension */}
                        <div className="download-block">
                            <h4><IoLogoChrome className="os-icon" /> Chrome / Edge</h4>
                            <p>Compatible with Chromium browsers</p>
                            <a
                                href="/downloads/dms-extension-chrome.zip"
                                download="dms-extension-chrome.zip"
                                className="download-button"
                                style={{ textDecoration: 'none' }}
                            >
                                <IoDownload className="button-icon" />
                                Download Chrome Ext
                            </a>
                            <span className="download-info">v1.0.0 • ZIP • Unpacked</span>
                        </div>

                        {/* Firefox Extension */}
                        <div className="download-block">
                            <h4><IoLogoFirefox className="os-icon" /> Firefox</h4>
                            <p>Compatible with Mozilla Firefox</p>
                            <a
                                href="/downloads/dms-extension-firefox.zip"
                                download="dms-extension-firefox.zip"
                                className="download-button"
                                style={{ textDecoration: 'none' }}
                            >
                                <IoDownload className="button-icon" />
                                Download Firefox Ext
                            </a>
                            <span className="download-info">v1.0.0 • ZIP • Debug Mode</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Help & Setup Guide"
            size="large"
            className="help-modal"
        >
            <Carousel slides={slides} autoRotate={true} rotateInterval={3000} />
        </Modal>
    );
};

export default HelpModal;
