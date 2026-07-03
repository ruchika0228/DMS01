import React from 'react';
import { IoMoon, IoSunny } from 'react-icons/io5';
import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            <div className={`toggle-track ${theme}`}>
                <div className="toggle-thumb">
                    {theme === 'dark' ? (
                        <IoMoon className="theme-icon" />
                    ) : (
                        <IoSunny className="theme-icon" />
                    )}
                </div>
            </div>
        </button>
    );
};

export default ThemeToggle;
