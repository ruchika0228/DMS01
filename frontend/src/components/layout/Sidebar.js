import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MdDashboard, MdPeople, MdLink, MdInbox, MdMap, MdWork, MdAssignment, MdAdminPanelSettings } from 'react-icons/md';
import { HiCubeTransparent } from 'react-icons/hi';
import { FaUserShield, FaFileSignature } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const { user } = useAuth();

    const isAuthPage = location.pathname === '/';
    if (isAuthPage) return null;

    const menuItems = [
        { path: '/dashboard', label: 'Console', icon: <MdDashboard /> },
        { path: '/workflow', label: 'G-DMAS Dashboard', icon: <MdWork /> },
        { path: '/create-document', label: 'Create Document', icon: <FaFileSignature /> },
        { path: '/pending-approvals', label: 'Pending Approvals', icon: <MdAssignment /> },
        { path: '/received-documents', label: 'Received', icon: <MdInbox /> },
        { path: '/vault', label: 'Vault Storage', icon: <FaUserShield /> },
        { path: '/users', label: 'Net Nodes', icon: <MdPeople /> },
        { path: '/blockchain', label: 'Blockchain', icon: <HiCubeTransparent /> },
        { path: '/connections', label: 'Connections', icon: <MdLink /> },
        { path: '/map-view', label: 'Map View', icon: <MdMap /> },
    ];

    if (user && user.is_admin) {
        menuItems.push({ path: '/admin', label: 'Admin Control', icon: <MdAdminPanelSettings /> });
    }

    const isActive = (path) => location.pathname === path;

    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
            <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
                {/* Brand top */}


                {/* Nav items */}
                <div className="sidebar-content">
                    <nav className="sidebar-nav">
                        {menuItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`sidebar-item ${isActive(item.path) ? 'sidebar-item-active' : ''}`}
                                onClick={onClose}
                            >
                                <span className="sidebar-icon">{item.icon}</span>
                                <span className="sidebar-label">{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                </div>


            </aside>
        </>
    );
};

export default Sidebar;
