import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Badge from '../ui/Badge';
import ThemeToggle from '../ui/ThemeToggle';
import HelpButton from '../ui/HelpButton';
import HelpModal from '../help/HelpModal';
import ProfileSettings from '../user/ProfileSettings';
import NotificationPanel from './NotificationPanel';
import { IoNotifications } from 'react-icons/io5';
import { MdPerson } from 'react-icons/md';
import { HiMenuAlt2 } from 'react-icons/hi';
import logoImage from '../../assets/vg-logo.png';
import './Navbar.css';

const Navbar = ({ user, notificationCount = 0, notifications = [], onToggleSidebar, isOpen = false, refreshNotifications }) => {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const location = useLocation();
    const profileRef = useRef(null);
    const notifRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifPanel(false);
            }
        };
        if (showProfileMenu || showNotifPanel) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, [showProfileMenu, showNotifPanel]);

    const isAuthPage = location.pathname === '/';
    if (isAuthPage) return null;

    return (
        <>
            <nav className="navbar">
                <div className="navbar-container">
                    {/* Left: hamburger + logo */}
                    <div className="navbar-left">
                        <button
                            className={`navbar-menu-btn ${isOpen ? 'active' : ''}`}
                            onClick={onToggleSidebar}
                            aria-label="Toggle Navigation"
                        >
                            <HiMenuAlt2 className="menu-icon-svg" />
                        </button>
                        <div className="logo-container">
                            <img src={logoImage} alt="VG Logo" className="navbar-logo-image" />
                        </div>
                        <Link to="/dashboard" className="navbar-logo">
                            <span className="logo-text">DMS</span>
                            <span className="logo-accent">ENGINE</span>
                            <div className="system-status-indicator">
                                <span className="status-dot pulsing"></span>
                                <span className="status-text">SYSTEM // ACTIVE</span>
                            </div>
                        </Link>
                    </div>

                    {/* Center: system title */}
                    <div className="navbar-center">
                        <span className="navbar-workspace-label">
                            <span>DOCUMENT MANAGEMENT SYSTEM</span>
                        </span>
                    </div>

                    {/* Right: actions */}
                    <div className="navbar-right">

                        <HelpButton onClick={() => setShowHelpModal(true)} />

                        <div className="navbar-notif-container" ref={notifRef}>
                            <button 
                                className={`navbar-icon-btn ${showNotifPanel ? 'active' : ''}`}
                                onClick={() => setShowNotifPanel(!showNotifPanel)}
                            >
                                <IoNotifications className="icon" />
                                {notificationCount > 0 && (
                                    <Badge variant="error" size="small" className="notification-badge">
                                        {notificationCount}
                                    </Badge>
                                )}
                            </button>

                            {showNotifPanel && (
                                <NotificationPanel 
                                    notifications={notifications} 
                                    onMarkRead={() => refreshNotifications && refreshNotifications()}
                                    onClose={() => setShowNotifPanel(false)}
                                />
                            )}
                        </div>

                        <ThemeToggle />

                        <div className="navbar-profile" ref={profileRef}>
                            <button
                                className="navbar-profile-btn"
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                            >
                                <div className="profile-icon-wrapper">
                                    {user?.profile_picture ? (
                                        <img src={user.profile_picture} alt="Profile" className="profile-icon" style={{ width: '100%', height: '100%', borderRadius: '4px', objectFit: 'cover' }} />
                                    ) : (
                                        <MdPerson className="profile-icon" />
                                    )}
                                </div>
                                <div className="profile-info">
                                    <span className="profile-role">Operator</span>
                                    <span className="profile-name">{user?.username}</span>
                                </div>
                            </button>

                            {showProfileMenu && (
                                <>
                                    <div className="navbar-backdrop" onClick={() => setShowProfileMenu(false)}></div>
                                    <div className="profile-dropdown">
                                        <ProfileSettings
                                            user={user}
                                            onClose={() => setShowProfileMenu(false)}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
        </>
    );
};

export default Navbar;
