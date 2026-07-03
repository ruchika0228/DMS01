import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import {
    MdPeople, MdDescription, MdTimer, MdHistory,
    MdEdit, MdDelete, MdAdd, MdBusiness, MdWork,
    MdPersonAdd, MdVpnKey
} from 'react-icons/md';
import './AdminDashboard.css';

/* ─── tiny helpers ────────────────────────────────────────────── */
const EMPTY_DEPT  = { name: '', description: '', status: true };
const EMPTY_POS   = { name: '', description: '', department_id: '', status: true };
const EMPTY_USER  = {
    username: '', email: '', password: '', full_name: '', phone: '',
    department_id: '', position_id: '', approval_stage: '',
    is_admin: false, is_active: true
};
const EMPTY_PASS  = { password: '', confirmPassword: '' };

/* ─── Select helper ────────────────────────────────────────────── */
const Sel = ({ label, value, onChange, disabled, children, required }) => (
    <div className="input-wrapper">
        <label className="input-label">{label}{required && ' *'}</label>
        <select className="input-field" value={value} onChange={onChange} disabled={disabled} required={required}>
            {children}
        </select>
    </div>
);

const OPT = { background: '#111827' };

/* ═══════════════════════════════════════════════════════════════ */
const AdminDashboard = () => {
    /* ── Data ── */
    const [departments, setDepartments]   = useState([]);
    const [positions,   setPositions]     = useState([]);
    const [users,       setUsers]         = useState([]);
    const [documents,   setDocuments]     = useState([]);
    const [auditLogs,   setAuditLogs]     = useState([]);
    const [slaBreaches, setSlaBreaches]   = useState([]);
    const [loading,     setLoading]       = useState(true);

    /* ── Active tab ── */
    const [activeTab, setActiveTab] = useState('department'); // department | position | user

    /* ── Department modal ── */
    const [deptModal,   setDeptModal]   = useState(false);
    const [deptEdit,    setDeptEdit]    = useState(null); // null = create
    const [deptForm,    setDeptForm]    = useState(EMPTY_DEPT);

    /* ── Position modal ── */
    const [posModal,    setPosModal]    = useState(false);
    const [posEdit,     setPosEdit]     = useState(null);
    const [posForm,     setPosForm]     = useState(EMPTY_POS);

    /* ── User modal ── */
    const [userModal,   setUserModal]   = useState(false);
    const [userEdit,    setUserEdit]    = useState(null);
    const [userForm,    setUserForm]    = useState(EMPTY_USER);

    /* ── Password modal ── */
    const [passModal,   setPassModal]   = useState(false);
    const [passTarget,  setPassTarget]  = useState(null);
    const [passForm,    setPassForm]    = useState(EMPTY_PASS);

    /* ══ Fetch ══════════════════════════════════════════════════ */
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [deptsR, posR, usersR, docsR, logsR, slaR] = await Promise.all([
                api.get('/admin/departments'),
                api.get('/admin/positions'),
                api.get('/admin/users'),
                api.get('/admin/documents'),
                api.get('/admin/audit-logs'),
                api.get('/admin/sla-breaches'),
            ]);
            setDepartments(deptsR.data);
            setPositions(posR.data);
            setUsers(usersR.data);
            setDocuments(docsR.data);
            setAuditLogs(logsR.data);
            setSlaBreaches(slaR.data);
        } catch (err) {
            console.error('Admin fetch failed', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /* ══ Derived ═════════════════════════════════════════════════ */
    // positions filtered by the department currently selected in the user form
    const positionsForUserForm = positions.filter(
        p => p.department_id === userForm.department_id
    );

    /* ══ Department CRUD ════════════════════════════════════════ */
    const openDeptCreate = () => { setDeptEdit(null); setDeptForm(EMPTY_DEPT); setDeptModal(true); };
    const openDeptEdit   = (d)  => { setDeptEdit(d);  setDeptForm({ name: d.name, description: d.description || '', status: d.status }); setDeptModal(true); };

    const saveDept = async (e) => {
        e.preventDefault();
        try {
            if (deptEdit) await api.put(`/admin/departments/${deptEdit.id}`, deptForm);
            else          await api.post('/admin/departments', deptForm);
            setDeptModal(false);
            fetchAll();
        } catch (err) { alert(err.response?.data?.detail || 'Failed to save department'); }
    };

    const deleteDept = async (id) => {
        if (!window.confirm('Delete this department? This will fail if positions are linked to it.')) return;
        try { await api.delete(`/admin/departments/${id}`); fetchAll(); }
        catch (err) { alert(err.response?.data?.detail || 'Failed to delete department'); }
    };

    /* ══ Position CRUD ══════════════════════════════════════════ */
    const openPosCreate = () => { setPosEdit(null); setPosForm(EMPTY_POS); setPosModal(true); };
    const openPosEdit   = (p)  => { setPosEdit(p);  setPosForm({ name: p.name, description: p.description || '', department_id: p.department_id, status: p.status }); setPosModal(true); };

    const savePos = async (e) => {
        e.preventDefault();
        if (!posForm.department_id) { alert('Please select a department.'); return; }
        try {
            if (posEdit) await api.put(`/admin/positions/${posEdit.id}`, posForm);
            else         await api.post('/admin/positions', posForm);
            setPosModal(false);
            fetchAll();
        } catch (err) { alert(err.response?.data?.detail || 'Failed to save position'); }
    };

    const deletePos = async (id) => {
        if (!window.confirm('Delete this position? This will fail if users are assigned to it.')) return;
        try { await api.delete(`/admin/positions/${id}`); fetchAll(); }
        catch (err) { alert(err.response?.data?.detail || 'Failed to delete position'); }
    };

    /* ══ User CRUD ══════════════════════════════════════════════ */
    const openUserCreate = () => { setUserEdit(null); setUserForm(EMPTY_USER); setUserModal(true); };
    const openUserEdit   = (u)  => {
        setUserEdit(u);
        setUserForm({
            username:      u.username,
            email:         u.email,
            password:      '',
            full_name:     u.full_name || '',
            phone:         u.phone || '',
            department_id: u.department_id || '',
            position_id:   u.position_id   || '',
            approval_stage: u.approval_stage || '',
            is_admin:      u.is_admin,
            is_active:     u.is_active,
        });
        setUserModal(true);
    };

    const saveUser = async (e) => {
        e.preventDefault();
        const payload = {
            ...userForm,
            department_id:  userForm.department_id  || null,
            position_id:    userForm.position_id    || null,
            approval_stage: userForm.approval_stage === '' ? null : parseInt(userForm.approval_stage),
        };
        if (!userEdit) {
            // create: password required
            if (!payload.password) { alert('Password is required'); return; }
        } else {
            // edit: omit password if blank
            if (!payload.password) delete payload.password;
        }
        try {
            if (userEdit) await api.put(`/admin/users/${userEdit.id}`, payload);
            else          await api.post('/admin/users', payload);
            setUserModal(false);
            fetchAll();
        } catch (err) { alert(err.response?.data?.detail || 'Failed to save user'); }
    };

    const deleteUser = async (id) => {
        if (!window.confirm('Delete this user? All their documents and files will be removed.')) return;
        try { await api.delete(`/admin/users/${id}`); fetchAll(); }
        catch (err) { alert(err.response?.data?.detail || 'Failed to delete user'); }
    };

    /* ══ Password Reset ══════════════════════════════════════════ */
    const openPassReset = (u) => {
        setPassTarget(u);
        setPassForm(EMPTY_PASS);
        setPassModal(true);
    };

    const savePassword = async (e) => {
        e.preventDefault();
        if (!passForm.password) { alert('Password cannot be empty'); return; }
        if (passForm.password !== passForm.confirmPassword) { alert('Passwords do not match'); return; }

        try {
            await api.put(`/admin/users/${passTarget.id}`, { password: passForm.password });
            setPassModal(false);
            alert(`Password updated successfully for ${passTarget.username}`);
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to update password');
        }
    };

    /* ══ Render helpers ══════════════════════════════════════════ */
    const getDeptName = (id) => departments.find(d => String(d.id) === String(id))?.name || 'N/A';
    const getPosName  = (id) => positions.find(p => String(p.id) === String(id))?.name  || 'N/A';

    if (loading) return <div className="admin-loading">Initializing Admin Console...</div>;

    /* ══════════════════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════════════════ */
    return (
        <div className="admin-dashboard reveal">

            {/* ── Header ── */}
            <header className="admin-header">
                <h1>Admin Control Center</h1>
                <p>System-wide monitoring and governance</p>
            </header>

            {/* ── Stats ── */}
            <div className="stats-grid">
                <div className="stat-card glass-card">
                    <MdBusiness className="stat-icon" />
                    <div className="stat-label">Departments</div>
                    <div className="stat-value">{departments.length}</div>
                </div>
                <div className="stat-card glass-card">
                    <MdWork className="stat-icon" />
                    <div className="stat-label">Positions</div>
                    <div className="stat-value">{positions.length}</div>
                </div>
                <div className="stat-card glass-card">
                    <MdPeople className="stat-icon" />
                    <div className="stat-label">Total Users</div>
                    <div className="stat-value">{users.length}</div>
                </div>
                <div className="stat-card glass-card">
                    <MdDescription className="stat-icon" />
                    <div className="stat-label">Documents</div>
                    <div className="stat-value">{documents.length}</div>
                </div>
                <div className="stat-card glass-card">
                    <MdTimer className="stat-icon" />
                    <div className="stat-label">SLA Breaches</div>
                    <div className="stat-value text-danger">{slaBreaches.length}</div>
                </div>
                <div className="stat-card glass-card">
                    <MdHistory className="stat-icon" />
                    <div className="stat-label">Audit Logs</div>
                    <div className="stat-value">{auditLogs.length}</div>
                </div>
            </div>

            {/* ── 3 Action Buttons ── */}
            <div className="admin-action-bar">
                <button
                    className={`admin-tab-btn ${activeTab === 'department' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('department'); openDeptCreate(); }}
                >
                    <MdBusiness /> Create Department
                </button>
                <button
                    className={`admin-tab-btn ${activeTab === 'position' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('position'); openPosCreate(); }}
                >
                    <MdWork /> Create Position
                </button>
                <button
                    className={`admin-tab-btn ${activeTab === 'user' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('user'); openUserCreate(); }}
                >
                    <MdPersonAdd /> Create User
                </button>
            </div>

            {/* ── Main Content Grid ── */}
            <div className="admin-main-grid" style={{ gridTemplateColumns: '1fr' }}>

                {/* ═══ Department Table ═══════════════════════════════════ */}
                <Card className="glass-card">
                    <div className="card-header-with-action">
                        <h3><MdBusiness style={{ marginRight: 8, verticalAlign: 'middle' }} />Departments</h3>
                        <Button variant="primary" onClick={openDeptCreate}>
                            <MdAdd style={{ marginRight: 6 }} /> Add Department
                        </Button>
                    </div>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Description</th>
                                    <th>Positions</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {departments.length === 0 && (
                                    <tr><td colSpan={5} className="no-data">No departments yet. Create one to begin.</td></tr>
                                )}
                                {departments.map(dept => {
                                    const posCount = positions.filter(p => String(p.department_id) === String(dept.id)).length;
                                    return (
                                        <tr key={dept.id}>
                                            <td className="user-name">{dept.name}</td>
                                            <td><span className="user-email">{dept.description || '—'}</span></td>
                                            <td><Badge variant="info">{posCount} position{posCount !== 1 ? 's' : ''}</Badge></td>
                                            <td><Badge variant={dept.status ? 'success' : 'danger'}>{dept.status ? 'Active' : 'Inactive'}</Badge></td>
                                            <td>
                                                <button className="icon-btn" onClick={() => openDeptEdit(dept)} title="Edit"><MdEdit /></button>
                                                <button className="icon-btn delete-btn" onClick={() => deleteDept(dept.id)} title="Delete"><MdDelete /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* ═══ Position Table ══════════════════════════════════════ */}
                <Card className="glass-card" style={{ marginTop: '1.5rem' }}>
                    <div className="card-header-with-action">
                        <h3><MdWork style={{ marginRight: 8, verticalAlign: 'middle' }} />Positions</h3>
                        <Button variant="primary" onClick={openPosCreate}>
                            <MdAdd style={{ marginRight: 6 }} /> Add Position
                        </Button>
                    </div>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Position Name</th>
                                    <th>Department</th>
                                    <th>Description</th>
                                    <th>Users</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.length === 0 && (
                                    <tr><td colSpan={6} className="no-data">No positions yet. Create departments first, then add positions.</td></tr>
                                )}
                                {positions.map(pos => {
                                    const userCount = users.filter(u => String(u.position_id) === String(pos.id)).length;
                                    return (
                                        <tr key={pos.id}>
                                            <td className="user-name">{pos.name}</td>
                                            <td>
                                                <div className="dept-info">
                                                    <span>{getDeptName(pos.department_id)}</span>
                                                </div>
                                            </td>
                                            <td><span className="user-email">{pos.description || '—'}</span></td>
                                            <td><Badge variant="secondary">{userCount} user{userCount !== 1 ? 's' : ''}</Badge></td>
                                            <td><Badge variant={pos.status ? 'success' : 'danger'}>{pos.status ? 'Active' : 'Inactive'}</Badge></td>
                                            <td>
                                                <button className="icon-btn" onClick={() => openPosEdit(pos)} title="Edit"><MdEdit /></button>
                                                <button className="icon-btn delete-btn" onClick={() => deletePos(pos.id)} title="Delete"><MdDelete /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* ═══ User Table ══════════════════════════════════════════ */}
                <Card className="glass-card" style={{ marginTop: '1.5rem' }}>
                    <div className="card-header-with-action">
                        <h3><MdPeople style={{ marginRight: 8, verticalAlign: 'middle' }} />Users</h3>
                        <Button variant="primary" onClick={openUserCreate}>
                            <MdPersonAdd style={{ marginRight: 6 }} /> Add User
                        </Button>
                    </div>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Department</th>
                                    <th>Position</th>
                                    <th>Stage</th>
                                    <th>Status</th>
                                    <th>Role</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 && (
                                    <tr><td colSpan={7} className="no-data">No users yet.</td></tr>
                                )}
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="user-info">
                                                <span className="user-name">{user.full_name || user.username}</span>
                                                <span className="user-email">{user.email}</span>
                                                {user.phone && <span className="user-email">{user.phone}</span>}
                                            </div>
                                        </td>
                                        <td>{user.department_id ? getDeptName(user.department_id) : (user.department || '—')}</td>
                                        <td>{user.position_id  ? getPosName(user.position_id)   : (user.designation || '—')}</td>
                                        <td>{user.approval_stage ? <Badge variant="info">Stage {user.approval_stage}</Badge> : '—'}</td>
                                        <td><Badge variant={user.is_active ? 'success' : 'danger'}>{user.is_active ? 'Active' : 'Inactive'}</Badge></td>
                                        <td><Badge variant={user.is_admin ? 'primary' : 'secondary'}>{user.is_admin ? 'Admin' : 'User'}</Badge></td>
                                        <td>
                                            <button className="icon-btn" onClick={() => openUserEdit(user)} title="Edit Details"><MdEdit /></button>
                                            <button className="icon-btn" onClick={() => openPassReset(user)} title="Change Password" style={{ color: '#fbbf24', marginLeft: '0.75rem' }}><MdVpnKey /></button>
                                            <button className="icon-btn delete-btn" onClick={() => deleteUser(user.id)} title="Delete"><MdDelete /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* ═══ Activity Side (below on narrow) ═══════════════════ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                    <Card className="glass-card" title="Recent SLA Breaches">
                        <div className="activity-list">
                            {slaBreaches.length > 0 ? slaBreaches.slice(0, 5).map((log, i) => (
                                <div key={i} className="activity-item selection-glow">
                                    <div className="activity-details">
                                        <div className="activity-title">Escalation on Doc #{String(log.document_id).substring(0, 8)}</div>
                                        <div className="activity-time">{new Date(log.timestamp).toLocaleString()}</div>
                                        <div className="activity-meta">{log.details}</div>
                                    </div>
                                </div>
                            )) : <p className="no-data">No SLA breaches recorded.</p>}
                        </div>
                    </Card>
                    <Card className="glass-card" title="Recent Audit Logs">
                        <div className="activity-list">
                            {auditLogs.slice(0, 5).map((log, i) => (
                                <div key={i} className="activity-item selection-glow">
                                    <div className="activity-details">
                                        <div className="activity-title">{log.action}</div>
                                        <div className="activity-time">{new Date(log.timestamp).toLocaleString()}</div>
                                        <div className="activity-meta">by {log.user?.username || 'System'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════
                MODALS
            ════════════════════════════════════════════════════════════ */}

            {/* ── Department Modal ── */}
            <Modal isOpen={deptModal} onClose={() => setDeptModal(false)} title={deptEdit ? 'Edit Department' : 'Create Department'}>
                <form onSubmit={saveDept} className="edit-user-form">
                    <Input
                        label="Department Name *"
                        value={deptForm.name}
                        onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                        required
                        placeholder="e.g. Finance & Budgeting"
                    />
                    <div className="input-wrapper">
                        <label className="input-label">Description</label>
                        <textarea
                            className="input-field"
                            rows={3}
                            value={deptForm.description}
                            onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                            placeholder="Brief description of this department"
                            style={{ resize: 'vertical', minHeight: '70px' }}
                        />
                    </div>
                    <Sel label="Status" value={deptForm.status ? 'true' : 'false'} onChange={e => setDeptForm({ ...deptForm, status: e.target.value === 'true' })}>
                        <option value="true" style={OPT}>Active</option>
                        <option value="false" style={OPT}>Inactive</option>
                    </Sel>
                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => setDeptModal(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">{deptEdit ? 'Update Department' : 'Create Department'}</Button>
                    </div>
                </form>
            </Modal>

            {/* ── Position Modal ── */}
            <Modal isOpen={posModal} onClose={() => setPosModal(false)} title={posEdit ? 'Edit Position' : 'Create Position'}>
                <form onSubmit={savePos} className="edit-user-form">
                    <Sel
                        label="Department *"
                        value={posForm.department_id}
                        onChange={e => setPosForm({ ...posForm, department_id: e.target.value })}
                        required
                    >
                        <option value="" style={OPT}>-- Select Department --</option>
                        {departments.filter(d => d.status).map(d => (
                            <option key={d.id} value={d.id} style={OPT}>{d.name}</option>
                        ))}
                    </Sel>
                    <Input
                        label="Position Name *"
                        value={posForm.name}
                        onChange={e => setPosForm({ ...posForm, name: e.target.value })}
                        required
                        placeholder="e.g. Section Officer"
                    />
                    <div className="input-wrapper">
                        <label className="input-label">Description</label>
                        <textarea
                            className="input-field"
                            rows={3}
                            value={posForm.description}
                            onChange={e => setPosForm({ ...posForm, description: e.target.value })}
                            placeholder="Brief description of this position"
                            style={{ resize: 'vertical', minHeight: '70px' }}
                        />
                    </div>
                    <Sel label="Status" value={posForm.status ? 'true' : 'false'} onChange={e => setPosForm({ ...posForm, status: e.target.value === 'true' })}>
                        <option value="true" style={OPT}>Active</option>
                        <option value="false" style={OPT}>Inactive</option>
                    </Sel>
                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => setPosModal(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">{posEdit ? 'Update Position' : 'Create Position'}</Button>
                    </div>
                </form>
            </Modal>

            {/* ── User Modal ── */}
            <Modal isOpen={userModal} onClose={() => setUserModal(false)} title={userEdit ? 'Edit User' : 'Create User'}>
                <form onSubmit={saveUser} className="edit-user-form">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Input
                            label="Username *"
                            value={userForm.username}
                            onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                            required
                        />
                        <Input
                            label="Full Name"
                            value={userForm.full_name}
                            onChange={e => setUserForm({ ...userForm, full_name: e.target.value })}
                            placeholder="Display name"
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Input
                            label="Email *"
                            type="email"
                            value={userForm.email}
                            onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                            required
                        />
                        <Input
                            label="Phone"
                            value={userForm.phone}
                            onChange={e => setUserForm({ ...userForm, phone: e.target.value })}
                            placeholder="+91 XXXXX XXXXX"
                        />
                    </div>
                    <Input
                        label={userEdit ? 'New Password (leave blank to keep)' : 'Password *'}
                        type="password"
                        value={userForm.password}
                        onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                        required={!userEdit}
                    />

                    {/* Department → Position cascade */}
                    <div style={{ background: 'rgba(99,102,241,0.07)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Organisational Hierarchy
                        </div>
                        <Sel
                            label="Department"
                            value={userForm.department_id}
                            onChange={e => setUserForm({ ...userForm, department_id: e.target.value, position_id: '' })}
                        >
                            <option value="" style={OPT}>-- Select Department --</option>
                            {departments.filter(d => d.status).map(d => (
                                <option key={d.id} value={d.id} style={OPT}>{d.name}</option>
                            ))}
                        </Sel>
                        <Sel
                            label="Position"
                            value={userForm.position_id}
                            onChange={e => setUserForm({ ...userForm, position_id: e.target.value })}
                            disabled={!userForm.department_id}
                        >
                            <option value="" style={OPT}>{userForm.department_id ? '-- Select Position --' : '-- Select Department first --'}</option>
                            {positionsForUserForm.filter(p => p.status).map(p => (
                                <option key={p.id} value={p.id} style={OPT}>{p.name}</option>
                            ))}
                        </Sel>
                        {userForm.department_id && positionsForUserForm.length === 0 && (
                            <small style={{ color: '#f59e0b' }}>⚠ No positions exist for this department yet. Create positions first.</small>
                        )}
                    </div>

                    <Sel
                        label="Approval Stage (1–6)"
                        value={userForm.approval_stage}
                        onChange={e => setUserForm({ ...userForm, approval_stage: e.target.value })}
                    >
                        <option value="" style={OPT}>-- None (auto-assign) --</option>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                            <option key={n} value={n} style={OPT}>Stage {n}</option>
                        ))}
                    </Sel>
                    <small style={{ color: 'var(--text-muted)', marginTop: '-1rem' }}>Users can only approve documents at their assigned stage.</small>

                    <div className="form-group-checkbox">
                        <label>
                            <input type="checkbox" checked={userForm.is_admin}
                                onChange={e => setUserForm({ ...userForm, is_admin: e.target.checked })} />
                            Is Admin
                        </label>
                        <label>
                            <input type="checkbox" checked={userForm.is_active}
                                onChange={e => setUserForm({ ...userForm, is_active: e.target.checked })} />
                            Is Active
                        </label>
                    </div>
                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => setUserModal(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">{userEdit ? 'Update User' : 'Create User'}</Button>
                    </div>
                </form>
            </Modal>

            {/* ── Password Reset Modal ── */}
            <Modal 
                isOpen={passModal} 
                onClose={() => setPassModal(false)} 
                title={`Change Password: ${passTarget?.username}`}
            >
                <form onSubmit={savePassword} className="edit-user-form">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Enter a new password for <strong>{passTarget?.full_name || passTarget?.username}</strong>.
                    </p>
                    <Input
                        label="New Password"
                        type="password"
                        value={passForm.password}
                        onChange={e => setPassForm({ ...passForm, password: e.target.value })}
                        required
                        placeholder="••••••••"
                    />
                    <Input
                        label="Confirm New Password"
                        type="password"
                        value={passForm.confirmPassword}
                        onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                        required
                        placeholder="••••••••"
                    />
                    <div className="form-actions" style={{ marginTop: '2rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setPassModal(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">Update Password</Button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};

export default AdminDashboard;
