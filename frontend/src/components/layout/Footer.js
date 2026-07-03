import React from 'react';
import logoImage from '../../assets/vg-logo.png';
import './Footer.css';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="app-footer">
            <div className="footer-container">
                <div className="footer-left">
                    <div className="footer-logo-container">
                        <img src={logoImage} alt="Virtual Galaxy Logo" className="footer-logo" />
                    </div>
                    <div className="footer-company-info">
                        <span className="footer-company-name">Virtual Galaxy Ltd</span>
                        <span className="footer-system-name">File Management System</span>
                    </div>
                </div>
                <div className="footer-center">
                    <span className="footer-copyright">© {currentYear} Virtual Galaxy Ltd. All Rights Reserved.</span>
                </div>
                <div className="footer-right">
                    <span className="footer-links">
                        <span className="footer-version">Version 1.0</span>
                        <span className="footer-separator">|</span>
                        <a href="#support" className="footer-link">Support</a>
                        <span className="footer-separator">|</span>
                        <a href="#privacy" className="footer-link">Privacy Policy</a>
                    </span>
                    <div className="footer-status">
                        <span className="status-label">SECURE LAYER</span>
                        <span className="status-divider">|</span>
                        <span className="status-value">ONLINE_STATE // ACTIVE</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
