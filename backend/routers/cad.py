from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, Response
import os
import io
import struct
import re
import tempfile
import subprocess
import shutil
import hashlib
import numpy as np
import ezdxf
from ezdxf import recover
from ezdxf import disassemble
from ezdxf.addons.drawing import Frontend, RenderContext, layout as ez_layout
from ezdxf.addons.drawing.svg import SVGBackend
from ezdxf.addons.drawing.config import Configuration, BackgroundPolicy, ColorPolicy
import xml.etree.ElementTree as ET
import traceback
import json

def log_error(msg):
    with open("cad_error.log", "a") as f:
        f.write(msg + "\n")

router = APIRouter(
    prefix="/cad",
    tags=["cad"]
)

# Use absolute paths relative to this file
ROUTER_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(ROUTER_DIR)
CACHE_DIR = os.path.join(BACKEND_DIR, "_cache")
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

PROPRIETARY_EXT = {
    '.sldprt', '.sldasm',  # SolidWorks
    '.catpart',            # CATIA
    '.prt',                # NX / ProE
    '.ipt',                # Inventor
    '.f3d',                # Fusion 360
    '.x_t', '.x_b'         # Parasolid
}

# Helper to find dwg2dxf
def get_dwg2dxf_path():
    # Check common locations and PATH
    path = shutil.which("dwg2dxf")
    if path:
        return path
    
    standard_locs = ["/usr/local/bin/dwg2dxf", "/usr/bin/dwg2dxf"]
    for loc in standard_locs:
        if os.path.exists(loc):
            return loc
    return None

def _get_cache_path(file_bytes, extension):
    hasher = hashlib.md5()
    hasher.update(file_bytes)
    return os.path.join(CACHE_DIR, f"{hasher.hexdigest()}{extension}")

def _freecad_convert(input_path, output_path):
    """
    Use freecadcmd to convert proprietary formats to STL.
    """
    fc_script = f"""
import FreeCAD
import Part
import Mesh
import sys

try:
    doc = FreeCAD.newDocument("ConversionDoc")
    # Part.insert is often more robust for various formats in FreeCAD
    Part.insert("{input_path}", doc.Name)
    objs = doc.Objects
    if not objs:
        print("No objects found in file")
        sys.exit(1)
    
    Mesh.export(objs, "{output_path}")
    sys.exit(0)
except Exception as e:
    print(f"FreeCAD Error: {{e}}")
    sys.exit(1)
"""
    with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w") as f:
        f.write(fc_script)
        script_path = f.name
    
    try:
        # We use freecadcmd -c to run the script
        result = subprocess.run(["freecadcmd", "-c", script_path], capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            log_error(f"FreeCAD Conversion Failed: {result.stderr}")
        return result.returncode == 0
    except Exception as e:
        log_error(f"Subprocess Error calling FreeCAD: {str(e)}")
        return False
    finally:
        if os.path.exists(script_path):
            os.unlink(script_path)

# ─────────────────────────────────────────────────────────────────────────────
#  EXISTING ENDPOINT: DXF/DWG → SVG (kept for backward compat)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/convert")
async def convert_cad_to_svg(file: UploadFile = File(...)):
    filename = file.filename.lower()
    if not (filename.endswith(".dwg") or filename.endswith(".dxf")):
        raise HTTPException(status_code=400, detail="Only .dwg and .dxf files are supported")

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = os.path.join(tmpdir, file.filename)
            with open(input_path, "wb") as f:
                f.write(await file.read())

            dxf_path = input_path

            if filename.endswith(".dwg"):
                dwg2dxf = get_dwg2dxf_path() or "/usr/local/bin/dwg2dxf"
                try:
                    # Ensure /usr/local/lib is in LD_LIBRARY_PATH for libredwg.so.0
                    env = os.environ.copy()
                    env["LD_LIBRARY_PATH"] = "/usr/local/lib:" + env.get("LD_LIBRARY_PATH", "")
                    
                    # Create a temporary DXF path
                    temp_dxf = os.path.join(tmpdir, "converted.dxf")
                    
                    # Use the simplified command from main12.py: dwg2dxf -y -o output.dxf input.dwg
                    subprocess.run([dwg2dxf, "-y", "-o", temp_dxf, input_path], 
                                   check=True, capture_output=True, timeout=30, env=env)
                    dxf_path = temp_dxf
                except Exception as e:
                    log_error(f"DWG2DXF Error: {e}")
                    raise HTTPException(status_code=500, detail="DWG to DXF conversion failed. Ensure dwg2dxf is installed.")

            try:
                doc, auditor = recover.readfile(dxf_path)
            except Exception as e:
                log_error(f"Failed to read DXF file: {str(e)}\n{traceback.format_exc()}")
                raise HTTPException(status_code=500, detail=f"Failed to read DXF file: {str(e)}")

            msp = doc.modelspace()
            layout = msp
            if not len(msp):
                for layout_name in doc.layouts.names_in_taborder():
                    if layout_name.lower() != "model":
                        psp = doc.layout(layout_name)
                        if len(psp):
                            layout = psp
                            break

            config = Configuration(
                background_policy=BackgroundPolicy.CUSTOM,
                custom_bg_color="#FFFFFF",
                color_policy=ColorPolicy.BLACK,
            )

            ctx = RenderContext(doc)
            backend = SVGBackend()
            frontend = Frontend(ctx, backend, config=config)

            try:
                frontend.draw_layout(layout)
            except Exception as e:
                log_error(f"Failed to draw layout: {str(e)}\n{traceback.format_exc()}")
                raise HTTPException(status_code=500, detail=f"Failed to draw layout: {str(e)}")

            try:
                page = ez_layout.Page.from_dxf_layout(layout)
                xml_root = backend.get_xml_root_element(page)
                xml_root.set("width", "100%")
                xml_root.set("height", "auto")
                svg_string = ET.tostring(xml_root, encoding="unicode")
            except Exception as e:
                import re as _re
                page = ez_layout.Page.from_dxf_layout(layout)
                svg_string = backend.get_string(page)
                svg_string = _re.sub(r'width="[^"]+"', 'width="100%"', svg_string, count=1)
                svg_string = _re.sub(r'height="[^"]+"', 'height="auto"', svg_string, count=1)

            return HTMLResponse(content=svg_string)
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Top level error in conversion: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: DXF/DWG → 3D Line Segments JSON
# ─────────────────────────────────────────────────────────────────────────────

def _dxf_file_to_segments(dxf_path: str) -> list:
    """
    Parse a DXF file into 3D line segments for Three.js wireframe rendering.
    Returns list of [x1,y1,z1,x2,y2,z2] segments, centered at origin.
    """
    try:
        doc = ezdxf.readfile(dxf_path)
    except Exception:
        doc, _ = recover.readfile(dxf_path)

    msp = doc.modelspace()
    primitives = disassemble.to_primitives(disassemble.recursive_decompose(msp))

    segments = []
    all_points = []

    for p in primitives:
        try:
            v_list = list(p.vertices())
            if len(v_list) < 2:
                continue
            for i in range(len(v_list) - 1):
                p1, p2 = v_list[i], v_list[i + 1]
                segments.append([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z])
                all_points.append([p1.x, p1.y, p1.z])
                all_points.append([p2.x, p2.y, p2.z])
        except Exception:
            continue

    if not segments:
        return []

    pts = np.array(all_points)
    min_b = pts.min(axis=0)
    max_b = pts.max(axis=0)
    center = (min_b + max_b) / 2.0

    final_segments = []
    for s in segments:
        final_segments.append([
            s[0] - center[0], s[1] - center[1], s[2] - center[2],
            s[3] - center[0], s[4] - center[1], s[5] - center[2]
        ])

    return final_segments


@router.post("/dxf-segments")
async def dxf_to_3d_segments(file: UploadFile = File(...)):
    """
    Accept a DXF or DWG file and return 3D line segments for Three.js wireframe.
    Returns: JSON array of [x1, y1, z1, x2, y2, z2] segments.
    """
    print(f"[CAD] Processing 3D segments for: {file.filename}")
    filename = file.filename.lower()
    if not (filename.endswith(".dwg") or filename.endswith(".dxf")):
        raise HTTPException(status_code=400, detail="Only .dwg and .dxf files are supported")

    file_bytes = await file.read()

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = os.path.join(tmpdir, file.filename)
            with open(input_path, "wb") as f:
                f.write(file_bytes)

            dxf_path = input_path

            # Convert DWG → DXF first with caching
            if filename.endswith(".dwg"):
                # Use a content-based cache path
                hasher = hashlib.md5()
                hasher.update(file_bytes)
                cache_path = os.path.join(CACHE_DIR, f"{hasher.hexdigest()}.dxf")
                
                if os.path.exists(cache_path):
                    dxf_path = cache_path
                else:
                    dwg2dxf = get_dwg2dxf_path() or "/usr/local/bin/dwg2dxf"
                    try:
                        # Ensure /usr/local/lib is in LD_LIBRARY_PATH for libredwg.so.0
                        env = os.environ.copy()
                        env["LD_LIBRARY_PATH"] = "/usr/local/lib:" + env.get("LD_LIBRARY_PATH", "")
                        
                        # Use the simplified command from main12.py: dwg2dxf -y -o output.dxf input.dwg
                        subprocess.run([dwg2dxf, "-y", "-o", cache_path, input_path], 
                                       check=True, capture_output=True, timeout=30, env=env)
                        dxf_path = cache_path
                    except Exception as e:
                        log_error(f"DWG2DXF Error: {e}")
                        raise HTTPException(status_code=500, detail="DWG to DXF conversion failed. Ensure dwg2dxf is installed.")

            segments = _dxf_file_to_segments(dxf_path)
            return segments

    except HTTPException:
        raise
    except Exception as e:
        log_error(f"dxf-segments error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to extract 3D segments: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: STL passthrough
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/stl-data")
async def serve_stl(file: UploadFile = File(...)):
    """
    Accept an STL file and return its raw bytes for Three.js STL parsing.
    """
    filename = file.filename.lower()
    if not filename.endswith(".stl"):
        raise HTTPException(status_code=400, detail="Only .stl files are supported")

    data = await file.read()
    return Response(content=data, media_type="application/octet-stream")


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: STEP / IGES → STL conversion
# ─────────────────────────────────────────────────────────────────────────────

def _step_iges_to_stl_bytes(filepath: str, filename_lower: str) -> bytes:
    """Convert STEP or IGES to STL bytes using trimesh (or convex hull fallback)."""
    # Try cadquery first (if installed)
    try:
        import cadquery as cq
        if filename_lower.endswith(('.step', '.stp')):
            res = cq.importers.importStep(filepath)
        else:
            res = cq.importers.importIges(filepath)
        with tempfile.NamedTemporaryFile(suffix='.stl', delete=False) as tmp:
            tmp_name = tmp.name
        cq.exporters.export(res, tmp_name)
        with open(tmp_name, 'rb') as f:
            data = f.read()
        os.unlink(tmp_name)
        return data
    except Exception:
        pass

    # Try trimesh
    try:
        import trimesh
        m = trimesh.load(filepath, force='mesh')
        if hasattr(m, 'geometry'):
            m = trimesh.util.concatenate(list(m.geometry.values()))
        buf = io.BytesIO()
        m.export(buf, file_type='stl')
        return buf.getvalue()
    except Exception:
        pass

    # Convex hull fallback (pure numpy)
    return _convex_hull_stl(filepath)


def _convex_hull_stl(filepath: str) -> bytes:
    from scipy.spatial import ConvexHull
    with open(filepath, 'r', errors='replace') as f:
        text = f.read()
    pt_re = re.compile(
        r'CARTESIAN_POINT\s*\([^,;]*,\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)',
        re.IGNORECASE
    )
    pts = [(float(m.group(1)), float(m.group(2)), float(m.group(3))) for m in pt_re.finditer(text)]
    if len(pts) < 4:
        raise ValueError("Insufficient geometry points found in file")
    arr = np.unique(np.array(pts, dtype=np.float64), axis=0)
    hull = ConvexHull(arr)
    tris = arr[hull.simplices]
    buf = io.BytesIO()
    buf.write(b'CAD Fallback STL' + b'\x00' * 64)
    buf.write(struct.pack('<I', len(tris)))
    for v in tris:
        n = np.cross(v[1] - v[0], v[2] - v[0])
        nl = np.linalg.norm(n)
        if nl > 1e-10:
            n /= nl
        buf.write(struct.pack('<fff', *n))
        for vertex in v:
            buf.write(struct.pack('<fff', *vertex))
        buf.write(b'\x00\x00')
    return buf.getvalue()


@router.post("/step-to-stl")
async def step_iges_to_stl(file: UploadFile = File(...)):
    """
    Accept a STEP/IGES or proprietary (SolidWorks, etc.) file and return STL bytes.
    Uses caching to avoid re-converting the same file.
    """
    filename = file.filename.lower()
    ext = os.path.splitext(filename)[1]
    
    supported_standard = ('.step', '.stp', '.iges', '.igs')
    is_proprietary = ext in PROPRIETARY_EXT
    
    if not (ext in supported_standard or is_proprietary):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported format: {ext}. Supported: STEP, IGES, SolidWorks, CATIA, NX, Inventor, Fusion360, Parasolid"
        )

    file_bytes = await file.read()
    
    # Check Cache first
    cache_path = _get_cache_path(file_bytes, ".stl")
    if os.path.exists(cache_path):
        with open(cache_path, 'rb') as f:
            return Response(content=f.read(), media_type="application/octet-stream")

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = os.path.join(tmpdir, file.filename)
            with open(input_path, "wb") as f:
                f.write(file_bytes)

            if is_proprietary:
                # Use FreeCAD for proprietary formats
                success = _freecad_convert(input_path, cache_path)
                if not success:
                    raise HTTPException(
                        status_code=500, 
                        detail="FreeCAD conversion failed. Ensure FreeCAD is installed on the server and the file is valid."
                    )
            else:
                # Use standard logic for STEP/IGES (cadquery/trimesh)
                stl_bytes = _step_iges_to_stl_bytes(input_path, filename)
                with open(cache_path, "wb") as f:
                    f.write(stl_bytes)

            with open(cache_path, "rb") as f:
                return Response(content=f.read(), media_type="application/octet-stream")

    except HTTPException:
        raise
    except Exception as e:
        log_error(f"step-to-stl error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
