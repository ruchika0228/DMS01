import requests
import time
from typing import Optional, Tuple

def validate_jit_location(
    lat: Optional[str], 
    lon: Optional[str], 
    accuracy: Optional[float], 
    device_timestamp: Optional[int],
    location_tier: Optional[str] = "high"
) -> Tuple[bool, str]:
    """
    Validates JIT geolocation data for accuracy, freshness, and authenticity.
    Returns (is_valid, reason).
    """
    print(f"DEBUG GEO: Validating {location_tier} location: Lat={lat}, Lon={lon}, Acc={accuracy}, TS={device_timestamp}")

    if not lat or not lon:
        return False, "Missing coordinates"
    
    try:
        f_lat = float(lat)
        f_lon = float(lon)
    except ValueError:
        return False, "Invalid coordinate format"

    # 1. Null Island Check (0, 0) - Relaxed slightly for manual but still discouraged
    if abs(f_lat) < 0.0001 and abs(f_lon) < 0.0001:
        if location_tier == "manual":
            # Allow manual 0,0 if they really insist, but log a warning
            print("WARNING: User manually declared 0,0 coordinates.")
        else:
            return False, "Invalid coordinates (Null Island detected)"

    # 2. Accuracy Threshold Check (e.g., max 5000 meters)
    # Manual entries have a dummy accuracy, so we only check hardware tiers
    if location_tier != "manual" and accuracy is not None and accuracy > 5000:
        return False, f"Low accuracy detected ({accuracy}m). Hardware GPS or Wi-Fi triangulation required."

    # 3. Freshness Check (e.g., max 5 minutes old)
    if device_timestamp is not None:
        # device_timestamp is in ms, time.time() is in s
        server_ts_ms = int(time.time() * 1000)
        age_ms = server_ts_ms - device_timestamp
        
        # Max age: 5 minutes (300,000 ms)
        if age_ms > 300000:
            return False, f"Stale location data detected ({int(age_ms/1000)}s old). Please refresh."
        
        # Prevent future timestamps (allow 120s clock skew for unsynced devices)
        if age_ms < -120000:
             return False, f"Location timestamp is in the future ({int(-age_ms/1000)}s ahead). Check device clock settings."

    return True, "Valid"

def get_ip_location(ip_address: str):
    """
    IP Geolocation is disabled to force the use of device-level hardware coordinates.
    """
    return None, None

def reverse_geocode(lat: float, lon: float) -> str:
    """
    Reverse geocodes latitude and longitude to a readable address using OpenStreetMap Nominatim.
    Returns a formatted string or None if failed.
    """
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
        headers = {
            'User-Agent': 'File_Management_System/1.0'
        }
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if 'address' in data:
            addr = data['address']
            # Construct a detailed address
            building = addr.get('building', '') or addr.get('amenity', '') or addr.get('office', '')
            house_number = addr.get('house_number', '')
            road = addr.get('road', '') or addr.get('pedestrian', '') or addr.get('street', '')
            suburb = addr.get('suburb', '') or addr.get('neighbourhood', '')
            city = addr.get('city', '') or addr.get('town', '') or addr.get('village', '')
            state = addr.get('state', '')
            postcode = addr.get('postcode', '')
            
            # Combine house number and road
            road_full = f"{house_number} {road}".strip() if house_number else road
            
            parts = [p for p in [building, road_full, suburb, city, state, postcode] if p]
            if parts:
                return ", ".join(parts)
            return data.get('display_name', f"{lat}, {lon}")
            
        return None
    except Exception as e:
        print(f"Geocoding error: {e}")
        return None

def get_full_location_data(ip_address: str = None, lat: float = None, lon: float = None):
    """
    Unified function to get lat, lon and address.
    If lat/lon are not provided, it tries to fetch them via IP.
    Then it reverse geocodes to get the address.
    """
    if lat is None or lon is None:
        lat, lon = get_ip_location(ip_address)
    
    address = None
    if lat is not None and lon is not None:
        # Prevent geocoding (0, 0) which often points to 'Null Island' or errors
        if abs(lat) < 0.0001 and abs(lon) < 0.0001:
            return {
                "latitude": lat,
                "longitude": lon,
                "address": "Invalid Coordinates (Null Island)"
            }
        address = reverse_geocode(lat, lon)
    
    return {
        "latitude": lat,
        "longitude": lon,
        "address": address
    }
