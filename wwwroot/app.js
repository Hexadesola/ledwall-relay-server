const state = {
    snapshot: null,
    selectedBoardIds: new Set(),
    red: 128,
    green: 128,
    blue: 128,
    speed: 100,
    pattern: 1
};

// Cloud server URL - change this to your Railway URL after deployment
// For local testing, use empty string or "http://localhost:3000"
// For cloud, use your Railway URL like "https://your-app.railway.app"
const CLOUD_SERVER_URL = ""; 

const API_BASE = CLOUD_SERVER_URL;

async function init() {
    console.log("Initializing app...");
initSliders();
    initButtons();
    initColorPicker();
    initMasterSwitch();
    initModals();
    addLogosToModals();
    await refreshState();
    // Use SignalR for real-time updates if available, otherwise polling
    initSignalR().then(() => {
        console.log("SignalR connected successfully");
    }).catch(err => {
        console.log("SignalR not available, using polling:", err.message);
        setInterval(refreshState, 500);
    });
}

function initSliders() {
    const sliderIds = ["redSlider", "greenSlider", "blueSlider", "speedSlider", "patternSelect", "intervalSlider"];
    sliderIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id.includes("Slider")) {
            el.addEventListener("input", e => {
                if (id === "intervalSlider") {
                    const seconds = parseInt(e.target.value);
                    const minutes = seconds / 60;
                    const display = minutes >= 1 ? `${minutes.toFixed(1)} min` : `${seconds} sec`;
                    const valueEl = document.getElementById("intervalValue");
                    if (valueEl) valueEl.textContent = display;
                    postApi("/api/auto/interval", { seconds: seconds });
                } else {
                    const key = id.replace("Slider", "").toLowerCase();
                    state[key] = parseInt(e.target.value);
                    updateColorPreview();
                }
            });
        } else if (id === "patternSelect") {
            el.addEventListener("change", e => { state.pattern = parseInt(e.target.value); });
        }
    });
}

function initButtons() {
    // All buttons and menu options with data-action attribute
    document.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            handleAction(btn.dataset.action);
        });
    });
    document.querySelectorAll("[data-show]").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();
            postApi("/api/shows/start", { name: btn.dataset.show });
        });
    });
    document.querySelectorAll("[data-r]").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();
            state.red = parseInt(btn.dataset.r);
            state.green = parseInt(btn.dataset.g);
            state.blue = parseInt(btn.dataset.b);
            state.pattern = 1;
            updateSliders();
            updateColorPreview();
            broadcastAll();
        });
    });
    const rb = document.querySelector("[data-rainbow]");
    if (rb) {
        rb.addEventListener("click", e => {
            e.preventDefault();
            state.pattern = 4;
            state.speed = 120;
            const ps = document.getElementById("patternSelect");
            const ss = document.getElementById("speedSlider");
            if (ps) ps.value = "4";
            if (ss) ss.value = "120";
            broadcastAll();
        });
    }
}

function updateViewMenuState(isPanelVisible) {
    const showItem = document.querySelector('[data-action="showLedsPanel"]');
    const hideItem = document.querySelector('[data-action="hideLedsPanel"]');
    if (showItem && hideItem) {
        showItem.classList.toggle("disabled", isPanelVisible);
        hideItem.classList.toggle("disabled", !isPanelVisible);
    }
}

function initColorPicker() {
    const modal = document.getElementById("colorPickerModal");
    if (!modal) return;
    const picker = document.getElementById("colorPickerInput");
    const pickBtn = document.querySelector("[data-action=\"pickColor\"]");
    const closeBtn = document.getElementById("closeColorPicker");
    const applyBtn = document.getElementById("applyColorPicker");
    const cancelBtn = document.getElementById("cancelColorPicker");
    if (pickBtn) {
        pickBtn.addEventListener("click", e => {
            e.preventDefault();
            if (picker) picker.value = rgbToHex(state.red, state.green, state.blue);
            modal.classList.add("show");
        });
    }
    if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.remove("show"));
    if (cancelBtn) cancelBtn.addEventListener("click", () => modal.classList.remove("show"));
    if (applyBtn) {
        applyBtn.addEventListener("click", e => {
            e.preventDefault();
            const rgb = hexToRgb(picker.value);
            state.red = rgb.r;
            state.green = rgb.g;
            state.blue = rgb.b;
            updateSliders();
            updateColorPreview();
            modal.classList.remove("show");
        });
    }
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("show"); });
}

function initMasterSwitch() {
    const ms = document.getElementById("masterSwitch");
    if (ms) {
        ms.addEventListener("change", async () => {
            await postApi("/api/master/set", { status: ms.checked ? "ON" : "OFF" });
        });
    }
}

async function handleAction(action) {
    switch (action) {
        case "allLightsOn": await postApi("/api/relays/all-lights", { isOn: true }); break;
        case "allLightsOff": await postApi("/api/relays/all-lights", { isOn: false }); break;
        case "frontLightsOn": await postApi("/api/relays/front-lights", { isOn: true }); break;
        case "frontLightsOff": await postApi("/api/relays/front-lights", { isOn: false }); break;
        case "backLightsOn": await postApi("/api/relays/back-lights", { isOn: true }); break;
        case "backLightsOff": await postApi("/api/relays/back-lights", { isOn: false }); break;
        case "allDevicesOn": await postApi("/api/relays/all-devices", { isOn: true }); break;
        case "allDevicesOff": await postApi("/api/relays/all-devices", { isOn: false }); break;
        case "frontDevicesOn": await postApi("/api/relays/front-devices", { isOn: true }); break;
        case "frontDevicesOff": await postApi("/api/relays/front-devices", { isOn: false }); break;
        case "backDevicesOn": await postApi("/api/relays/back-devices", { isOn: true }); break;
        case "backDevicesOff": await postApi("/api/relays/back-devices", { isOn: false }); break;
        case "allLedsOn": await postApi("/api/leds/all-on", { pattern: 1, speed: 100, r: 255, g: 255, b: 255 }); break;
        case "allLedOff": await postApi("/api/leds/off", {}); break;
        case "autoModeOn": await postApi("/api/auto/on", {}); break;
        case "autoModeOff": await postApi("/api/auto/off", {}); break;
        case "applySelected": await applyToSelected(); break;
        case "broadcastAll": await broadcastAll(); break;
        case "stopShow": await postApi("/api/shows/stop", {}); break;
        // File menu
        case "exit": openModal("exitConfirmModal"); break;
        case "exitConfirm": 
            closeModal("exitConfirmModal");
            alert("Please close this browser window to exit.");
            break;
        case "cancelExit": closeModal("exitConfirmModal"); break;
        // View menu
        case "showLedsPanel": 
            document.getElementById("ledBoardLayoutPanel").style.display = "block";
            updateViewMenuState(true);
            break;
        case "hideLedsPanel": 
            document.getElementById("ledBoardLayoutPanel").style.display = "none";
            updateViewMenuState(false);
            break;
        // Tools menu
        case "refreshPorts": openModal("refreshPortsModal"); break;
        case "masterOn": await postApi("/api/master/set", { status: "ON" }); break;
        case "masterOff": await postApi("/api/master/set", { status: "OFF" }); break;
        case "allRelaysOff": 
            await postApi("/api/relays/all-lights", { isOn: false }); 
            await postApi("/api/relays/all-devices", { isOn: false }); 
            break;
        // Help menu
        case "quickStart": openModal("quickStartModal"); break;
        case "videoHelp": openModal("videoModal"); break;
        case "connectionHelp": openModal("connectionHelpModal"); break;
        case "idMap": openModal("idMapModal"); break;
        case "operatorTips": openModal("operatorTipsModal"); break;
        case "about": openModal("aboutModal"); break;
    }
}


function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("show");
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("show");
    }
}

// Add logo to all modal headers
function addLogosToModals() {
    const logoHtml = '<img src="tribe_of_judah_logo_small_no_bg.png" alt="ToJ" style="height: 28px; vertical-align: middle; margin-right: 0px;" onerror="this.style.display=\'none\'">';
    document.querySelectorAll(".modal-header h3").forEach(h3 => {
        if (!h3.querySelector("img")) {
            h3.innerHTML = logoHtml + h3.innerHTML;
        }
    });
}

function initModals() {
    // Quick Start Modal
    document.getElementById("closeQuickStartModal")?.addEventListener("click", () => closeModal("quickStartModal"));
    document.getElementById("closeQuickStartModalBtn")?.addEventListener("click", () => closeModal("quickStartModal"));
    
    // Connection Help Modal
    document.getElementById("closeConnectionHelpModal")?.addEventListener("click", () => closeModal("connectionHelpModal"));
    document.getElementById("closeConnectionHelpModalBtn")?.addEventListener("click", () => closeModal("connectionHelpModal"));
    
    // ID Map Modal
    document.getElementById("closeIdMapModal")?.addEventListener("click", () => closeModal("idMapModal"));
    document.getElementById("closeIdMapModalBtn")?.addEventListener("click", () => closeModal("idMapModal"));
    
    // Operator Tips Modal
    document.getElementById("closeOperatorTipsModal")?.addEventListener("click", () => closeModal("operatorTipsModal"));
    document.getElementById("closeOperatorTipsModalBtn")?.addEventListener("click", () => closeModal("operatorTipsModal"));
    
    // About Modal
    document.getElementById("closeAboutModal")?.addEventListener("click", () => closeModal("aboutModal"));
    document.getElementById("closeAboutModalBtn")?.addEventListener("click", () => closeModal("aboutModal"));
    
    // Refresh Ports Modal
    document.getElementById("closeRefreshPortsModal")?.addEventListener("click", () => closeModal("refreshPortsModal"));
    document.getElementById("closeRefreshPortsModalBtn")?.addEventListener("click", () => closeModal("refreshPortsModal"));
    
    // Video Modal
    document.getElementById("closeVideoModal")?.addEventListener("click", () => {
        document.getElementById("howItWorksVideo")?.pause();
        closeModal("videoModal");
    });
    document.getElementById("closeVideoModalBtn")?.addEventListener("click", () => {
        document.getElementById("howItWorksVideo")?.pause();
        closeModal("videoModal");
    });
    
    // No Boards Selected Modal
    document.getElementById("closeNoBoardsModal")?.addEventListener("click", () => closeModal("noBoardsModal"));
    document.getElementById("closeNoBoardsModalBtn")?.addEventListener("click", () => closeModal("noBoardsModal"));
    
    // Exit Confirmation Modal
    document.getElementById("confirmExitBtn")?.addEventListener("click", () => handleAction("exitConfirm"));
    document.getElementById("cancelExitBtn")?.addEventListener("click", () => handleAction("cancelExit"));
    document.getElementById("closeExitModal")?.addEventListener("click", () => handleAction("cancelExit"));
    
    // Initialize View menu state
    updateViewMenuState(true);
    
    // Close modals when clicking outside
    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", e => {
            if (e.target === modal) {
                document.getElementById("howItWorksVideo")?.pause();
                modal.classList.remove("show");
            }
        });
    });
}

function refreshPortsList() {
    const list = document.getElementById("comPortsList");
    if (list) {
        list.textContent = "Scanning...";
        setTimeout(() => {
            list.textContent = "No COM ports detected. Connect a device and try again.";
        }, 1000);
    }
}
        //});
   // });
//}

async function applyToSelected() {
    if (state.selectedBoardIds.size === 0) { openModal("noBoardsModal"); return; }
    await postApi("/api/leds/apply", { 
        boardIds: Array.from(state.selectedBoardIds), 
        pattern: state.pattern, 
        speed: state.speed, 
        r: state.red, 
        g: state.green, 
        b: state.blue 
    });
    // Update selected LED bars locally
    updateSelectedLedBars();
}

async function broadcastAll() {
    await postApi("/api/leds/broadcast", { 
        pattern: state.pattern, 
        speed: state.speed, 
        r: state.red, 
        g: state.green, 
        b: state.blue 
    });
    // Fill all LED bars with current colour
    fillAllLedBars();
}

function fillAllLedBars() {
    const bc = `rgb(${state.red},${state.green},${state.blue})`;
    for (let i = 1; i <= 15; i++) {
        const bar = document.getElementById("ledBar" + i);
        if (bar) bar.style.backgroundColor = bc;
    }
}

function updateSelectedLedBars() {
    const bc = `rgb(${state.red},${state.green},${state.blue})`;
    for (let i = 0; i < 15; i++) {
        const bar = document.getElementById("ledBar" + (i + 1));
        if (bar && state.selectedBoardIds.has(_barToSlaveId[i])) {
            bar.style.backgroundColor = bc;
        }
    }
}

const _barToSlaveId = [15, 5, 4, 3, 2, 1, 13, 16, 12, 10, 9, 8, 7, 6, 14];

function updateColorPreview() {
    // Update thin color preview bar only
    const bc = `rgb(${state.red},${state.green},${state.blue})`;
    const colorPreview = document.getElementById("colorPreview");
    if (colorPreview) colorPreview.style.backgroundColor = bc;
}



/*
            }
        }
    }
}
*/



function initLedBars() {
    for (let i = 0; i < 15; i++) {
        const bar = document.getElementById("ledBar" + (i + 1));
        if (bar) {
            bar.addEventListener("click", () => {
                const boardId = _barToSlaveId[i];
                if (state.selectedBoardIds.has(boardId)) {
                    state.selectedBoardIds.delete(boardId);
                    bar.classList.remove("selected");
                } else {
                    state.selectedBoardIds.add(boardId);
                    bar.classList.add("selected");
                }
                postApi("/api/boards/toggle", { boardId: boardId });
                // Update corresponding board card
                const boardCard = document.querySelector('[data-board-id="' + boardId + '"]');
                if (boardCard) {
                    if (state.selectedBoardIds.has(boardId)) {
                        boardCard.classList.add("selected");
                    } else {
                        boardCard.classList.remove("selected");
                    }
                }
            });
        }
    }
}

function updateSliders() {
    const m = { redSlider: "red", greenSlider: "green", blueSlider: "blue", speedSlider: "speed", patternSelect: "pattern" };
    Object.keys(m).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = state[m[id]];
    });
}

async function refreshState() {
    try {
        console.log("Fetching /api/state...");
        const r = await fetch(API_BASE + "/api/state");
        console.log("Response status:", r.status);
        if (!r.ok) return;
        const data = await r.json();
        console.log("State data:", data);
        state.snapshot = data;
        renderStatus(data);
        renderRelays(data);
        renderBoards(data);
        renderShowStatus(data);
    } catch (e) { 
        console.error("Refresh error:", e); 
    }
}

// SignalR for real-time updates (local) or Socket.IO (cloud)
let hubConnection = null;
let socket = null;

async function initSignalR() {
    // Use Socket.IO for cloud connection, SignalR for local
    if (CLOUD_SERVER_URL) {
        // Load Socket.IO client
        const script = document.createElement("script");
        script.src = CLOUD_SERVER_URL + "/socket.io/socket.io.js";
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
        });
        
        // Connect to cloud server
        socket = io(CLOUD_SERVER_URL);
        
        socket.on('connect', () => {
            console.log('Connected to cloud server');
            socket.emit('register', 'browser');
        });
        
        socket.on('wpfStatus', (data) => {
            console.log('WPF status:', data.connected ? 'connected' : 'disconnected');
        });
        
        socket.on('stateChanged', (data) => {
            state.snapshot = data;
            renderStatus(data);
            renderRelays(data);
            renderBoards(data);
            renderShowStatus(data);
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from cloud server');
        });
        
        console.log('Using cloud server:', CLOUD_SERVER_URL);
    } else {
        // Use local SignalR
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.0/signalr.min.js";
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
        });
        
        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl("/controlHub")
            .withAutomaticReconnect()
            .build();
        
        hubConnection.on("stateChanged", (data) => {
            state.snapshot = data;
            renderStatus(data);
            renderRelays(data);
            renderBoards(data);
            renderShowStatus(data);
        });
        
        await hubConnection.start();
        console.log("SignalR connected (local)");
    }
}

function renderStatus(data) {
    const st = document.getElementById("statusText");
    const cb = document.getElementById("connectionBadge");
    const sd = document.getElementById("statusDot");
    
    // Update connection status
    if (st) st.textContent = data.connectionText || (data.isConnected ? `Connected to ${data.selectedPortName}` : "Searching for controller...");
    if (cb) {
        cb.textContent = data.isConnected ? "Connected" : "Disconnected";
        cb.className = "connection-badge " + (data.isConnected ? "connected" : "disconnected");
        cb.style.backgroundColor = data.isConnected ? "#c1f4d4" : "#f4cccc";
    }
    if (sd) {
        sd.className = "status-dot " + (data.isConnected ? "connected" : "disconnected");
        sd.style.backgroundColor = data.isConnected ? "#019939" : "#b07104";
    }
    
    // Update port display
    const portEl = document.getElementById("currentPort");
    if (portEl) {
        portEl.textContent = data.isConnected ? (data.selectedPortName || "None") : "None";
    }
    
    // Gray out inactive buttons based on relay states
    updateButtonStates(data.relays, data);
    
    // Update Master Control indicators - 3 states: ON (green), MIXED (amber), OFF (gray)
    const allLightsIndicator = document.getElementById("allLightsIndicator");
    const allDevicesIndicator = document.getElementById("allDevicesIndicator");
    const allLedsIndicator = document.getElementById("allLedsIndicator");
    const autoModeIndicator = document.getElementById("autoModeIndicator");
    const masterStatusEl = document.getElementById("masterStatus");
    
    // Helper to set indicator class based on on/mixed/off state
    function setIndicatorState(el, isOn, isMixed) {
        if (!el) return;
        el.className = "indicator";
        if (isOn) el.classList.add("on");
        else if (isMixed) el.classList.add("mixed");
    }
    
    setIndicatorState(allLightsIndicator, data.allLightsOn, data.allLightsMixed);
    setIndicatorState(allDevicesIndicator, data.allDevicesOn, data.allDevicesMixed);
    setIndicatorState(allLedsIndicator, data.allLedsOn, data.allLedsMixed);
    setIndicatorState(autoModeIndicator, data.isAutoModeEnabled, false);
    
    // Update master status text
    if (masterStatusEl) {
        masterStatusEl.textContent = "Master: " + (data.masterStatus || "OFF");
    }
    
    // Update selected board IDs
    if (data.boards) {
        state.selectedBoardIds = new Set(data.boards.filter(b => b.isSelected).map(b => b.id));
        // Update LED bars based on selected boards using mapping
        for (let i = 0; i < 15; i++) {
            const bar = document.getElementById("ledBar" + (i + 1));
            if (bar) {
                if (state.selectedBoardIds.has(_barToSlaveId[i])) {
                    bar.classList.add("selected");
                } else {
                    bar.classList.remove("selected");
                }
            }
        }
    }
    
    // Update LED bars with board colours if available (for light shows)
    if (data.boards) {
        for (let i = 0; i < 15; i++) {
            const bar = document.getElementById("ledBar" + (i + 1));
            if (bar) {
                const slaveId = _barToSlaveId[i];
                const board = data.boards.find(b => b.id === slaveId);
                if (board && board.r !== undefined) {
                    bar.style.backgroundColor = `rgb(${board.r},${board.g},${board.b})`;
                }
            }
        }
    }
    updateColorPreview();
    
    // Update master toggle switch color based on state
    const ms = document.getElementById("masterSwitch");
    if (ms) {
        const slider = ms.parentElement.querySelector(".slider");
        if (slider) {
            const status = (data.masterStatus || "OFF").toUpperCase();
            if (status === "ON") {
                slider.style.backgroundColor = "#00C800"; // green
            } else if (status === "MIXED") {
                slider.style.backgroundColor = "#FFBF00"; // amber
            } else {
                slider.style.backgroundColor = "#6B7280"; // gray
            }
        }
    }
}


function updateButtonStates(relays, data) {
    if (!data) return;
    
    const frontLights = relays ? relays.filter(r => r.id >= 17 && r.id <= 20) : [];
    const backLights = relays ? relays.filter(r => r.id >= 23 && r.id <= 26) : [];
    const frontDevices = relays ? relays.filter(r => r.id >= 21 && r.id <= 22) : [];
    const backDevices = relays ? relays.filter(r => r.id >= 27 && r.id <= 28) : [];
    
    // All Lights: 17-20 (front), 23-26 (back)
    const allLights = [...frontLights, ...backLights];
    const allLightsOn = allLights.length > 0 && allLights.every(r => r.isOn);
    const allLightsOff = allLights.length > 0 && allLights.every(r => !r.isOn);
    
    // All Devices: 21-22 (front), 27-28 (back)
    const allDevices = [...frontDevices, ...backDevices];
    const allDevicesOn = allDevices.length > 0 && allDevices.every(r => r.isOn);
    const allDevicesOff = allDevices.length > 0 && allDevices.every(r => !r.isOn);
    
    // Master Control button states from data
    const masterActionMap = {
        "allLightsOn": data.allLightsOn === true,
        "allLightsOff": data.allLightsOn === false && data.allLightsMixed !== true,
        "allDevicesOn": data.allDevicesOn === true,
        "allDevicesOff": data.allDevicesOn === false && data.allDevicesMixed !== true,
        "allLedsOn": data.allLedsOn === true,
        "allLedOff": data.allLedsOn === false && data.allLedsMixed !== true,
        "autoModeOn": data.isAutoModeEnabled === true,
        "autoModeOff": data.isAutoModeEnabled === false
    };
    
    // Front/Back button states
    const frontBackActionMap = {
        "frontLightsOn": frontLights.length > 0 && frontLights.every(r => r.isOn),
        "frontLightsOff": frontLights.length > 0 && frontLights.every(r => !r.isOn),
        "backLightsOn": backLights.length > 0 && backLights.every(r => r.isOn),
        "backLightsOff": backLights.length > 0 && backLights.every(r => !r.isOn),
        "frontDevicesOn": frontDevices.length > 0 && frontDevices.every(r => r.isOn),
        "frontDevicesOff": frontDevices.length > 0 && frontDevices.every(r => !r.isOn),
        "backDevicesOn": backDevices.length > 0 && backDevices.every(r => r.isOn),
        "backDevicesOff": backDevices.length > 0 && backDevices.every(r => !r.isOn)
    };
    
    const actionMap = { ...masterActionMap, ...frontBackActionMap };
    
    document.querySelectorAll("[data-action]").forEach(btn => {
        const action = btn.dataset.action;
        if (actionMap.hasOwnProperty(action)) {
            const isActive = actionMap[action];
            btn.classList.toggle("active", isActive);
            btn.disabled = isActive;
            btn.style.opacity = isActive ? "0.6" : "1";
        }
    });
}

function renderRelays(data) {
    if (!data.relays) return;
    
    const containerMap = {
        frontLightRelays: "Front Lights",
        frontDeviceRelays: "Front Devices", 
        backLightRelays: "Back Lights",
        backDeviceRelays: "Back Devices"
    };
    
    Object.keys(containerMap).forEach(key => {
        const container = document.getElementById(key);
        if (!container) return;
        const group = containerMap[key];
        const relays = data.relays.filter(r => r.group === group);
        container.innerHTML = relays.map(r => createRelayHTML(r)).join("");
        
        container.querySelectorAll(".btn-on").forEach(b => {
            b.addEventListener("click", e => { 
                e.preventDefault(); 
                const id = parseInt(b.dataset.relayId);
                postApi("/api/relays/" + id, { isOn: true });
            });
        });
        container.querySelectorAll(".btn-off").forEach(b => {
            b.addEventListener("click", e => { 
                e.preventDefault(); 
                const id = parseInt(b.dataset.relayId);
                postApi("/api/relays/" + id, { isOn: false });
            });
        });
    });
}

function createRelayHTML(relay) {
    const c = relay.isOn ? "#22C55E" : "#9CA3AF";
    return `<div class="relay-item">
        <div class="relay-indicator" style="background:${c}"></div>
        <span>${relay.name}</span>
        <div class="btn-group">
            <button class="btn btn-on btn-sm" data-relay-id="${relay.id}" ${relay.isOn ? 'disabled' : ''}>ON</button>
            <button class="btn btn-off btn-sm" data-relay-id="${relay.id}" ${!relay.isOn ? 'disabled' : ''}>OFF</button>
        </div>
    </div>`;
}

function renderBoards(data) {
    if (!data.boards) return;
    
    // Update selected boards summary
    const selectedBoardsSummary = document.getElementById("selectedBoardsSummary");
    if (selectedBoardsSummary) {
        const selectedBoards = data.boards.filter(b => state.selectedBoardIds.has(b.id));
        if (selectedBoards.length > 0) {
            selectedBoardsSummary.textContent = selectedBoards.map(b => b.name).join(", ");
            selectedBoardsSummary.style.color = "#FFBF00";
        } else {
            selectedBoardsSummary.textContent = "No boards selected";
            selectedBoardsSummary.style.color = "#9CA3AF";
        }
    }
    
    const groupMap = {
        leftSoloBoards: "Left Solo",
        leftMainBoards: "Left Main",
        hangingSnakeBoards: "Hanging Snake",
        floorSnakeBoards: "Floor Snake",
        rightMainBoards: "Right Main",
        rightSoloBoards: "Right Solo"
    };
    
    Object.keys(groupMap).forEach(key => {
        const container = document.getElementById(key);
        if (!container) return;
        const group = groupMap[key];
        let boards = data.boards.filter(b => b.group === group);
        
        // Reverse order for Left Main and Right Main stacks
        if (group === "Left Main" || group === "Right Main") {
            boards = boards.sort((a, b) => {
                const aNum = parseInt(a.name.replace(/\D/g, ''));
                const bNum = parseInt(b.name.replace(/\D/g, ''));
                return bNum - aNum; // descending order
            });
        }
        
        container.innerHTML = boards.map(b => createBoardHTML(b)).join("");
        
        container.querySelectorAll(".board-card").forEach(bc => {
            bc.addEventListener("click", e => { 
                e.preventDefault(); 
                const id = parseInt(bc.dataset.boardId);
                // Toggle board selection via API
                postApi("/api/boards/toggle", { boardId: id });
                // Update LED bar immediately for better UX
                if (state.selectedBoardIds.has(id)) {
                    state.selectedBoardIds.delete(id);
                    bc.classList.remove("selected");
                } else {
                    state.selectedBoardIds.add(id);
                    bc.classList.add("selected");
                }
                // Find and update corresponding LED bar
                const barIndex = _barToSlaveId.indexOf(id);
                if (barIndex >= 0) {
                    const ledBar = document.getElementById("ledBar" + (barIndex + 1));
                    if (ledBar) {
                        if (state.selectedBoardIds.has(id)) {
                            ledBar.classList.add("selected");
                        } else {
                            ledBar.classList.remove("selected");
                        }
                    }
                }
            });
        });
    });
}

function createBoardHTML(board) {
    const selected = state.selectedBoardIds.has(board.id) ? "selected" : "";
    const color = board.pattern === 0 ? "#6B7280" : `rgb(${board.r},${board.g},${board.b})`;
    return `<div class="board-card ${selected}" data-board-id="${board.id}">
        <div class="board-name">${board.name}</div>
        <div class="board-color" style="background:${color}"></div>
        <div class="board-subtitle">${board.pattern === 0 ? "Off" : "On"}</div>
    </div>`;
}

function renderShowStatus(data) {
    const ss = document.getElementById("lightShowStatus");
    if (ss) ss.textContent = data.lightShowStatus || "Show: Off";
}

async function postApi(url, body) {
    try {
        const r = await fetch(API_BASE + url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const j = await r.json();
        console.log("API:", url, j);
    } catch (e) { console.error("API error:", e); }
}

function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, "0")).join("");
}

function hexToRgb(h) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 128, g: 128, b: 128 };
}

document.addEventListener("DOMContentLoaded", init);