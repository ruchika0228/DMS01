import React, { useState } from 'react';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import './Input.css';

const Input = ({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    error,
    disabled = false,
    required = false,
    name,
    className = '',
    icon
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const hasValue = value && value.length > 0;
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const inputClasses = [
        'input-wrapper',
        isFocused || hasValue ? 'input-focused' : '',
        error ? 'input-error' : '',
        disabled ? 'input-disabled' : '',
        icon ? 'input-with-icon' : '',
        isPassword ? 'has-password-toggle' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={inputClasses}>
            {icon && <span className="input-icon">{icon}</span>}
            <div className="input-container">
                <input
                    type={inputType}
                    value={value}
                    onChange={onChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    disabled={disabled}
                    required={required}
                    name={name}
                    className="input-field"
                    placeholder={placeholder || ' '}
                    autoComplete={isPassword ? 'current-password' : 'off'}
                />

                {label && (
                    <label className="input-label">
                        {label}
                        {required && <span className="input-required">*</span>}
                    </label>
                )}

                {isPassword && (
                    <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={togglePasswordVisibility}
                        tabIndex="-1"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? (
                            <MdVisibilityOff className="password-icon" />
                        ) : (
                            <MdVisibility className="password-icon" />
                        )}
                    </button>
                )}
            </div>
            {error && <span className="input-error-message">{error}</span>}
        </div>
    );
};

export default Input;
