import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import GlobalAlert from '../components/ui/GlobalAlert';
import { useAuth } from '../context/AuthContext';
import { MdSecurity, MdGroups, MdHistory, MdVerifiedUser } from 'react-icons/md';
import './AuthPage.css';

import dmsLogo from '../assets/fms_logo.png';
import vgLogo from '../assets/vg-logo.png';

const AuthPage = () => {
    const navigate = useNavigate();
    const { user, login, signup } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);

    // Redirect if already logged in
    React.useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    // Unified alert state
    const [alert, setAlert] = useState({
        show: false,
        type: 'info',
        message: ''
    });

    const showAlert = (type, message) => {
        setAlert({
            show: true,
            type,
            message
        });
    };

    const handleCloseAlert = () => {
        setAlert({ ...alert, show: false });
    };

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '', // Maps to username for now
        confirmPassword: ''
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                await login(formData.email, formData.password);
                navigate('/dashboard');
            } else {
                if (formData.password !== formData.confirmPassword) {
                    showAlert('error', "Passwords do not match");
                    setLoading(false);
                    return;
                }

                await signup({
                    email: formData.email,
                    username: formData.name,
                    password: formData.password
                });

                setIsLogin(true);
                showAlert('success', 'Account created! Please sign in.');
                setFormData({ ...formData, password: '', confirmPassword: '' });
            }
        } catch (err) {
            console.error(err);
            let errorMessage = 'An error occurred. Please try again.';

            if (err.response && err.response.data) {
                const { detail } = err.response.data;
                if (typeof detail === 'string') errorMessage = detail;
                else if (Array.isArray(detail)) errorMessage = detail.map(i => i.msg || JSON.stringify(i)).join('. ');
                else errorMessage = JSON.stringify(detail);
            }
            showAlert('error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        handleCloseAlert();
        setFormData({
            email: '',
            password: '',
            name: '',
            confirmPassword: ''
        });
    };

    return (
        <div className="auth-page reveal">
            <div className="auth-mesh-bg"></div>
            
            <div className="auth-card glass">
                <div className="auth-brand-section">
                    <div className="auth-logos">
                        <div className="auth-logo-box">
                            <img src={vgLogo} alt="VG Logo" className="auth-logo-img" />
                        </div>
                        <div className="auth-logo-divider"></div>
                        <h1 className="auth-brand-name">DMS<span>ENGINE</span></h1>
                    </div>
                    
                    <div className="auth-welcome">
                        <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                        <p>{isLogin ? 'Enter your credentials to access the secure vault.' : 'Join the most secure decentralized management platform.'}</p>
                    </div>

                    <div className="auth-features-grid">
                        <div className="auth-feature-card">
                            <MdSecurity className="feature-icon" />
                            <span>Vault Security</span>
                        </div>
                        <div className="auth-feature-card">
                            <MdGroups className="feature-icon" />
                            <span>Collaborate</span>
                        </div>
                        <div className="auth-feature-card">
                            <MdHistory className="feature-icon" />
                            <span>History Log</span>
                        </div>
                        <div className="auth-feature-card">
                            <MdVerifiedUser className="feature-icon" />
                            <span>Verified</span>
                        </div>
                    </div>
                </div>

                <div className="auth-form-section">
                    {alert.show && (
                        <GlobalAlert
                            type={alert.type}
                            message={alert.message}
                            onClose={handleCloseAlert}
                        />
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        {!isLogin && (
                            <Input
                                label="Username"
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="Choose a name"
                            />
                        )}

                        <Input
                            label="Email/Username"
                            type="text"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />

                        <Input
                            label="Password"
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />

                        {!isLogin && (
                            <Input
                                label="Confirm Password"
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                        )}

                        {isLogin && (
                            <div className="auth-options">
                                <label className="checkbox-label">
                                    <input type="checkbox" />
                                    <span>Stay logged in</span>
                                </label>
                                <button type="button" className="forgot-link">Forgot password?</button>
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            size="large"
                            fullWidth
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Access Vault' : 'Sign Up')}
                        </Button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            {isLogin ? "New here?" : 'Already a member?'}
                            <button onClick={toggleMode} className="toggle-btn">
                                {isLogin ? 'Create Account' : 'Sign In'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;

