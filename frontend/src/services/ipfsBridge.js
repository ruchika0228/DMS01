/**
 * IPFS Bridge Service
 * Handles communication with the IPFS Chrome Extension or a local IPFS node.
 */

const EXTENSION_DETECTION_TIMEOUT = 60000; // 60 seconds to match working project
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Cache the extension detection result to avoid repeated timeouts in loops (e.g. Redaction Page)
let _extensionDetected = null; // null = unknown, true = present, false = missing

/**
 * Converts a File object to Base64 string (Required for Extension)
 */
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

const ipfsBridge = {
    /**
     * Uploads a file to IPFS.
     * Attempts to use the Browser Extension first, then falls back to local RPC.
     */
    uploadFile: async (file) => {
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max 100MB.`);
        }

        // --- Helper: Direct Local RPC Upload ---
        const uploadToLocalIPFS = async (fileObject) => {
            console.log("[IPFS Bridge] >>> FALLBACK: Attempting Direct Local RPC Upload...");
            const formData = new FormData();
            formData.append('file', fileObject);
            
            const rpcUrls = [
                'http://127.0.0.1:5001/api/v0/add',
                'http://localhost:5001/api/v0/add'
            ];

            for (const url of rpcUrls) {
                try {
                    console.log(`[IPFS Bridge] Trying local RPC at ${url}...`);
                    const response = await fetch(url, { method: 'POST', body: formData });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`IPFS Server Error (${response.status}): ${errorText}`);
                    }
                    
                    const result = await response.json();
                    if (result.Hash) {
                        console.log(`[IPFS Bridge] Local Upload Success: ${result.Hash}`);
                        return result.Hash;
                    }
                } catch (err) {
                    console.warn(`[IPFS Bridge] Local RPC attempt failed for ${url}:`, err.message);
                }
            }

            throw new Error(
                "CRITICAL: IPFS UPLOAD FAILED\n\n" +
                "The IPFS Bridge Extension was not detected AND your local IPFS node (Desktop/Kubo) is not responding.\n\n" +
                "TO FIX THIS:\n" +
                "1. Open IPFS Desktop and ensure it is 'Online'.\n" +
                "2. Open your terminal and run these commands to allow this website to talk to IPFS:\n\n" +
                "ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin \"[\\\"*\\\"]\"\n" +
                "ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods \"[\\\"PUT\\\", \\\"POST\\\", \\\"GET\\\"]\"\n\n" +
                "3. Restart IPFS Desktop and try again."
            );
        };

        // If we already know the extension is missing, skip the wait and go straight to local
        if (_extensionDetected === false) {
            console.log("[IPFS Bridge] Extension known to be missing. Skipping detection wait.");
            return await uploadToLocalIPFS(file);
        }

        // --- Attempt 1: Extension Bridge ---
        const base64Data = await fileToBase64(file);

        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString() + Math.random().toString(16).slice(2);
            let hasResponded = false;

            const handleResponse = (event) => {
                if (event.data?.type === 'FROM_IPFS_TO_PAGE' && event.data?.requestId === requestId) {
                    hasResponded = true;
                    _extensionDetected = true; // Mark as detected
                    window.removeEventListener('message', handleResponse);
                    clearTimeout(detectionTimeoutId);

                    const payload = event.data.payload || {};
                    if (payload.success) {
                        console.log(`[IPFS Bridge] Extension Upload Success: ${payload.cid}`);
                        resolve(payload.cid);
                    } else {
                        console.warn("[IPFS Bridge] Extension reported an error. Trying local node fallback...", payload.error);
                        uploadToLocalIPFS(file).then(resolve).catch(reject);
                    }
                }
            };

            window.addEventListener('message', handleResponse);

            // Trigger Extension message
            window.postMessage({
                type: 'FROM_PAGE_TO_IPFS',
                command: 'UPLOAD_FILE',
                requestId: requestId,
                fileData: base64Data,
                fileName: file.name,
                fileType: file.type || 'application/octet-stream'
            }, '*');

            // Set a detection timeout to fallback if the extension doesn't answer at all
            const detectionTimeoutId = setTimeout(() => {
                if (!hasResponded) {
                    window.removeEventListener('message', handleResponse);
                    _extensionDetected = false; // Mark as missing for future calls
                    console.log("[IPFS Bridge] Extension detection timed out after 3s. Switching to Local Node flow.");
                    uploadToLocalIPFS(file).then(resolve).catch(reject);
                }
            }, EXTENSION_DETECTION_TIMEOUT);
        });
    },

    /**
     * Pins a file via the extension or local RPC
     */
    pinFile: (cid) => {
        // Extension attempt
        window.postMessage({ type: 'FROM_PAGE_TO_IPFS', command: 'PIN_FILE', cid: cid }, '*');
        
        // Local RPC attempt
        fetch(`http://127.0.0.1:5001/api/v0/pin/add?arg=${cid}`, { method: 'POST' })
            .catch(() => console.warn(`[IPFS Bridge] Local RPC pin failed for ${cid}`));
    }
};

export default ipfsBridge;
