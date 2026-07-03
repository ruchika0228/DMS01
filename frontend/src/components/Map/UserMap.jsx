import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Tooltip,
    Polyline,
    useMap,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { mapUsers, fileTransfers } from '../../data/mapData';
import './UserMap.css';

// ─── Fix webpack icon paths ────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── Animation Helpers ──────────────────────────────────────────────────────

/**
 * Calculates a quadratic Bezier curve between two points with a vertical offset
 * to create a 3D arc effect.
 */
const getBezierPoints = (start, end, pointsCount = 50) => {
    const points = [];

    // Midpoint with a lateral/vertical offset to create the arc
    const midLat = (start.lat + end.lat) / 2;
    const midLon = (start.lon + end.lon) / 2;

    // Calculate offset based on distance to keep arcs looking consistent
    const dist = Math.sqrt(Math.pow(end.lat - start.lat, 2) + Math.pow(end.lon - start.lon, 2));
    const offset = dist * 0.25;

    // Control point for quadratic Bezier
    const cp = {
        lat: midLat + offset,
        lon: midLon + (offset * 0.3)
    };

    for (let i = 0; i <= pointsCount; i++) {
        const t = i / pointsCount;
        // Quadratic Bezier formula: (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const lat = Math.pow(1 - t, 2) * start.lat + 2 * (1 - t) * t * cp.lat + Math.pow(t, 2) * end.lat;
        const lon = Math.pow(1 - t, 2) * start.lon + 2 * (1 - t) * t * cp.lon + Math.pow(t, 2) * end.lon;
        points.push([lat, lon]);
    }
    return points;
};

// ─── Markers & Data Helpers ──────────────────────────────────────────────────
const getDuplicateKeys = (data) => {
    const count = {};
    data.forEach(({ lat, lon }) => {
        const key = `${lat},${lon}`;
        count[key] = (count[key] || 0) + 1;
    });
    return new Set(Object.keys(count).filter((k) => count[k] > 1));
};

const getUserById = (id) => mapUsers.find((u) => u.id === id);

// ─── Custom marker icon ──────────────────────────────────────────────────────
const createCustomIcon = (user, isDuplicate) => {
    const color = isDuplicate ? '#f59e0b' : '#6366f1';

    // Glassmorphic HTML icon
    const html = `
    <div class="glass-marker-container">
      <div class="glass-marker-circle" style="border-color: ${color}">
        <span class="glass-marker-label" style="color: ${color}">${user.label}</span>
      </div>
      <div class="glass-marker-stem" style="background: ${color}"></div>
    </div>`;

    return L.divIcon({
        className: 'custom-map-icon-glass',
        html: html,
        iconSize: [40, 52],
        iconAnchor: [20, 52],
        popupAnchor: [0, -54],
    });
};

// ─── Custom cluster icon ─────────────────────────────────────────────────────
const createClusterCustomIcon = (cluster) => {
    const count = cluster.getChildCount();
    const label = `${count} User${count > 1 ? 's' : ''}`;
    const size = count > 4 ? 60 : count > 2 ? 52 : 46;
    return L.divIcon({
        html: `<div class="cluster-icon glass-cluster" style="width:${size}px;height:${size}px;">
             <span class="cluster-label">${label}</span>
           </div>`,
        className: 'custom-cluster-icon',
        iconSize: L.point(size, size, true),
    });
};

// ─── Premium Tile Switching ─────────────────────────────────────────────────
const TileLayerSwitcher = ({ isDark }) => (
    <TileLayer
        url={
            isDark
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_all/{z}/{x}/{y}{r}.png'
        }
        attribution={
            isDark
                ? '&copy; <a href="https://carto.com/attributions">CARTO</a>'
                : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }
        noWrap={true}
        bounds={[[-90, -180], [90, 180]]}
    />
);

// ─── Particle Flow Component ────────────────────────────────────────────────
/**
 * Renders a trail of particles (glowing dots) moving along the curved path.
 */
const ParticleTrail = ({ path, color }) => {
    const map = useMap();
    const markersRef = useRef([]);
    const rafRef = useRef(null);
    const DURATION = 3200; // Slightly faster for precision feel
    const PARTICLE_COUNT = 5; // More particles for a smoother trail
    const OFFSET_DELAY = 200; // Tighter delay
    const startRef = useRef(null);

    const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const animate = useCallback(
        (ts) => {
            if (!startRef.current) startRef.current = ts;
            const elapsed = ts - startRef.current;

            markersRef.current.forEach((marker, index) => {
                if (!marker) return;

                // Calculate t for this specific particle with a delay
                const tRaw = ((elapsed - (index * OFFSET_DELAY)) % DURATION) / DURATION;
                const t = easeInOut(Math.max(0, tRaw));

                // Find the index in our pre-calculated path points
                const pointIdx = Math.floor(t * (path.length - 1));
                const [lat, lon] = path[pointIdx];

                marker.setLatLng([lat, lon]);
                // Fade particles at the end of the line
                marker.getElement().style.opacity = t < 0.05 || t > 0.95 ? 0 : 1;
                // Scale trail based on position in sequence
                marker.getElement().style.transform = `scale(${1 - (index * 0.15)})`;
            });

            rafRef.current = requestAnimationFrame(animate);
        },
        [path, DURATION, OFFSET_DELAY]
    );

    useEffect(() => {
        const particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const icon = L.divIcon({
                className: 'packet-icon',
                html: `<div class="packet-dot particle" style="background:${color};box-shadow:0 0 12px ${color};"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            });

            const marker = L.marker(path[0], {
                icon,
                interactive: false,
                zIndexOffset: 1000
            }).addTo(map);

            particles.push(marker);
        }

        markersRef.current = particles;
        rafRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(rafRef.current);
            particles.forEach(m => m.remove());
        };
    }, [map, path, color, animate]);

    return null;
};

// ─── Transfer Component (Curved) ─────────────────────────────────────────────
const TransferLine = ({ transfer }) => {
    const sender = getUserById(transfer.senderId);
    const receiver = getUserById(transfer.receiverId);

    // Path is pre-calculated quadratic Bezier
    const path = useMemo(() => {
        if (!sender || !receiver) return [];
        return getBezierPoints(
            { lat: sender.lat, lon: sender.lon },
            { lat: receiver.lat, lon: receiver.lon }
        );
    }, [sender, receiver]);

    if (!sender || !receiver) return null;

    const isSameLocation =
        sender.lat === receiver.lat && sender.lon === receiver.lon;

    return (
        <>
            {/* Outer subtle arc glow */}
            <Polyline
                positions={path}
                pathOptions={{
                    color: transfer.color,
                    weight: 7,
                    opacity: 0.12,
                }}
            />
            {/* Animated dashed arc */}
            <Polyline
                positions={path}
                pathOptions={{
                    color: transfer.color,
                    weight: 2.5,
                    opacity: 0.8,
                    dashArray: '12 10',
                    className: 'transfer-line-animated',
                }}
            >
                <Tooltip sticky direction="center" opacity={0.9} className="transfer-tooltip glass-tooltip">
                    <div className="transfer-tooltip-inner">
                        <span className="tt-icon">⚡</span>
                        <div>
                            <div className="tt-file">{transfer.fileName}</div>
                            <div className="tt-meta">
                                {sender.name.split(' (')[0]} <span className="arrow">→</span> {receiver.name.split(' (')[0]}
                            </div>
                        </div>
                    </div>
                </Tooltip>
            </Polyline>

            {/* Particle flow - skip for same-location */}
            {!isSameLocation && (
                <ParticleTrail path={path} color={transfer.color} />
            )}
        </>
    );
};

// ─── Map initializer for smooth initial view ───────────────────────────────
const MapInitializer = () => {
    const map = useMap();
    useEffect(() => {
        const bounds = L.latLngBounds(mapUsers.map(u => [u.lat, u.lon]));
        map.flyToBounds(bounds, { padding: [80, 80], duration: 1.8 });
    }, [map]);
    return null;
};

// ─── Main component ──────────────────────────────────────────────────────────
const UserMap = ({ isDark = true }) => {
    const [selectedUserId, setSelectedUserId] = useState(null);
    const mapRef = useRef(null);
    const duplicateKeys = useMemo(() => getDuplicateKeys(mapUsers), []);

    const handleMarkerClick = (userId, lat, lon, mapInstance) => {
        if (!mapInstance) return;

        if (selectedUserId === userId) {
            // Re-clicked: Normalise zoom
            setSelectedUserId(null);
            const bounds = L.latLngBounds(mapUsers.map(u => [u.lat, u.lon]));
            mapInstance.flyToBounds(bounds, { padding: [80, 80], duration: 1.5 });
        } else {
            // Clicked: Zoom to exact location
            setSelectedUserId(userId);
            mapInstance.flyTo([lat, lon], 18, { // Zoom Level 18 for "exact location"
                duration: 2.0,
                easeLinearity: 0.25
            });
        }
    };

    return (
        <div className="usermap-wrapper">
            <MapContainer
                center={[22.9734, 78.6569]}
                zoom={5}
                minZoom={2.5}
                maxBounds={[[-90, -180], [90, 180]]}
                maxBoundsViscosity={1.0}
                className="leaflet-map-container ultra-premium"
                zoomAnimation
                markerZoomAnimation
                ref={mapRef}
                worldCopyJump={false}
            >
                <MapInitializer />
                <TileLayerSwitcher isDark={isDark} />

                {fileTransfers.map((tx) => (
                    <TransferLine key={tx.id} transfer={tx} />
                ))}

                <MarkerClusterGroup
                    chunkedLoading
                    iconCreateFunction={createClusterCustomIcon}
                    spiderfyOnMaxZoom
                    showCoverageOnHover={false}
                    zoomToBoundsOnClick
                    maxClusterRadius={60}
                    animate
                    animateAddingMarkers
                    spiderfyDistanceMultiplier={2}
                >
                    {mapUsers.map((user) => {
                        const key = `${user.lat},${user.lon}`;
                        const isDuplicate = duplicateKeys.has(key);
                        const icon = createCustomIcon(user, isDuplicate);

                        return (
                            <Marker
                                key={user.id}
                                position={[user.lat, user.lon]}
                                icon={icon}
                                eventHandlers={{
                                    click: (e) => {
                                        handleMarkerClick(user.id, user.lat, user.lon, e.target._map);
                                    }
                                }}
                            >
                                <Tooltip direction="top" offset={[0, -54]} opacity={0.95} className="modern-marker-tooltip">
                                    <span className="map-tooltip">{user.name}</span>
                                </Tooltip>
                                <Popup className="map-popup premium-popup" maxWidth={280} minWidth={220}>
                                    <div className="popup-content">
                                        <div className="popup-header enhanced">
                                            <div className="popup-avatar-label-new">{user.label}</div>
                                            <div>
                                                <div className="popup-title">{user.name}</div>
                                                <div className="popup-role-new">{user.role} &middot; {user.department}</div>
                                            </div>
                                        </div>
                                        <div className="popup-body">
                                            <div className="popup-grid">
                                                <div className="popup-stat">
                                                    <span className="stat-label">LAT</span>
                                                    <span className="stat-val">{user.lat.toFixed(6)}</span>
                                                </div>
                                                <div className="popup-stat">
                                                    <span className="stat-label">LON</span>
                                                    <span className="stat-val">{user.lon.toFixed(6)}</span>
                                                </div>
                                            </div>
                                            <div className="popup-status-row">
                                                <span className="popup-key">Signal Level</span>
                                                <div className="signal-bars">
                                                    <div className="bar full"></div>
                                                    <div className="bar full"></div>
                                                    <div className="bar full"></div>
                                                    <div className="bar"></div>
                                                </div>
                                            </div>
                                            <div className="popup-row last">
                                                <span className="popup-key">Verification</span>
                                                <span className="popup-val status-active">
                                                    <span className="status-dot pulsed" /> Secure
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MarkerClusterGroup>
            </MapContainer>

        </div>
    );
};

export default UserMap;
