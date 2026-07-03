import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import api from '../../api/axios';
import './CADIsometricViewer.css';

/**
 * CAD Isometric Viewer — Three.js powered 3D viewer for DXF/DWG/STL/STEP/STP/IGES/IGS
 * 
 * - DXF / DWG  → wireframe via /cad/dxf-segments (3D line segments JSON)
 * - STL        → solid mesh parsed directly from blob URL
 * - STEP/STP/IGES/IGS → /cad/step-to-stl → STL blob → solid mesh
 */
const CADIsometricViewer = ({ file, url }) => {
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const currentObjectRef = useRef(null);
    const animFrameRef = useRef(null);

    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
    const [errorMsg, setErrorMsg] = useState('');
    const [wireframe, setWireframe] = useState(false);

    const fileName = file?.file_name || file?.name || '';
    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

    // ── Initialize Three.js scene ─────────────────
    useEffect(() => {
        if (!mountRef.current) return;

        const container = mountRef.current;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0d1117);
        sceneRef.current = scene;

        // Orthographic camera (true isometric)
        const w = container.clientWidth;
        const h = container.clientHeight;
        const aspect = w / h;
        const camera = new THREE.OrthographicCamera(
            -100 * aspect, 100 * aspect, 100, -100, 0.1, 100000
        );
        camera.position.set(200, 200, 200);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Orbit controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controlsRef.current = controls;

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(1000, 1000, 1000);
        scene.add(sun);

        // Grid & axes
        const grid = new THREE.GridHelper(1000, 40, 0x30363d, 0x1c2128);
        scene.add(grid);
        scene.add(new THREE.AxesHelper(100));

        // Resize handler
        const handleResize = () => {
            if (!container) return;
            const nw = container.clientWidth;
            const nh = container.clientHeight;
            renderer.setSize(nw, nh);
            const na = nw / nh;
            camera.left = -100 * na;
            camera.right = 100 * na;
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', handleResize);

        // Animation loop
        const animate = () => {
            animFrameRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(animFrameRef.current);
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Load CAD data once scene is ready and we have a URL ───────────────
    useEffect(() => {
        if (!url || !sceneRef.current) return;
        loadCADFile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, fileExt]);

    const loadCADFile = async () => {
        setStatus('loading');
        setErrorMsg('');

        try {
            const proprietaryExts = ['sldprt', 'sldasm', 'catpart', 'prt', 'ipt', 'f3d', 'x_t', 'x_b'];
            if (['dxf', 'dwg'].includes(fileExt)) {
                await loadDXF();
            } else if (fileExt === 'stl') {
                await loadSTL(url);
            } else if (['step', 'stp', 'iges', 'igs'].includes(fileExt) || proprietaryExts.includes(fileExt)) {
                await loadSTEP();
            } else {
                setErrorMsg(`Unsupported CAD format: .${fileExt}`);
                setStatus('error');
            }
        } catch (err) {
            console.error('CAD load error', err);
            setErrorMsg(err.message || 'Failed to load CAD file.');
            setStatus('error');
        }
    };

    // ── DXF / DWG ─────────────────────────────────────────────────────────
    const loadDXF = async () => {
        // Fetch the blob from the download URL and POST to /cad/dxf-segments
        const fetchRes = await fetch(url);
        if (!fetchRes.ok) throw new Error('Failed to fetch CAD file from storage.');
        const blob = await fetchRes.blob();

        const formData = new FormData();
        formData.append('file', blob, fileName);

        const result = await api.post('/cad/dxf-segments', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        const segments = result.data;
        if (!segments || segments.length === 0) {
            throw new Error('No geometry found in DXF file.');
        }

        const points = [];
        segments.forEach(s => {
            points.push(new THREE.Vector3(s[0], s[1], s[2]));
            points.push(new THREE.Vector3(s[3], s[4], s[5]));
        });

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        geo.center();
        const mat = new THREE.LineBasicMaterial({ color: 0x58a6ff });
        const obj = new THREE.LineSegments(geo, mat);

        addObjectToScene(obj);
        setStatus('ready');
    };

    // ── STL (direct blob parse) ───────────────────────────────────────────
    const loadSTL = async (stlUrl) => {
        const response = await fetch(stlUrl);
        if (!response.ok) throw new Error('Failed to fetch STL file.');
        const buffer = await response.arrayBuffer();

        const geo = parseSTL(buffer);
        geo.center();

        const mat = new THREE.MeshPhongMaterial({
            color: 0x47a1ff,
            flatShading: true,
            side: THREE.DoubleSide,
        });
        const obj = new THREE.Mesh(geo, mat);

        addObjectToScene(obj);
        setStatus('ready');
    };

    // ── STEP / STP / IGES / IGS ───────────────────────────────────────────
    const loadSTEP = async () => {
        const fetchRes = await fetch(url);
        if (!fetchRes.ok) throw new Error('Failed to fetch CAD file from storage.');
        const blob = await fetchRes.blob();

        const formData = new FormData();
        formData.append('file', blob, fileName);

        const result = await api.post('/cad/step-to-stl', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            responseType: 'arraybuffer',
        });

        const geo = parseSTL(result.data);
        geo.center();

        const mat = new THREE.MeshPhongMaterial({
            color: 0x47a1ff,
            flatShading: true,
            side: THREE.DoubleSide,
        });
        const obj = new THREE.Mesh(geo, mat);

        addObjectToScene(obj);
        setStatus('ready');
    };

    // ── Helpers ────────────────────────────────────────────────────────────
    const parseSTL = (data) => {
        const dv = new DataView(data);
        const isBin =
            data.byteLength > 80 &&
            dv.getUint32(80, true) * 50 + 84 === data.byteLength;

        if (isBin) {
            const n = dv.getUint32(80, true);
            const pos = new Float32Array(n * 9);
            for (let i = 0; i < n; i++) {
                const b = 84 + i * 50;
                for (let j = 0; j < 3; j++) {
                    const v = b + 12 + j * 12;
                    pos[i * 9 + j * 3] = dv.getFloat32(v, true);
                    pos[i * 9 + j * 3 + 1] = dv.getFloat32(v + 4, true);
                    pos[i * 9 + j * 3 + 2] = dv.getFloat32(v + 8, true);
                }
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.computeVertexNormals();
            return g;
        } else {
            const text = new TextDecoder().decode(data);
            const pts = [];
            text.split('\n').forEach(l => {
                const p = l.trim().split(/\s+/);
                if (p[0] === 'vertex') {
                    pts.push(parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3]));
                }
            });
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
            g.computeVertexNormals();
            return g;
        }
    };

    const addObjectToScene = (obj) => {
        const scene = sceneRef.current;
        if (currentObjectRef.current) {
            scene.remove(currentObjectRef.current);
        }
        scene.add(obj);
        currentObjectRef.current = obj;
        fitAll();
    };

    // ── Camera Controls ────────────────────────────────────────────────────
    const setView = (type) => {
        const obj = currentObjectRef.current;
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!obj || !camera || !controls) return;

        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        
        // Use a distance proportional to model size as in main12.py
        const d = Math.max(size.x, size.y, size.z) * 2 || 200;

        controls.reset();
        
        if (type === 'iso') {
            camera.position.set(d, d, d);
        } else if (type === 'top') {
            camera.position.set(0, d, 0);
        } else if (type === 'front') {
            camera.position.set(0, 0, d);
        } else if (type === 'side') {
            camera.position.set(d, 0, 0);
        }

        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    };

    const fitAll = () => {
        const obj = currentObjectRef.current;
        const camera = cameraRef.current;
        if (!obj || !camera) return;

        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Zoom logic from main12.py
        const zoom = 140 / (maxDim || 1);
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        
        setView('iso');
    };

    const toggleWireframe = () => {
        const obj = currentObjectRef.current;
        if (!obj) return;
        const next = !wireframe;
        obj.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.wireframe = next;
            }
        });
        setWireframe(next);
    };

    // ─────────────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="cad-iso-wrapper">
            {/* 3D canvas mount */}
            <div ref={mountRef} className="cad-iso-canvas" />

            {/* Loading overlay */}
            {status === 'loading' && (
                <div className="cad-iso-overlay">
                    <div className="cad-iso-spinner" />
                    <p>Preparing 3D CAD Preview…</p>
                </div>
            )}

            {/* Error state */}
            {status === 'error' && (
                <div className="cad-iso-overlay cad-iso-error">
                    <span className="cad-iso-error-icon">⚠</span>
                    <p className="cad-iso-error-title">CAD Preview Failed</p>
                    <p className="cad-iso-error-msg">{errorMsg}</p>
                    {url && (
                        <button className="cad-iso-btn" onClick={() => window.open(url)}>
                            ⬇ Download File
                        </button>
                    )}
                </div>
            )}

            {/* Toolbar (shown when ready or loading so user can see it) */}
            {status !== 'error' && (
                <div className="cad-iso-toolbar">
                    <div className="cad-iso-toolbar-group">
                        <button className="cad-iso-btn" onClick={() => setView('iso')}>Isometric</button>
                        <button className="cad-iso-btn" onClick={() => setView('top')}>Top</button>
                        <button className="cad-iso-btn" onClick={() => setView('front')}>Front</button>
                        <button className="cad-iso-btn" onClick={() => setView('side')}>Side</button>
                    </div>
                    <div className="cad-iso-toolbar-group">
                        <button className="cad-iso-btn" onClick={fitAll}>Fit All</button>
                        <button
                            className={`cad-iso-btn ${wireframe ? 'cad-iso-btn-active' : ''}`}
                            onClick={toggleWireframe}
                        >
                            Wireframe
                        </button>
                    </div>
                    <div className="cad-iso-toolbar-label">
                        📐 {fileName}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CADIsometricViewer;
