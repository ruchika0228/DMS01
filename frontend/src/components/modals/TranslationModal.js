import React, { useState } from 'react';
import axios from 'axios';
import './TranslationModal.css';

const LANGUAGES = [
    { code: 'hi', name: 'Hindi' },
    { code: 'mr', name: 'Marathi' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ru', name: 'Russian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'it', name: 'Italian' },
    { code: 'ko', name: 'Korean' }
];

const TranslationModal = ({ isOpen, onClose, text, apiKey }) => {
    const [targetLanguage, setTargetLanguage] = useState('hi');
    const [translatedText, setTranslatedText] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [error, setError] = useState('');

    const handleTranslate = async () => {
        if (!text) {
            setError("No text available to translate. Please run AI Analysis first.");
            return;
        }

        setIsTranslating(true);
        setError('');
        try {
            const response = await axios.post(
                `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
                {
                    q: text,
                    target: targetLanguage,
                    format: 'text'
                }
            );

            const translation = response.data.data.translations[0].translatedText;
            
            // Simple way to decode HTML entities returned by Google Translate
            const decodedTranslation = translation
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&nbsp;/g, ' ');
                
            setTranslatedText(decodedTranslation);
        } catch (err) {
            console.error("Translation failed", err);
            const detail = err.response?.data?.error?.message || err.message || "Unknown error";
            setError(`Translation failed: ${detail}`);
        } finally {
            setIsTranslating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="translation-modal-overlay" onClick={onClose}>
            <div className="translation-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="translation-modal-header">
                    <h3>Translate Document</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="translation-modal-body">
                    <div className="form-group">
                        <label htmlFor="language-select">Select Target Language:</label>
                        <select 
                            id="language-select" 
                            value={targetLanguage} 
                            onChange={(e) => setTargetLanguage(e.target.value)}
                            disabled={isTranslating}
                        >
                            {LANGUAGES.map(lang => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="actions">
                        <button 
                            className="translate-btn" 
                            onClick={handleTranslate} 
                            disabled={isTranslating || !text}
                        >
                            {isTranslating ? 'Translating...' : 'Translate'}
                        </button>
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    {translatedText && (
                        <div className="translation-result">
                            <h4>Translated Text:</h4>
                            <div className="translated-box">
                                {translatedText}
                            </div>
                        </div>
                    )}
                    
                    {!text && !error && (
                        <p className="info-message">AI Analysis text not found. Please run AI Analysis first to get document text.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TranslationModal;
