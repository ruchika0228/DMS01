import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { MdAdd, MdDelete, MdBusiness, MdWork, MdPeople } from 'react-icons/md';
import './CreateDocumentPage.css';

/* ── small helper ──────────────────────────────── */
const Sel = ({ label, value, onChange, disabled, children, required, hint }) => (
    <div className="form-group">
        <label className="input-label">{label}</label>
        <select
            className="custom-select"
            value={value}
            onChange={onChange}
            disabled={disabled}
            required={required}
        >
            {children}
        </select>
        {hint && <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>{hint}</small>}
    </div>
);

const OPT = { background: '#111827' };

/* ═══════════════════════════════════════════════════════════════
   Default stage names (used when adding new stages quickly)
═══════════════════════════════════════════════════════════════ */
const DEFAULT_STAGE_NAMES = [
    'Stage 1 Approver',
    'Stage 2 Approver',
    'Stage 3 Approver',
    'Stage 4 Approver',
    'Stage 5 Approver',
    'Stage 6 Approver',
];

const BLANK_STAGE = (n) => ({
    stage_number: n,
    stage_name: DEFAULT_STAGE_NAMES[n - 1] || `Stage ${n}`,
    // hierarchy selection (not sent to API, used to cascade the dropdown)
    dept_id: '',
    pos_id: '',
    user_id: '',
    due_date: '',
});

/* ═══════════════════════════════════════════════════════════════ */
const CreateDocumentPage = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    /* ── Document fields ── */
    const [title,       setTitle]       = useState('');
    const [description, setDescription] = useState('');
    const [fileId,      setFileId]      = useState('');

    /* ── Hierarchy data ── */
    const [departments, setDepartments] = useState([]);
    const [positions,   setPositions]   = useState([]);
    const [users,       setUsers]       = useState([]);
    const [myFiles,     setMyFiles]     = useState([]);
    const [filesLoading, setFilesLoading] = useState(true);

    /* ── Approval stages ── */
    const [stages, setStages] = useState([BLANK_STAGE(1)]);

    /* ── Form state ── */
    const [loading, setLoading] = useState(false);

    /* ══ Fetch all data ══════════════════════════════════════════ */
    useEffect(() => {
        const fetchAll = async () => {
            try {
                // 1. Vault files (paginated)
                const firstPage = await api.get('/files/vault?page=1&size=100');
                const { items, pages } = firstPage.data;
                let allFiles = [...items];
                if (pages > 1) {
                    const extras = await Promise.all(
                        Array.from({ length: pages - 1 }, (_, i) =>
                            api.get(`/files/vault?page=${i + 2}&size=100`)
                        )
                    );
                    extras.forEach(r => { allFiles = [...allFiles, ...r.data.items]; });
                }

                // 2. Hierarchy lists (use /workflow/* so non-admin users can access)
                const [deptsR, posR, usersR] = await Promise.all([
                    api.get('/workflow/departments'),
                    api.get('/workflow/positions'),
                    api.get('/workflow/users-filter'),
                ]);

                setMyFiles(allFiles);
                setDepartments(deptsR.data);
                setPositions(posR.data);
                setUsers(usersR.data);
            } catch (err) {
                console.error('Failed to fetch data', err);
            } finally {
                setFilesLoading(false);
            }
        };
        fetchAll();
    }, []);

    /* ══ Cascade helpers ═════════════════════════════════════════ */
    /** Returns positions that belong to the given department */
    const getPositionsForDept = (deptId) =>
        positions.filter(p => String(p.department_id) === String(deptId) && p.status);

    /** Returns users that belong to the given position (& department) */
    const getUsersForPosition = (deptId, posId) => {
        // FILTER: Creator cannot be an approver
        let pool = users.filter(u => u.is_active && u.id !== currentUser?.id);
        
        if (posId) {
            // Primary filter: position match
            const byPos = pool.filter(u => String(u.position_id) === String(posId));
            if (byPos.length > 0) return byPos;
        }
        if (deptId) {
            // Secondary filter: at least in the right department
            const byDept = pool.filter(u => String(u.department_id) === String(deptId));
            if (byDept.length > 0) return byDept;
        }
        return pool; // Fallback: all active users (excluding creator)
    };

    /* ══ Stage management ════════════════════════════════════════ */
    const addStage = () => {
        if (stages.length < 6) {
            setStages([...stages, BLANK_STAGE(stages.length + 1)]);
        }
    };

    const removeStage = (idx) => {
        setStages(
            stages
                .filter((_, i) => i !== idx)
                .map((s, i) => ({ ...s, stage_number: i + 1 }))
        );
    };

    const updateStage = (idx, field, value) => {
        setStages(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };

            // Cascade resets
            if (field === 'dept_id') { next[idx].pos_id  = ''; next[idx].user_id = ''; }
            if (field === 'pos_id')  { next[idx].user_id = ''; }

            return next;
        });
    };

    /* ══ Submit ══════════════════════════════════════════════════ */
    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validate: every stage must have a user assigned
        for (const s of stages) {
            if (!s.user_id) {
                alert(`Please assign an approver for Stage ${s.stage_number}.`);
                return;
            }
        }
        setLoading(true);
        try {
            await api.post('/workflow/documents', {
                title,
                description,
                file_id: fileId,
                stages: stages.map(s => ({
                    stage_number: s.stage_number,
                    stage_name:   s.stage_name,
                    user_id:      s.user_id,
                    due_date:     s.due_date ? new Date(s.due_date).toISOString() : null,
                })),
            });
            alert('Document created and workflow initiated!');
            navigate('/workflow');
        } catch (err) {
            console.error('Failed to create document', err);
            alert(err.response?.data?.detail || 'Failed to create document');
        } finally {
            setLoading(false);
        }
    };

    /* ══ Render ══════════════════════════════════════════════════ */
    return (
        <div className="create-document-page reveal">
            <header className="page-header">
                <h1>Initiate New G-DMAS Workflow</h1>
                <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                    Define hierarchical approval stages for your document
                </p>
            </header>

            <form onSubmit={handleSubmit} className="workflow-form">
                <div className="form-grid">

                    {/* ── Left: Document Details ── */}
                    <Card className="form-card glass-card" title="Document Details">
                        <Input
                            label="Document Title *"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            placeholder="e.g. Annual Budget Proposal 2026"
                        />
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="input-label">Description</label>
                            <textarea
                                className="custom-textarea"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Provide brief context for the approvers..."
                            />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="input-label">Select File from Vault *</label>
                            <select
                                className="custom-select"
                                value={fileId}
                                onChange={e => setFileId(e.target.value)}
                                required
                            >
                                <option value="" style={OPT}>
                                    {filesLoading ? '⏳ Loading vault files…' : '-- Select a document --'}
                                </option>
                                {myFiles.map(f => (
                                    <option key={f.id} value={f.id} style={OPT}>
                                        📄 {f.file_name}  [{f.file_type?.toUpperCase() || 'FILE'}]  — {f.category || 'Uncategorized'}
                                    </option>
                                ))}
                            </select>
                            {!filesLoading && myFiles.length > 0 && (
                                <small style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                    ✅ {myFiles.length} file{myFiles.length !== 1 ? 's' : ''} available in your vault
                                </small>
                            )}
                            {!filesLoading && myFiles.length === 0 && (
                                <small style={{ color: '#f59e0b', marginTop: 4, display: 'block' }}>
                                    ⚠️ No files in vault. Please upload a file first.
                                </small>
                            )}
                        </div>
                    </Card>

                    {/* ── Right: Approval Workflow Builder ── */}
                    <Card className="stages-card glass-card" title="Approval Workflow Builder">
                        <div className="stages-list">
                            {stages.map((stage, idx) => {
                                const posForDept   = getPositionsForDept(stage.dept_id);
                                const usersForStage = getUsersForPosition(stage.dept_id, stage.pos_id);

                                return (
                                    <div key={idx} className="stage-item selection-glow">
                                        {/* ── Stage Header ── */}
                                        <div className="stage-header">
                                            <span className="stage-badge">Stage {stage.stage_number}</span>
                                            {idx > 0 && (
                                                <button type="button" className="remove-btn" onClick={() => removeStage(idx)}>
                                                    <MdDelete />
                                                </button>
                                            )}
                                        </div>

                                        {/* ── Stage Name ── */}
                                        <div className="stage-inputs">
                                            <Input
                                                label="Stage / Role Label"
                                                value={stage.stage_name}
                                                onChange={e => updateStage(idx, 'stage_name', e.target.value)}
                                                required
                                                placeholder="e.g. Finance Review"
                                            />

                                            {/* ── Hierarchy Box ── */}
                                            <div style={{
                                                background: 'rgba(99,102,241,0.06)',
                                                borderRadius: '10px',
                                                padding: '0.85rem',
                                                border: '1px solid rgba(99,102,241,0.18)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.75rem'
                                            }}>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                    Select Approver Hierarchy
                                                </div>

                                                {/* Department */}
                                                <Sel
                                                    label={<><MdBusiness style={{ verticalAlign: 'middle', marginRight: 4 }} />Department</>}
                                                    value={stage.dept_id}
                                                    onChange={e => updateStage(idx, 'dept_id', e.target.value)}
                                                >
                                                    <option value="" style={OPT}>-- Select Department --</option>
                                                    {departments.filter(d => d.status).map(d => (
                                                        <option key={d.id} value={d.id} style={OPT}>{d.name}</option>
                                                    ))}
                                                </Sel>

                                                {/* Position */}
                                                <Sel
                                                    label={<><MdWork style={{ verticalAlign: 'middle', marginRight: 4 }} />Position</>}
                                                    value={stage.pos_id}
                                                    onChange={e => updateStage(idx, 'pos_id', e.target.value)}
                                                    disabled={!stage.dept_id}
                                                    hint={stage.dept_id && posForDept.length === 0 ? '⚠ No positions in this department yet.' : null}
                                                >
                                                    <option value="" style={OPT}>
                                                        {stage.dept_id ? '-- Any Position --' : '-- Select Department first --'}
                                                    </option>
                                                    {posForDept.map(p => (
                                                        <option key={p.id} value={p.id} style={OPT}>{p.name}</option>
                                                    ))}
                                                </Sel>

                                                {/* Approver User */}
                                                <Sel
                                                    label={<><MdPeople style={{ verticalAlign: 'middle', marginRight: 4 }} />Assign Approver *</>}
                                                    value={stage.user_id}
                                                    onChange={e => updateStage(idx, 'user_id', e.target.value)}
                                                    required
                                                    hint={`${usersForStage.length} user${usersForStage.length !== 1 ? 's' : ''} match this selection`}
                                                >
                                                    <option value="" style={OPT}>-- Select User --</option>
                                                    {usersForStage.map(u => (
                                                        <option key={u.id} value={u.id} style={OPT}>
                                                            {u.full_name || u.username}
                                                            {u.designation ? ` — ${u.designation}` : ''}
                                                            {u.approval_stage ? ` [Stage ${u.approval_stage}]` : ''}
                                                            {u.department ? ` (${u.department})` : ''}
                                                        </option>
                                                    ))}
                                                </Sel>
                                            </div>

                                            {/* SLA Due Date */}
                                            <Input
                                                label="Due Date (SLA)"
                                                type="datetime-local"
                                                value={stage.due_date}
                                                onChange={e => updateStage(idx, 'due_date', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {stages.length < 6 && (
                            <button type="button" className="add-stage-btn" onClick={addStage}>
                                <MdAdd /> Add Approval Stage
                            </button>
                        )}
                    </Card>
                </div>

                <div className="form-footer">
                    <Button type="button" variant="secondary" onClick={() => navigate('/workflow')}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={loading}>
                        {loading ? 'Initiating…' : 'Launch Workflow'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CreateDocumentPage;
