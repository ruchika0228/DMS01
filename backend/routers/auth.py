from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
# from passlib.context import CryptContext # Removed
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from database import get_db
from models.user import User
from schemas import UserCreate, UserResponse, Token, TokenData

# Configuration (Move to .env later)
SECRET_KEY = "your-secret-key-CHANGE-THIS-IN-PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") # Removed due to compatibility issues
import bcrypt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

router = APIRouter(
    prefix="/auth",
    tags=["authentication"]
)

# --- Helper Functions ---
def verify_password(plain_password, hashed_password):
    # bcrypt.checkpw requires bytes
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    # bcrypt.hashpw requires bytes and returns bytes. We decode to store as string.
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Dependency ---
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    print(f"DEBUG AUTH: Received Token: {token[:10]}...")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        print(f"DEBUG AUTH: Decoded Username (sub): {username}")
        if username is None:
            print("DEBUG AUTH: Error - Token missing 'sub' claim")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing 'sub' claim",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token_data = TokenData(username=username)
    except JWTError as e:
        print(f"DEBUG AUTH: JWTError: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        print(f"DEBUG AUTH: Error - User '{token_data.username}' not found in DB")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    print(f"DEBUG AUTH: Success - Authenticated as {user.username}")
    return user

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

from schemas import UserProfilePictureUpdate

@router.put("/me/profile-picture", response_model=UserResponse)
def update_profile_picture(
    update_data: UserProfilePictureUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.profile_picture = update_data.profile_picture
    db.commit()
    db.refresh(current_user)
    return current_user

from schemas import UserLocationUpdate

from geo import reverse_geocode, get_full_location_data

@router.post("/me/detect-location", response_model=UserResponse)
def detect_user_location(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Automatically detects user location via IP and reverse geocodes it.
    Follows the approach: Fetch Lat/Lon (via IP) -> Reverse Geocode (via OSM).
    """
    # Try to get IP from headers if behind a proxy, else request.client.host
    ip_address = request.headers.get("X-Forwarded-For") or request.client.host
    if ip_address and "," in ip_address:
        ip_address = ip_address.split(",")[0].strip()

    # For local development, if IP is local, it won't yield results.
    # We could allow passing an IP for testing purposes or use a mock.
    loc_data = get_full_location_data(ip_address=ip_address)
    
    if loc_data["latitude"] and loc_data["longitude"]:
        current_user.Latitude = str(loc_data["latitude"])
        current_user.Longitude = str(loc_data["longitude"])
        if loc_data["address"]:
            current_user.Address = loc_data["address"]
        
        db.commit()
        db.refresh(current_user)
    
    return current_user

@router.put("/me/location", response_model=UserResponse)
def update_user_location(
    location_data: UserLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if location_data.latitude is not None:
        current_user.Latitude = location_data.latitude
    if location_data.longitude is not None:
        current_user.Longitude = location_data.longitude
    
    # Auto-populate location from Lat/Lon if location is generic/empty (Reference Logic)
    final_location = location_data.location_string or "Current Location"
    
    if current_user.Latitude and current_user.Longitude:
        try:
            lat = float(current_user.Latitude)
            lon = float(current_user.Longitude)
            
            # Robust check for real coordinates (ignoring 0.0 and nulls)
            if abs(lat) > 0.0001 and abs(lon) > 0.0001:
                # If the frontend sends device coordinates, ALWAYS reverse geocode via OSM
                # to get the accurate local address (e.g., Nagpur)
                address = reverse_geocode(lat, lon)
                if address:
                    current_user.Address = address
            
            if not current_user.Address:
                 current_user.Address = location_data.address or "Unknown Location"
                 
        except (ValueError, TypeError):
            pass

    db.commit()
    db.refresh(current_user)
    return current_user

# --- Endpoints ---

@router.post("/signup", response_model=UserResponse)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    # Check if email or username exists
    db_user_email = db.query(User).filter(User.email == user.email).first()
    if db_user_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user_username = db.query(User).filter(User.username == user.username).first()
    if db_user_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Generate Friend Code
    friend_code = User.generate_unique_friend_code(db)

    # Create User
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        username=user.username,
        password_hash=hashed_password,
        friend_code=friend_code,
        department=user.department,
        designation=user.designation,
        approval_stage=user.approval_stage
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Note: OAuth2PasswordRequestForm expects 'username' field, which can be email or username
    # Logic to check user by username
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user:
        # Fallback to check by email if username not found
        user = db.query(User).filter(User.email == form_data.username).first()
        
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
