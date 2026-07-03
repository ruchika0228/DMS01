import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import Globe from 'react-globe.gl';
import { mapUsers, fileTransfers } from '../../data/mapData';
import './UserGlobe.css';

const UserGlobe = ({ isDark = true }) => {
    const globeRef = useRef();
    const [selectedUserId, setSelectedUserId] = useState(null);

    // ─── Data Preparation ──────────────────────────────────────────────────────

    // Format arcs for react-globe.gl
    const arcsData = useMemo(() => {
        return fileTransfers.map(tx => {
            const sender = mapUsers.find(u => u.id === tx.senderId);
            const receiver = mapUsers.find(u => u.id === tx.receiverId);
            if (!sender || !receiver) return null;

            return {
                startLat: sender.lat,
                startLng: sender.lon,
                endLat: receiver.lat,
                endLng: receiver.lon,
                color: tx.color,
                name: tx.fileName,
                status: 'Active'
            };
        }).filter(Boolean);
    }, []);

    // Format HTML markers
    const duplicateKeys = useMemo(() => {
        const count = {};
        mapUsers.forEach(({ lat, lon }) => {
            const key = `${lat},${lon}`;
            count[key] = (count[key] || 0) + 1;
        });
        return new Set(Object.keys(count).filter((k) => count[k] > 1));
    }, []);

    const markerData = useMemo(() => {
        return mapUsers.map(user => {
            const key = `${user.lat},${user.lon}`;
            return {
                ...user,
                lat: user.lat,
                lng: user.lon,
                isDuplicate: duplicateKeys.has(key)
            };
        });
    }, [duplicateKeys]);

    // Format Geographic Labels
    const labelsData = useMemo(() => {
        const countries = [
            { lat: 20.5937, lng: 78.9629, text: 'INDIA', color: 'rgba(255,255,255,0.7)', size: 1.2 },
            { lat: 37.0902, lng: -95.7129, text: 'USA', color: 'rgba(255,255,255,0.5)', size: 0.8 },
            { lat: 35.8617, lng: 104.1954, text: 'CHINA', color: 'rgba(255,255,255,0.5)', size: 0.8 },
            { lat: 51.5074, lng: -0.1278, text: 'UK', color: 'rgba(255,255,255,0.5)', size: 0.8 },
            { lat: 35.6762, lng: 139.6503, text: 'JAPAN', color: 'rgba(255,255,255,0.5)', size: 0.8 },
        ];

        const cities = mapUsers.map(user => {
            // Extract city name if possible, or use a default list
            const cityName = user.name.includes('Delhi') ? 'New Delhi' :
                user.name.includes('Mumbai') ? 'Mumbai' :
                    user.name.includes('Bangalore') ? 'Bangalore' :
                        user.name.includes('Srinagar') ? 'Srinagar' : '';
            if (!cityName) return null;
            return {
                lat: user.lat,
                lng: user.lon,
                text: cityName,
                color: 'rgba(255,255,255,0.9)',
                size: 0.4,
                dotRadius: 0.1
            };
        }).filter(Boolean);

        return [...countries, ...cities];
    }, []);

    // ─── Interaction Handlers ──────────────────────────────────────────────────

    const handleZoomIn = () => {
        const pov = globeRef.current.pointOfView();
        globeRef.current.pointOfView({ ...pov, altitude: Math.max(0.1, pov.altitude - 0.5) }, 600);
    };

    const handleZoomOut = () => {
        const pov = globeRef.current.pointOfView();
        globeRef.current.pointOfView({ ...pov, altitude: Math.min(5, pov.altitude + 0.5) }, 600);
    };

    const handleMarkerClick = useCallback((marker) => {
        if (!globeRef.current) return;

        if (selectedUserId === marker.id) {
            // Re-clicked: Normalise (Reset view & Resume rotation)
            setSelectedUserId(null);
            globeRef.current.pointOfView({ lat: 21.7679, lng: 78.8718, altitude: 2.2 }, 1500);
            globeRef.current.controls().autoRotate = true;
        } else {
            // Clicked: Zoom to Exact Location & Stop rotation
            setSelectedUserId(marker.id);
            globeRef.current.pointOfView({ lat: marker.lat, lng: marker.lng, altitude: 0.25 }, 1500);
            globeRef.current.controls().autoRotate = false;
        }
    }, [selectedUserId]);

    // Initial View
    useEffect(() => {
        if (globeRef.current) {
            globeRef.current.pointOfView({ lat: 21.7679, lng: 78.8718, altitude: 2.2 }, 500);
            globeRef.current.controls().autoRotate = true;
            globeRef.current.controls().autoRotateSpeed = 0.5;
        }
    }, []);

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div className={`usermap-wrapper globe-container ${isDark ? 'dark-theme' : 'light-theme'}`}>
            <Globe
                ref={globeRef}
                globeImageUrl={isDark
                    ? "//unpkg.com/three-globe/example/img/earth-dark.jpg"
                    : "//unpkg.com/three-globe/example/img/earth-day.jpg"}
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundImageUrl={isDark ? "//unpkg.com/three-globe/example/img/night-sky.png" : null}
                backgroundColor={isDark ? "rgba(0,0,0,0)" : "#f8fafc"}

                // Arcs (Transfers)
                arcsData={arcsData}
                arcColor={'color'}
                arcDashLength={0.4}
                arcDashGap={0.2}
                arcDashAnimateTime={2500}
                arcStroke={0.5}
                arcAltitude={0.3}

                // HTML Markers (Users)
                htmlElementsData={markerData}
                htmlElement={(marker) => {
                    const color = marker.isDuplicate ? '#f59e0b' : '#6366f1';
                    const el = document.createElement('div');
                    el.className = 'custom-marker-wrapper';
                    el.innerHTML = `
                        <div class="glass-marker-container globe-marker">
                            <div class="glass-marker-circle" style="border-color: ${color}">
                                <span class="glass-marker-label" style="color: ${color}">${marker.label}</span>
                            </div>
                            <div class="glass-marker-stem" style="background: ${color}"></div>
                        </div>
                    `;
                    el.style.pointerEvents = 'auto';
                    el.style.cursor = 'pointer';
                    el.onclick = () => handleMarkerClick(marker);
                    return el;
                }}

                // Geographic Labels
                labelsData={labelsData}
                labelText="text"
                labelSize="size"
                labelColor={(l) => isDark ? l.color : "#1e293b"} // Dark text in light mode
                labelDotRadius="dotRadius"
                labelAltitude={0.015} // Slightly raised for visibility
                labelTransitionDuration={0} // Immediate visibility on load

                // Labels & Interactions
                htmlTransitionDuration={500}
            />

            {/* ── Custom Zoom Controls ── */}
            <div className="globe-zoom-controls">
                <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In">+</button>
                <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out">−</button>
            </div>

            {/* ── Ultra Premium Legend (Adapted) ── */}
            <div className="map-legend glass-premium globe-overlay">
                <div className="legend-header">
                    <span className="live-dot"></span>
                    <span className="legend-title">3D GLOBAL NETWORK</span>
                </div>
                <div className="legend-content">
                    <div className="legend-stats">
                        <div className="l-stat">
                            <span className="l-val">{mapUsers.length}</span>
                            <span className="l-lab">Nodes</span>
                        </div>
                        <div className="l-stat">
                            <span className="l-val">{fileTransfers.length}</span>
                            <span className="l-lab">Active Arcs</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserGlobe;
