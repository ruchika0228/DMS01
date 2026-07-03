import React, { useState, useEffect, useRef } from 'react';
import { MdClose, MdSend, MdChat } from 'react-icons/md';
import api from '../api/axios';
import './ChatBot.css';

const BotIcon = () => (
    <div className="animated-bot-icon">
        <svg viewBox="0 0 100 100" className="bot-svg">
            {/* Body/Head */}
            <rect x="20" y="25" width="60" height="50" rx="15" className="bot-head" />
            {/* Eyes */}
            <circle cx="40" cy="50" r="6" className="bot-eye left" />
            <circle cx="60" cy="50" r="6" className="bot-eye right" />
            {/* Mouth */}
            <rect x="40" y="62" width="20" height="3" rx="2" className="bot-mouth" />
            {/* Antenna */}
            <line x1="50" y1="25" x2="50" y2="10" className="bot-antenna-wire" />
            <circle cx="50" cy="10" r="5" className="bot-antenna-tip" />
        </svg>
    </div>
);

const ChatBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { text: "Hello! I am DMS BOT. How can I help you?", sender: 'bot' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const toggleChat = () => setIsOpen(!isOpen);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const [sessionId, setSessionId] = useState(null);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input.trim();
        setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await api.post('/api/chatbot/query', { 
                message: userMessage,
                session_id: sessionId
            });
            
            if (response.data.session_id) {
                setSessionId(response.data.session_id);
            }
            
            setMessages(prev => [...prev, { text: response.data.answer, sender: 'bot' }]);
        } catch (error) {
            console.error('Chatbot error:', error);
            setMessages(prev => [...prev, { 
                text: "Sorry, I couldn't connect to the server. Please try again later.", 
                sender: 'bot', 
                isError: true 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
            {isOpen ? (
                <div className="chatbot-window">
                    <div className="chatbot-header">
                        <div className="chatbot-header-info">
                            <div className="header-bot-icon">
                                <BotIcon />
                            </div>
                            <h3>DMS BOT</h3>
                        </div>
                        <button className="chatbot-close-btn" onClick={toggleChat}>
                            <MdClose />
                        </button>
                    </div>
                    <div className="chatbot-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`chat-message ${msg.sender}`}>
                                <div className={`message-bubble ${msg.isError ? 'error' : ''}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="chat-message bot">
                                <div className="message-bubble loading">
                                    <span className="dot"></span>
                                    <span className="dot"></span>
                                    <span className="dot"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form className="chatbot-input-form" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !input.trim()}>
                            <MdSend />
                        </button>
                    </form>
                </div>
            ) : (
                <button className="chatbot-toggle-btn" onClick={toggleChat}>
                    <BotIcon />
                </button>
            )}
        </div>
    );
};

export default ChatBot;
