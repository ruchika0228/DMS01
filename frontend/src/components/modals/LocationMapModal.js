import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LocationMapModal.css';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Create a custom red icon for the exact location
const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const ChangeView = ({ center }) => {
    const map = useMap();
    // Using a very high zoom level (19) for "exact building" identification
    map.setView(center, 19); 
    return null;
};

const LocationMapModal = ({ isOpen, onClose, lat, lng, address, title }) => {
    if (!isOpen) return null;

    const position = [parseFloat(lat), parseFloat(lng)];
    const isValid = !isNaN(position[0]) && !isNaN(position[1]) && position[0] !== 0;

    return (
        <div className="location-modal-overlay" onClick={onClose}>
            <div className="location-modal-content glass-card" onClick={e => e.stopPropagation()}>
                <div className="location-modal-header">
                    <h3>{title || 'Document Location'}</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="location-modal-body">
                    {isValid ? (
                        <div className="map-wrapper">
                            <MapContainer 
                                center={position} 
                                zoom={19} 
                                style={{ height: '450px', width: '100%', borderRadius: '16px' }}
                                scrollWheelZoom={true}
                            >
                                <ChangeView center={position} />
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
                                <Marker position={position} icon={redIcon}>
                                    <Popup minWidth={200}>
                                        <div className="marker-popup-content">
                                            <strong style={{ color: '#ef4444' }}>EXACT LOCATION</strong><br />
                                            <div style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                                                {address || 'Address Resolving...'}
                                            </div>
                                            <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#666' }}>
                                                {lat}, {lng}
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            </MapContainer>
                            <div className="location-details enhanced">
                                <div className="detail-row">
                                    <span className="detail-label">Identified Address</span>
                                    <span className="detail-value">{address || 'Searching for building name...'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">GPS Coordinates</span>
                                    <span className="detail-value">{lat}, {lng}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="invalid-location">
                            <div className="error-icon">📍?</div>
                            <p>No valid GPS coordinates found for this entry.</p>
                        </div>
                    )}
                </div>
                <div className="location-modal-footer">
                    <button className="secondary-button" onClick={onClose}>Close View</button>
                    {isValid && (
                        <a 
                            href={`https://www.google.com/maps?q=${lat},${lng}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="primary-button-link"
                        >
                            Open in Google Maps
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LocationMapModal;
