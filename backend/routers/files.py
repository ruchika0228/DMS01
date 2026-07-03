from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel as PydanticBaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from database import get_db
from models.user import User
from models.file import File, Transfer, FileSection, OCRResult
from models.connection import Connection, ConnectionStatus
import schemas
from schemas import (
    FileCreate, FileResponse, FileUploadResponse, TransferRequest, 
    TransferResponse, TransferSyncResponse, PaginatedResponse,
    RedactedRegisterRequest, RedactedRegisterResponse, OCRResultResponse
)
from routers.auth import get_current_user
from email_utils import send_email_async
from embeddings import generate_embedding
import uuid
import httpx
import ollama
import base64
import requests
from datetime import datetime
from models.block import Block
from .blockchain import calculate_block_hash
from typing import Optional, List
from geo import reverse_geocode, validate_jit_location

router = APIRouter(
    prefix="/files",
    tags=["files"]
)

# --- Helper Classes & Functions ---

class OcrIpfsRequest(PydanticBaseModel):
    cid: str
    file_id: str

def get_safe_lat(lat_str):
    if not lat_str:
        return "0"
    try:
        lat_val = float(lat_str)
        if abs(lat_val - 56.27914963667611) < 0.001:
            return "0"
    except ValueError:
        pass
    return str(lat_str)

def get_safe_lng(lng_str):
    if not lng_str:
        return "0"
    try:
        lng_val = float(lng_str)
        if abs(lng_val - 96.68093204498285) < 0.001:
            return "0"
    except ValueError:
        pass
    return str(lng_str)

def get_safe_addr(addr):
    return addr if addr else "Unknown Location"

async def auto_classify_document(text: str):
    """
    Uses Ollama to classify document based on OCR text.
    """
    if not text or len(text.strip()) < 10:
        return "Uncategorized"

    categories = ["Government", "Financial", "Medical", "Legal", "Technical", "Educational", "Personal"]
    prompt = f"""Analyze the following document text and classify it into EXACTLY ONE category from this list: {categories}.
If it's a government ID like Aadhar, Passport, or PAN, use 'Government'.
If it's an invoice, bill, or bank statement, use 'Financial'.
If it's a doctor's note or medical report, use 'Medical'.
If it's a contract or legal notice, use 'Legal'.
If it's a CAD drawing or technical spec, use 'Technical'.
If it's a degree, marksheet or certificate, use 'Educational'.

Respond with ONLY the category name. No other text.

Text: {text[:2000]}"""

    try:
        client = ollama.AsyncClient()
        response = await client.chat(
            model='llama3.2:1b',
            messages=[{'role': 'user', 'content': prompt}]
        )
        category = response['message']['content'].strip()
        # Clean up the response in case the AI added extra words
        for cat in categories:
            if cat.lower() in category.lower():
                return cat
        return "Uncategorized"
    except:
        return "Uncategorized"

def fetch_ipfs_content(cid: str, stream=True):
    """
    Robust IPFS fetcher that tries multiple gateways with proper timeout, 
    browser-like headers, and FORCED unverified SSL handling (due to system cert issues).
    """
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    # Priority Gateways: Local > High Performance Public > Standard Public
    gateways = [
        f"https://cloudflare-ipfs.com/ipfs/{cid}",
        f"https://ipfs.io/ipfs/{cid}",
        f"https://dweb.link/ipfs/{cid}",
        f"https://gateway.ipfs.io/ipfs/{cid}",
        f"https://cf-ipfs.com/ipfs/{cid}",
        f"https://nftstorage.link/ipfs/{cid}",
        f"http://127.0.0.1:8080/ipfs/{cid}",
        f"http://localhost:8080/ipfs/{cid}"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    
    errors = []
    for url in gateways:
        try:
            is_local = "127.0.0.1" in url or "localhost" in url
            timeout = 5 if is_local else 40 # Increased timeout for slow propagation
            
            # Use verify=False by default because system certs are broken
            response = requests.get(url, stream=stream, timeout=timeout, verify=False, headers=headers)
            response.raise_for_status()
            return response
        except Exception as e:
            errors.append(f"{url}: {str(e)}")
            continue
            
    # If we reached here, all gateways failed.
    detailed_error = " | ".join(errors)
    raise HTTPException(
        status_code=502, 
        detail=f"Failed to fetch file from IPFS after trying multiple gateways. Gateways tried: {detailed_error}"
    )

# --- OCR & Intelligence Endpoints (Must be above /{file_id}) ---

@router.get("/pending-ocr")
async def get_pending_ocr(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns a list of files owned by the user that don't have OCR results yet.
    """
    try:
        pending_files = db.query(File).filter(
            File.owner_id == current_user.id
        ).filter(
            ~db.query(OCRResult).filter(OCRResult.file_id == File.id).exists()
        ).all()
        return [
            {"id": str(f.id), "cid": f.cid, "file_name": f.file_name}
            for f in pending_files
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-ocr")
async def start_batch_ocr(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Placeholder for batch processing logic.
    """
    return {"message": "Batch process initiated."}

@router.post("/ocr-ipfs")
async def proxy_ocr_ipfs(
    req: OcrIpfsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Proxy endpoint: Forwards the OCR IPFS request to the remote OCR server.
    Implements full AI Analysis (Embeddings, ChromaDB, RAG, Categorization).
    """
    from ocr_logic import perform_ocr_request, process_ocr_and_ai
    
    try:
        f_id = uuid.UUID(req.file_id) if isinstance(req.file_id, str) else req.file_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    file_obj = db.query(File).filter(File.id == f_id).first()
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    # 1. Check Cache
    cached = db.query(OCRResult).filter(OCRResult.file_id == f_id).first()
    if cached and cached.extracted_text:
        return {
            "status": "complete",
            "results": [{
                "ocr_text": cached.extracted_text,
                "cached": True
            }]
        }

    # 2. Perform External OCR Request
    ocr_data = await perform_ocr_request(req.cid, str(f_id))
    
    if not ocr_data:
        raise HTTPException(
            status_code=502,
            detail="OCR Service Unreachable or failed. Please check server status."
        )

    # 3. Process OCR Text and AI Analysis (Embeddings, RAG, ChromaDB, Categorization)
    text = await process_ocr_and_ai(db, file_obj, current_user.id, ocr_data)
    
    if not text:
        return ocr_data # Return raw response if processing failed but we got something

    return ocr_data

@router.get("/ocr-db/{file_id}")
async def get_ocr_from_db(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch OCR text directly from the database using file_id.
    """
    try:
        f_id = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    ocr_res = db.query(OCRResult).filter(OCRResult.file_id == f_id).first()
    
    if not ocr_res:
        raise HTTPException(status_code=404, detail="OCR text not found in database for this file.")
        
    return {
        "file_id": str(f_id),
        "ocr_text": ocr_res.extracted_text,
        "created_at": ocr_res.created_at
    }

# --- File Management Endpoints ---

@router.post("/upload", response_model=FileUploadResponse)
def upload_file(
    file_data: FileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # --- JIT Location Validation ---
    is_valid, reason = validate_jit_location(
        file_data.latitude, 
        file_data.longitude, 
        file_data.accuracy_meters, 
        file_data.device_timestamp,
        file_data.location_tier
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Geolocation Validation Failed: {reason}"
        )

    new_file = File(
        owner_id=current_user.id,
        file_name=file_data.file_name,
        file_type=file_data.file_type,
        file_size=file_data.file_size,
        cid=file_data.cid,
        category=file_data.category or "Uncategorized"
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    if file_data.sections:
        for sec in file_data.sections:
            new_sec = FileSection(
                file_id=new_file.id,
                section_index=sec.section_index,
                cid=sec.cid,
                section_key=sec.section_key,
                coordinates=sec.coordinates,
                authorized_users=sec.authorized_users,
            )
            db.add(new_sec)
        db.commit()

    # Local Blockchain Registration
    timestamp = datetime.utcnow()
    prev_tx_id = "GENESIS"
    block_data = {
        "owner_id": str(new_file.owner_id),
        "file_name": new_file.file_name,
        "file_type": new_file.file_type,
        "file_size": new_file.file_size,
        "cid": new_file.cid,
        "sender_latitude": file_data.latitude,
        "sender_longitude": file_data.longitude,
        "sender_address": reverse_geocode(float(file_data.latitude), float(file_data.longitude)),
        "accuracy_meters": file_data.accuracy_meters,
        "device_timestamp": file_data.device_timestamp,
        "location_tier": getattr(file_data, 'location_tier', 'high'),
        "action": "Registered"
    }
    
    local_tx_id = calculate_block_hash(prev_tx_id, str(new_file.id), block_data, timestamp.isoformat())
    
    local_block = Block(
        tx_id=local_tx_id,
        prev_tx_id=prev_tx_id,
        file_id=str(new_file.id),
        timestamp=timestamp,
        data=block_data
    )
    db.add(local_block)
    db.commit()

    # Synchronous Call to External Server
    external_url = "http://164.52.194.98:8015/api/files/register"
    payload = {
        "id": str(new_file.id),
        "owner_id": str(new_file.owner_id),
        "file_name": new_file.file_name,
        "file_type": new_file.file_type,
        "file_size": new_file.file_size,
        "cid": new_file.cid,
        "sender_latitude": file_data.latitude,
        "sender_longitude": file_data.longitude,
        "sender_address": reverse_geocode(float(file_data.latitude), float(file_data.longitude)),
        "accuracy_meters": file_data.accuracy_meters,
        "device_timestamp": file_data.device_timestamp,
        "location_tier": getattr(file_data, 'location_tier', 'high')
    }
    headers = {"Content-Type": "application/json", "X-Api-Key": "secret123"}
    
    sync_success = False
    sync_message = ""
    sync_data = None
    try:
        response = requests.post(external_url, json=payload, headers=headers, timeout=5)
        if response.status_code == 200:
            resp_json = response.json()
            sync_success = resp_json.get("success", False)
            sync_message = resp_json.get("message", "External sync successful")
            sync_data = resp_json.get("data")
    except Exception as e:
        sync_message = f"External sync failed: {str(e)}"

    response_data = new_file.__dict__.copy()
    response_data["sections"] = new_file.sections
    response_data.update({
        "sync_success": sync_success,
        "sync_message": sync_message,
        "sync_data": sync_data
    })
    return response_data

@router.get("/categories")
def get_vault_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns counts of documents per category for the user's vault.
    """
    from sqlalchemy import func
    results = db.query(File.category, func.count(File.id)).filter(
        File.owner_id == current_user.id
    ).group_by(File.category).all()
    
    return {cat if cat else "Uncategorized": count for cat, count in results}

@router.post("/recompute-categories")
async def recompute_vault_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Scans all uncategorized files and attempts to categorize them using existing OCR results.
    """
    from models.file import OCRResult
    
    # Find files with OCR but no category
    target_files = db.query(File, OCRResult.extracted_text).join(
        OCRResult, File.id == OCRResult.file_id
    ).filter(
        File.owner_id == current_user.id,
        or_(File.category == "Uncategorized", File.category == None)
    ).all()
    
    count = 0
    for file, text in target_files:
        if text:
            category = await auto_classify_document(text)
            if category != "Uncategorized":
                file.category = category
                count += 1
    
    db.commit()
    return {"message": f"Successfully categorized {count} documents.", "total_processed": len(target_files)}

@router.get("/vault", response_model=PaginatedResponse[FileResponse])
def get_my_vault(
    page: int = 1,
    size: int = 20,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    query = db.query(File).filter(
        File.owner_id == current_user.id,
        ~File.file_name.like("[Redacted for %")
    )
    
    if category:
        query = query.filter(File.category == category)
        
    total_items = query.count()
    total_pages = (total_items + size - 1) // size if total_items > 0 else 1
    files = query.order_by(File.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {
        "items": files,
        "total": total_items,
        "page": page,
        "size": size,
        "pages": total_pages
    }

@router.post("/send", response_model=TransferSyncResponse)
def send_file(
    transfer_req: TransferRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # --- JIT Location Validation ---
    is_valid, reason = validate_jit_location(
        transfer_req.latitude, 
        transfer_req.longitude, 
        transfer_req.accuracy_meters, 
        transfer_req.device_timestamp,
        transfer_req.location_tier
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Geolocation Validation Failed: {reason}"
        )

    file = db.query(File).filter(File.id == transfer_req.file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    has_access = False
    if file.owner_id == current_user.id:
        has_access = True
    else:
        received_it = db.query(Transfer).filter(Transfer.file_id == file.id, Transfer.receiver_id == current_user.id).first()
        if received_it:
            has_access = True

    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    receiver = db.query(User).filter(User.id == transfer_req.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    new_transfer = Transfer(
        file_id=transfer_req.file_id,
        sender_id=current_user.id,
        receiver_id=receiver.id,
        access_control=transfer_req.access_control,
        deadline=transfer_req.due_date,
        sender_latitude=transfer_req.latitude,
        sender_longitude=transfer_req.longitude,
        sender_address=reverse_geocode(float(transfer_req.latitude), float(transfer_req.longitude)),
        receiver_latitude="0",
        receiver_longitude="0",
        receiver_address="Pending Receipt"
    )
    db.add(new_transfer)
    db.commit()
    db.refresh(new_transfer)

    # Email Notification
    print(f"DEBUG EMAIL: Checking receiver email for user ID {receiver.id}. Found: {receiver.email}")
    if receiver.email:
        print(f"DEBUG EMAIL: Triggering background task to send email to {receiver.email}")
        email_subject = f"[DMS] New Document Securely Shared: {file.file_name}"
        
        receiver_name = receiver.full_name if receiver.full_name else receiver.username
        sender_name = current_user.full_name if current_user.full_name else current_user.username
        deadline_str = new_transfer.deadline.strftime('%Y-%m-%d %H:%M') if new_transfer.deadline else 'Not Specified'

        email_body = (
            f"Dear {receiver_name},\n\n"
            f"We are notifying you that a new document has been securely shared with you via the Document Management System (DMS).\n\n"
            f"--- Document Details ---\n"
            f"Title: {file.file_name}\n"
            f"Sender: {sender_name}\n"
            f"Access Level: {new_transfer.access_control}\n"
            f"Response Deadline: {deadline_str}\n"
            f"Transaction ID: {new_transfer.id}\n\n"
            f"Please access the system to review this document at your earliest convenience.\n\n"
            f"This is an automated security notification. If you did not expect this document, please contact your administrator.\n\n"
            f"Regards,\n"
            f"Document Management System Team"
        )
        background_tasks.add_task(send_email_async, receiver.email, email_subject, email_body)
    else:
        print("DEBUG EMAIL: No email found for receiver.")

    # Local Blockchain Transfer
    timestamp = datetime.utcnow()
    last_block = db.query(Block).filter(Block.file_id == str(new_transfer.file_id)).order_by(Block.timestamp.desc()).first()
    prev_tx_id = last_block.tx_id if last_block else "GENESIS"
    
    block_data = last_block.data.copy() if last_block else {
        "file_name": file.file_name,
        "file_type": file.file_type,
        "file_size": file.file_size,
        "cid": file.cid
    }
    
    block_data.update({
        "owner_id": str(new_transfer.receiver_id),
        "transferred_by": str(new_transfer.sender_id),
        "sender_latitude": str(new_transfer.sender_latitude),
        "sender_longitude": str(new_transfer.sender_longitude),
        "sender_address": str(new_transfer.sender_address),
        "receiver_latitude": "0",
        "receiver_longitude": "0",
        "receiver_address": "Pending Receipt",
        "action": "Transferred"
    })

    local_tx_id = calculate_block_hash(prev_tx_id, str(new_transfer.file_id), block_data, timestamp.isoformat())

    local_block = Block(
        tx_id=local_tx_id,
        prev_tx_id=prev_tx_id,
        file_id=str(new_transfer.file_id),
        timestamp=timestamp,
        data=block_data
    )
    db.add(local_block)
    db.commit()

    # Sync to external
    external_url = "http://164.52.194.98:8015/api/files/transfer"
    payload = {
        "id": str(new_transfer.id),
        "file_id": str(new_transfer.file_id),
        "sender_id": str(new_transfer.sender_id),
        "receiver_id": str(new_transfer.receiver_id),
        "sender_latitude": str(new_transfer.sender_latitude),
        "sender_longitude": str(new_transfer.sender_longitude),
        "sender_address": str(new_transfer.sender_address),
        "accuracy_meters": transfer_req.accuracy_meters,
        "device_timestamp": transfer_req.device_timestamp,
        "location_tier": getattr(transfer_req, 'location_tier', 'high')
    }
    headers = {"Content-Type": "application/json", "X-Api-Key": "secret123"}
    
    sync_success = False
    sync_message = ""
    try:
        response = requests.post(external_url, json=payload, headers=headers, timeout=5)
        if response.status_code == 200:
            sync_success = True
    except Exception:
        pass

    return {
        "id": new_transfer.id,
        "file": file,
        "sender": current_user,
        "receiver": receiver,
        "access_control": new_transfer.access_control,
        "deadline": new_transfer.deadline,
        "sent_at": new_transfer.sent_at,
        "sync_success": sync_success,
        "sync_message": sync_message
    }

@router.put("/transfer/{transfer_id}/receive")
def record_receipt(
    transfer_id: uuid.UUID,
    location_data: schemas.UserLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer or transfer.receiver_id != current_user.id:
         raise HTTPException(status_code=403, detail="Access denied")

    lat = get_safe_lat(location_data.latitude)
    lng = get_safe_lng(location_data.longitude)
    
    # Auto-populate location from Lat/Lon if location is generic/empty (Reference Logic)
    final_location = location_data.location_string or "Current Location"
    addr = "Unknown Location"

    if lat and lng:
        try:
            f_lat = float(lat)
            f_lng = float(lng)
            
            if f_lat != 0.0 and f_lng != 0.0:
                if not final_location or ("," in final_location and any(c.isdigit() for c in final_location)):
                     resolved = reverse_geocode(f_lat, f_lng)
                     if resolved:
                         addr = resolved
                elif final_location == "Current Location":
                     resolved = reverse_geocode(f_lat, f_lng)
                     if resolved:
                         addr = resolved
            
            if addr == "Unknown Location":
                addr = location_data.address or "Unknown Location"
        except:
            pass

    transfer.receiver_latitude = lat
    transfer.receiver_longitude = lng
    transfer.receiver_address = addr
    db.commit()

    # Sync location update to blockchain
    try:
        blockchain_url = "http://164.52.194.98:8015/api/files/update-location"
        payload = {
            "file_id": str(transfer.file_id),
            "user_id": str(current_user.id),
            "latitude": lat,
            "longitude": lng,
            "address": addr,
            "action": "Document Received"
        }
        requests.post(blockchain_url, json=payload, headers={"X-Api-Key": "secret123"}, timeout=5)
    except:
        pass

    return {"message": "Receipt recorded successfully", "address": addr}

@router.post("/register-redacted", response_model=RedactedRegisterResponse)
def register_redacted_derivative(
    req: RedactedRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if str(req.redacted_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    # Fetch coordinates for sender (current_user) and receiver (shared_with)
    receiver_user = db.query(User).filter(User.id == req.shared_with).first()
    
    # Use JIT if available, fallback to profile
    sender_lat = req.sender_latitude or str(current_user.Latitude or "0")
    sender_lng = req.sender_longitude or str(current_user.Longitude or "0")
    receiver_lat = str(receiver_user.Latitude) if (receiver_user and receiver_user.Latitude) else "0"
    receiver_lng = str(receiver_user.Longitude) if (receiver_user and receiver_user.Longitude) else "0"
    
    sender_addr = "Unknown Location"
    if sender_lat != "0" and sender_lng != "0":
        try:
            sender_addr = reverse_geocode(float(sender_lat), float(sender_lng)) or "Unknown Location"
        except: pass

    external_url = "http://164.52.194.98:8015/api/files/register-redacted"
    payload = {
        "id": str(req.id),
        "primary_file_id": str(req.primary_file_id),
        "redacted_by": str(req.redacted_by),
        "redacted_cid": req.redacted_cid,
        "shared_with": str(req.shared_with),
        "sender_latitude": sender_lat,
        "sender_longitude": sender_lng,
        "sender_address": sender_addr,
        "receiver_latitude": receiver_lat,
        "receiver_longitude": receiver_lng,
        "receiver_address": "Pending",
        "accuracy_meters": req.accuracy_meters,
        "device_timestamp": req.device_timestamp,
        "location_tier": req.location_tier
    }
    headers = {
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        "X-Api-Key": "secret123"
    }

    sync_success = False
    try:
        response = requests.post(external_url, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            sync_success = True
    except Exception:
        pass

    return {
        "sync_success": sync_success,
        "sync_message": "Derivative registered",
        "sync_data": None
    }

@router.get("/received")
def get_received_files(
    page: int = 1,
    size: int = 20,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    query = db.query(Transfer).filter(Transfer.receiver_id == current_user.id)
    total_items = query.count()
    total_pages = (total_items + size - 1) // size if total_items > 0 else 1
    
    transfers = query.options(
        joinedload(Transfer.file).joinedload(File.sections),
        joinedload(Transfer.sender),
        joinedload(Transfer.receiver)
    ).order_by(Transfer.sent_at.desc()).offset((page - 1) * size).limit(size).all()
    
    serialized_items = []
    for t in transfers:
        # Construct serialized file with sections
        file_data = None
        if t.file:
            file_data = {
                "id": t.file.id,
                "owner_id": t.file.owner_id,
                "file_name": t.file.file_name,
                "file_type": t.file.file_type,
                "file_size": t.file.file_size,
                "cid": t.file.cid,
                "created_at": t.file.created_at,
                "sections": []
            }
            # Filter sections for security: Only include keys if recipient is authorized
            for sec in t.file.sections:
                is_authorized = False
                if t.file.owner_id == current_user.id:
                    is_authorized = True
                else:
                    try:
                        import json
                        auth_users = json.loads(sec.authorized_users) if sec.authorized_users else []
                        if str(current_user.id) in [str(u) for u in auth_users]:
                            is_authorized = True
                    except:
                        pass
                
                sec_dict = {
                    "id": sec.id,
                    "section_index": sec.section_index,
                    "cid": sec.cid,
                    "coordinates": sec.coordinates,
                    "authorized_users": sec.authorized_users,
                    "section_key": sec.section_key if is_authorized else None
                }
                file_data["sections"].append(sec_dict)

        serialized_items.append({
            "id": t.id,
            "file": file_data,
            "sender": t.sender,
            "receiver": t.receiver,
            "access_control": t.access_control,
            "deadline": t.deadline,
            "sent_at": t.sent_at,
            "sender_latitude": t.sender_latitude,
            "sender_longitude": t.sender_longitude,
            "sender_address": t.sender_address,
            "receiver_latitude": t.receiver_latitude,
            "receiver_longitude": t.receiver_longitude,
            "receiver_address": t.receiver_address
        })

    return {
        "items": serialized_items,
        "total": total_items,
        "page": page,
        "size": size,
        "pages": total_pages
    }

@router.get("/{file_id}", response_model=FileResponse)
def get_file_details(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file = db.query(File).options(joinedload(File.sections)).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if user is owner or has received it
    has_access = False
    if file.owner_id == current_user.id:
        has_access = True
    else:
        transfer = db.query(Transfer).filter(Transfer.file_id == file_id, Transfer.receiver_id == current_user.id).first()
        if transfer:
            has_access = True
            
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Filter section keys for security
    for sec in file.sections:
        is_authorized = False
        if file.owner_id == current_user.id:
            is_authorized = True
        else:
            try:
                import json
                auth_users = json.loads(sec.authorized_users) if sec.authorized_users else []
                if str(current_user.id) in [str(u) for u in auth_users]:
                    is_authorized = True
            except:
                pass
        
        if not is_authorized:
            sec.section_key = None
            
    return file

@router.get("/{file_id}/history", response_model=list[TransferResponse])
def get_file_history(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    file = db.query(File).filter(File.id == file_id, File.owner_id == current_user.id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found or access denied")
        
    return db.query(Transfer).filter(Transfer.file_id == file_id).all()

@router.get("/{file_id}/download")
def download_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
        
    if file.owner_id != current_user.id:
        transfer = db.query(Transfer).filter(Transfer.file_id == file_id, Transfer.receiver_id == current_user.id).first()
        if not transfer:
            raise HTTPException(status_code=403, detail="Access denied")
        
    cid = file.cid
    
    response = fetch_ipfs_content(cid, stream=True)
    
    def iterfile():
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                yield chunk

    headers = {
        "Content-Disposition": f'attachment; filename="{file.file_name}"',
        "Access-Control-Expose-Headers": "Content-Disposition"
    }
    
    return StreamingResponse(iterfile(), media_type="application/octet-stream", headers=headers)

@router.put("/{file_id}/update", response_model=schemas.FileUpdateSyncResponse)
def update_file(
    file_id: uuid.UUID,
    file_update: schemas.FileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
        
    if file.owner_id != current_user.id:
        from models.file import AccessControlEnum
        # Check if there's ANY transfer to this user for this file that allows updates
        has_update_permission = db.query(Transfer).filter(
            Transfer.file_id == file_id,
            Transfer.receiver_id == current_user.id,
            Transfer.access_control == AccessControlEnum.VIEW_AND_UPDATE
        ).first() is not None
        
        if not has_update_permission:
            raise HTTPException(status_code=403, detail="Access denied")
        
    # Update fields
    file.cid = file_update.cid
    if file_update.file_name: file.file_name = file_update.file_name
    if file_update.category: file.category = file_update.category
    
    db.commit()
    db.refresh(file)
    
    # --- Synchronous Call to External Server ---
    sync_success = False
    sync_message = None
    sync_data = None

    external_url = "http://164.52.194.98:8015/api/files/edit"
    payload = {
        "id": str(file.id),
        "owner_id": str(file.owner_id),
        "file_name": file.file_name,
        "file_type": file.file_type,
        "file_size": file.file_size,
        "cid": file.cid,
        "sender_latitude": str(current_user.Latitude) if current_user.Latitude else "0",
        "sender_longitude": str(current_user.Longitude) if current_user.Longitude else "0"
    }
    headers = {"Content-Type": "application/json", "X-Api-Key": "secret123"}

    try:
        response = requests.post(external_url, json=payload, headers=headers, timeout=5)
        if response.status_code == 200:
            resp_json = response.json()
            sync_success = resp_json.get("success", False)
            sync_message = resp_json.get("message", "External edit sync successful")
            sync_data = resp_json.get("data")
    except Exception as e:
        sync_message = f"External edit sync failed: {str(e)}"

    # Flatten the response to match FileUpdateSyncResponse schema
    response_data = file.__dict__.copy()
    response_data.update({
        "sync_success": sync_success, 
        "sync_message": sync_message, 
        "sync_data": sync_data
    })
    return response_data

@router.post("/{file_id}/ocr", response_model=OCRResultResponse)
async def analyze_file_ocr(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file = db.query(File).filter(File.id == file_id, File.owner_id == current_user.id).first()
    if not file:
        raise HTTPException(status_code=404, detail="Access denied")

    cached_result = db.query(OCRResult).filter(OCRResult.file_id == file_id).first()
    if cached_result:
        return cached_result

    # Use robust fetching logic to avoid 502/403 errors
    try:
        resp = fetch_ipfs_content(file.cid, stream=False)
        base64_image = base64.b64encode(resp.content).decode('utf-8')
        
        ocr_prompt = "Extract all text from this image exactly."
        ai_resp = await ollama.AsyncClient().chat(
            model='qwen3-vl:4b',
            messages=[{'role': 'user', 'content': ocr_prompt, 'images': [base64_image]}]
        )
        extracted_text = ai_resp['message']['content']
        
        from ocr_logic import process_ocr_and_ai
        await process_ocr_and_ai(db, file, current_user.id, raw_text=extracted_text)
        
        db.refresh(file)
        cached_result = db.query(OCRResult).filter(OCRResult.file_id == file_id).first()
        return cached_result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
