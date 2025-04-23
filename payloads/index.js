// Combined and Finalized JavaScript Code for Advanced Extension Toolkit

// --- Error Handling (Simplified) ---
window.onerror = function (message, source, lineno, colno, error) {
    console.error("Error:", message, "at", source, lineno, ":", colno, error);
    const errorDiv = document.getElementById('global-error-display');
    if (errorDiv) {
        errorDiv.textContent = `Error: ${message}`;
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
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        return await response.arrayBuffer();
    } catch (error) {
        console.error(`readFile failed for "${path}":`, error);
        // Re-throw a simpler error for the UI handler
        throw new Error(`Could not read file "${path}": ${error.message}`);
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
    mainLayout: `
        <div id="global-error-display" style="color: red; background-color: #fee; padding: 10px; border: 1px solid red; display: none; margin-bottom: 15px; white-space: pre-wrap;"></div>
        <h1>Advanced Extension Toolkit</h1>
        <div id="app-container">
            <!-- Sections will be injected here -->
        </div>
         <div id="notes-section" style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 0.9em; color: #555;">
            <p>Use features like code evaluation and file access responsibly.</p>
        </div>
    `,
    management: `
        <div id="management-section" class="feature-section">
            <h2>Extension Management</h2>
            <input type="text" id="ext-search" placeholder="Search extensions..." style="width: calc(80% - 90px); margin-bottom: 10px; padding: 5px;">
            <button id="report-csv-btn" title="Download extension list as CSV" style="padding: 5px 10px;">Report CSV</button>
            <div id="ext-list-container" style="max-height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 5px; min-height: 50px;">
                Loading...
            </div>
        </div>
    `,
    scripting: `
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
    `,
    fileViewer: `
        <div id="file-viewer-section" class="feature-section">
            <h2>File Content Viewer (Read-Only)</h2>
            <input type="text" id="file-path-input" placeholder="Enter absolute file path..." style="width: calc(100% - 100px);">
            <button id="view-file-btn">View File</button>
            <div id="file-content-output" style="margin-top: 10px; border: 1px solid #ccc; padding: 10px; max-height: 400px; overflow: auto; background: #f8f8f8; min-height: 50px;">
                Enter path and click view. File access may be restricted.
            </div>
        </div>
    `,
     reenroll: `
         <div id="reenroll-section" class="feature-section">
             <h2>Re-enrollment Data Package</h2>
             <button id="forreenroll">Attempt Download Zip</button>
             <p id="reenroll-status" style="font-size: 0.9em; margin-top: 5px; color: #333;"></p>
         </div>
    `,
    systemInfo: `
         <div id="system-info-section" class="feature-section">
             <h2>System Information</h2>
             <pre id="platform-info" style="background-color: #eee; padding: 5px; border: 1px solid #ddd; white-space: pre-wrap; word-wrap: break-word;"></pre>
         </div>
    `
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
            this.listElement.innerHTML = `<span style="color:red;">Error loading extensions: ${error.message}</span>`;
            displayGlobalError(`Failed to load extensions: ${error.message}`);
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
        table.innerHTML = `<thead><tr style="text-align: left; border-bottom: 1px solid #ccc;">
            <th style="padding: 4px;">Status</th>
            <th style="padding: 4px;">Name</th>
            <th style="padding: 4px;">ID</th>
            <th style="padding: 4px;">Type</th>
            <th style="padding: 4px;">Version</th>
            <th style="padding: 4px;">Actions</th>
           </tr></thead>`;
        const tbody = document.createElement('tbody');

        filteredExtensions.forEach(ext => {
            const row = tbody.insertRow();
            row.style.borderBottom = '1px solid #eee';

            const statusCell = row.insertCell(); statusCell.style.padding = '4px';
            const statusToggle = document.createElement('button');
            statusToggle.textContent = ext.enabled ? 'Enabled' : 'Disabled';
            statusToggle.style.color = ext.enabled ? 'green' : 'grey';
            statusToggle.style.cursor = 'pointer';
            statusToggle.title = ext.mayDisable ? `Click to ${ext.enabled ? 'disable' : 'enable'}` : 'Cannot be changed';
            statusToggle.disabled = !ext.mayDisable;
            if (!ext.mayDisable) statusToggle.style.cursor = 'not-allowed';

            statusToggle.addEventListener('click', async () => {
                statusToggle.disabled = true; statusToggle.textContent = '...';
                try {
                    await chromePromise(chrome.management.setEnabled, ext.id, !ext.enabled);
                    setTimeout(() => this.loadExtensions(), 200); // Refresh list
                } catch (error) {
                    console.error(`Error toggling ${ext.id}:`, error);
                    displayGlobalError(`Failed to toggle ${ext.name}: ${error.message}`);
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
            uninstallButton.title = ext.mayDisable ? `Uninstall ${ext.name}` : 'Cannot uninstall';
            uninstallButton.disabled = !ext.mayDisable;
             if (!ext.mayDisable) uninstallButton.style.cursor = 'not-allowed';

            uninstallButton.addEventListener('click', async () => {
                 // No confirmation as requested implicitly by "don't worry"
                 uninstallButton.disabled = true; uninstallButton.textContent = '...';
                 try {
                    await chromePromise(chrome.management.uninstall, ext.id, { showConfirmDialog: false }); // Use API confirmation=false
                    setTimeout(() => this.loadExtensions(), 200);
                 } catch(error) {
                     console.error(`Error uninstalling ${ext.id}:`, error);
                     displayGlobalError(`Failed to uninstall ${ext.name}: ${error.message}`);
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
        const header = "ID,Name,Version,Enabled,InstallType,MayDisable\n";
        const csvContent = header + this.allExtensions
            .filter(ext => ext.id !== chrome.runtime.id)
            .map(ext => [
                `"${ext.id}"`, `"${ext.name.replace(/"/g, '""')}"`, `"${ext.version}"`,
                ext.enabled, `"${ext.installType}"`, ext.mayDisable
            ].join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `chrome_extensions_report_${Date.now()}.csv`;
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
                outputText += '// Console logs:\n' + logMessages.join('\n') + '\n\n';
            }
             outputText += '// Return value:\n';
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
            this.outputPre.textContent = `// Evaluation Error:\n${error.stack || error.message}`;
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
             displayGlobalError(`Script "${name}" ${isOverwrite ? 'updated' : 'saved'}.`); // Simple status
             setTimeout(clearGlobalError, 2000); // Clear status after a bit
        } catch (error) {
             console.error("Error saving script:", error);
             displayGlobalError(`Failed to save script "${name}": ${error.message}`);
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
            displayGlobalError(`Script "${name}" deleted.`);
             setTimeout(clearGlobalError, 2000);
        } catch (error) {
             console.error("Error deleting script:", error);
             displayGlobalError(`Failed to delete script "${name}": ${error.message}`);
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
                     const regexPattern = '^' + targetUrlPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
                     if (new RegExp(regexPattern).test(activeTab.url)) {
                         matches = true;
                     }
                 } catch (e) { console.error("Invalid pattern?", e); } // Ignore invalid patterns for simplicity
                  if (!matches) {
                      displayGlobalError(`Active tab URL does not match pattern. Skipped.`);
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
             displayGlobalError(`Example script injected into active tab.`);
             setTimeout(clearGlobalError, 2000);

         } catch (error) {
             console.error("Error injecting script:", error);
             displayGlobalError(`Injection failed: ${error.message}`);
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
            this.outputDiv.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
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
             this.statusP.textContent = `Reading ${baseName}...`;
             try {
                 const buffer = await readFile(f); // Global func
                 zip.file(baseName, buffer);
                 filesAdded++;
             } catch (error) {
                 this.statusP.textContent = `Skipped ${baseName}.`;
                 console.error(`Failed to read/add ${f}:`, error);
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

         this.statusP.textContent = `Generating zip (${filesAdded} file(s))...`;
         try {
             const blob = await zip.generateAsync({ type: "blob" });
             const url = URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url;
             a.download = `reenrollment_data_${Date.now()}.zip`;
             a.style.display = 'none';
             document.body.appendChild(a);
             a.click();
             document.body.removeChild(a);
             URL.revokeObjectURL(url);
             this.statusP.textContent = `Download started (${filesAdded} file(s)).`;
         } catch (error) {
             console.error("Error generating/downloading zip:", error);
             this.statusP.textContent = `Error generating zip: ${error.message}`;
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

             let infoText = `--- Platform ---\n`;
             infoText += `OS: ${platformInfo.os}\n`;
             infoText += `Arch: ${platformInfo.arch}\n`;
             infoText += `NaCl Arch: ${platformInfo.nacl_arch}\n\n`;

             infoText += `--- Browser ---\n`;
             infoText += `Chrome Version: ${navigator.appVersion.match(/Chrome\/([\d.]+)/)?.[1] || 'N/A'}\n`;
             infoText += `User Agent: ${navigator.userAgent}\n\n`;

             infoText += `--- This Extension (${manifest.name} v${manifest.version}) ---\n`;
             infoText += `ID: ${chrome.runtime.id}\n`;
             infoText += `Permissions: ${manifest.permissions?.join(', ') || '(none)'}\n`;
             infoText += `Host Permissions: ${manifest.host_permissions?.join(', ') || '(none)'}`;


             this.infoPre.textContent = infoText;
         } catch (error) {
             console.error("Error getting system info:", error);
             this.infoPre.textContent = `Error loading info: ${error.message}`;
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
              console.error(`Failed to initialize section ${section.id}:`, e);
              displayGlobalError(`Error initializing section: ${section.id}`);
              const errorPlaceholder = document.createElement('div');
              errorPlaceholder.style.color = 'red';
              errorPlaceholder.textContent = `Failed to load ${section.id.replace('-container','')}. Check console.`;
              sectionDiv.appendChild(errorPlaceholder);
         }
     });


     // Add CSS dynamically
     const style = document.createElement('style');
     style.textContent = `
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
     `;
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
