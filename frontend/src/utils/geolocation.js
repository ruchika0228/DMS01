// src/utils/geolocation.js
import api from '../api/axios';

const CACHE_KEY_LAT = "saved_latitude";
const CACHE_KEY_LNG = "saved_longitude";
const CACHE_KEY_TIME = "location_timestamp";

let pendingPromise = null;

/**
 * Sends the coordinates to the backend API.
 */
async function sendLocationToBackend(latitude, longitude, isApproximate = false) {
  try {
    const token = localStorage.getItem('token');
    if (!token) return true;

    await api.put("/auth/me/location", {
      latitude: String(latitude),
      longitude: String(longitude),
      location_string: isApproximate ? "Approximate Device Location" : "Device GPS Location"
    });
    return true;
  } catch (error) {
    console.error("Failed to sync device location to backend:", error);
    return false;
  }
}

/**
 * Updates the local storage cache.
 */
function updateLocationCache(latitude, longitude) {
  localStorage.setItem(CACHE_KEY_LAT, latitude);
  localStorage.setItem(CACHE_KEY_LNG, longitude);
  localStorage.setItem(CACHE_KEY_TIME, Date.now());
}

/**
 * Tiered Position Capture - Hardware Only.
 */
async function getSettledPositionTiered() {
  if (!navigator.geolocation) {
    throw new Error("Geolocation API Not Supported");
  }

  const isSecure = window.isSecureContext || 
                   window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';
  
  if (!isSecure) {
    const msg = "SECURITY BLOCK: Your browser blocks location on insecure (HTTP) connections.";
    alert(msg);
    throw new Error(msg);
  }

  // Tier 1: Force High Accuracy (GPS/Hardware)
  try {
    console.log("Requesting High-Accuracy hardware location...");
    const pos = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
          reject(new Error("GPS Search Timeout."));
      }, 15000);

      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(timeoutId);
          resolve(p);
        },
        (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
    return { 
        coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
        },
        timestamp: pos.timestamp,
        tier: 'Hardware GPS' 
    };
  } catch (gpsError) {
    console.warn("High-accuracy GPS failed, trying Coarse Hardware (Wifi/Cell)...", gpsError);
    
    if (gpsError.code === 1) {
        alert("Location permission denied. Click the lock icon (🔒) in the address bar and set Location to 'Allow'.");
        throw gpsError;
    }

    // Tier 2: Try Coarse Hardware
    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
                enableHighAccuracy: false, 
                timeout: 10000, 
                maximumAge: 300000 
            });
        });
        return { 
            coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy
            },
            timestamp: pos.timestamp,
            tier: 'Hardware (Wifi/Cell)' 
        };
    } catch (coarseError) {
        console.error("Coarse hardware location also failed:", coarseError);

        let errorMsg = "Failed to get location from device hardware.";

        if (coarseError.code === 3) {
            errorMsg = "LOCATION TIMEOUT: \n\n1. Ensure your device GPS/Location is ON. \n2. Move near a window or ensure Wi-Fi is enabled. \n3. Browser location on desktops can be inaccurate depending on your ISP.";
        } else if (coarseError.code === 2) {
            errorMsg = "Hardware location is unavailable on this device.";
        } else if (coarseError.code === 1) {
            errorMsg = "Location permission denied. Please allow location access in your browser settings.";
        }

        throw new Error(errorMsg);
    }
  }
}

/**
 * Unified success handler.
 */
async function processPosition(position) {
  if (!position || !position.coords) {
     throw new Error("Invalid position object structure");
  }
  
  const { latitude, longitude, accuracy } = position.coords;
  const tier = position.tier || 'GPS';

  updateLocationCache(latitude, longitude);
  await sendLocationToBackend(latitude, longitude, tier !== 'Hardware GPS');
  
  return { 
    latitude, 
    longitude, 
    source: tier, 
    accuracy: accuracy ? `${accuracy.toFixed(0)}m` : 'unknown'
  };
}

export async function checkAndSetupLocationCache() {
  if (pendingPromise) return pendingPromise;

  localStorage.removeItem(CACHE_KEY_LAT);
  localStorage.removeItem(CACHE_KEY_LNG);
  localStorage.removeItem(CACHE_KEY_TIME);

  pendingPromise = (async () => {
    try {
      const pos = await getSettledPositionTiered();
      const res = await processPosition(pos);
      pendingPromise = null;
      return res;
    } catch (err) {
      pendingPromise = null;
      console.error("Location setup error:", err);
      return { latitude: 0, longitude: 0, source: 'error', error: err.message || "Unknown error" };
    }
  })();
  return pendingPromise;
}

export async function forceLocationUpdate() {
  try {
    const pos = await getSettledPositionTiered();
    return await processPosition(pos);
  } catch (err) {
    console.error("Force update failed:", err);
    return { 
        latitude: 0, 
        longitude: 0, 
        source: 'error', 
        error: err.message || "Device location request failed." 
    };
  }
}

/**
 * Captures fresh, hardware-accurate location specifically for a transaction.
 */
export async function getJitLocation() {
    if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported by this browser.");
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        throw new Error("Location requires a secure connection (HTTPS).");
    }

    const capturePosition = (options) => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
    };

    try {
        // High-Accuracy GPS poll
        const pos = await capturePosition({
            enableHighAccuracy: true,
            timeout: 10000, 
            maximumAge: 0 // Prevent stale cache
        });
        
        return {
            latitude: pos.coords.latitude.toString(),
            longitude: pos.coords.longitude.toString(),
            accuracy: pos.coords.accuracy,
            device_timestamp: pos.timestamp,
            tier: 'high'
        };
    } catch (error) {
        if (error.code === 1) { // PERMISSION_DENIED
            throw new Error("Location permission denied. Please allow location access to proceed with this secure document transaction.");
        }

        // Fallback to coarse if GPS fails/timeouts
        try {
            const pos = await capturePosition({
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 30000 
            });
            return {
                latitude: pos.coords.latitude.toString(),
                longitude: pos.coords.longitude.toString(),
                accuracy: pos.coords.accuracy,
                device_timestamp: pos.timestamp,
                tier: 'coarse'
            };
        } catch (fallbackError) {
            console.warn("Automated location capture failed. Offering manual entry fallback.", fallbackError);
            
            const useManual = window.confirm(
                "HARDWARE CAPTURE FAILED: \n\n" +
                "Your device (e.g., an Ethernet-only desktop) may lack the Wi-Fi or GPS sensors required to automatically detect your location.\n\n" +
                "To maintain the security audit trail, would you like to MANUALLY DECLARE your current coordinates?"
            );

            if (useManual) {
                const manualLat = window.prompt("Enter your Latitude (e.g., 21.1458):", "0");
                const manualLon = window.prompt("Enter your Longitude (e.g., 79.0882):", "0");

                if (manualLat && manualLon && !isNaN(manualLat) && !isNaN(manualLon)) {
                    return {
                        latitude: manualLat,
                        longitude: manualLon,
                        accuracy: 1000, // Explicitly marked as low-accuracy manual entry
                        device_timestamp: Date.now(),
                        tier: 'manual'
                    };
                }
            }

            throw new Error("Failed to capture location. Ensure your device hardware (GPS/Wi-Fi) is enabled or provide manual coordinates.");
        }
    }
}
