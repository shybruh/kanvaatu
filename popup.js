const API_URL = "https://open.er-api.com/v6/latest/USD";
const fromSelect = document.getElementById('fromCurrency');
const toSelect = document.getElementById('toCurrency');
const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');
const masterSwitch = document.getElementById('masterSwitch');
const modeReplace = document.getElementById('modeReplace');
const modeHover = document.getElementById('modeHover');

document.addEventListener('DOMContentLoaded', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Loading...";

    try {
        // 1. Fetch Currencies
        const response = await fetch(API_URL);
        const data = await response.json();
        const currencies = Object.keys(data.rates);
        
        const options = currencies.map(code => `<option value="${code}">${code}</option>`).join('');
        fromSelect.innerHTML = options;
        toSelect.innerHTML = options;

        // 2. Load Saved Settings (Currency + Enabled State + Display Mode)
        chrome.storage.local.get(['fromCurrency', 'toCurrency', 'extensionEnabled', 'displayMode'], (result) => {
            if (result.fromCurrency) fromSelect.value = result.fromCurrency;
            else fromSelect.value = 'USD'; 
            
            if (result.toCurrency) toSelect.value = result.toCurrency;
            else toSelect.value = 'MVR'; 

            // Handle Display Mode
            const displayMode = result.displayMode || 'replace';
            if (displayMode === 'hover') {
                modeHover.checked = true;
            } else {
                modeReplace.checked = true;
            }

            // Handle Enabled/Disabled State
            // Default to TRUE (enabled) if it's the first run
            const isEnabled = result.extensionEnabled !== false; 
            masterSwitch.checked = isEnabled;
            toggleUI(isEnabled);
        });
        
        saveBtn.disabled = false;
        saveBtn.textContent = "APPLY SETTINGS";
        
    } catch (error) {
        saveBtn.textContent = "Error";
        statusDiv.textContent = "Check internet connection";
        statusDiv.classList.add('show');
    }
});

// Helper to gray out UI
function toggleUI(isEnabled) {
    if (isEnabled) {
        document.body.classList.remove('disabled');
        saveBtn.disabled = false;
    } else {
        document.body.classList.add('disabled');
        saveBtn.disabled = true;
    }
}

// 3. Handle Toggle Click
masterSwitch.addEventListener('change', () => {
    const isEnabled = masterSwitch.checked;
    toggleUI(isEnabled);
    
    // Save state immediately
    chrome.storage.local.set({ extensionEnabled: isEnabled }, () => {
        // Reload page to stop/start script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) chrome.tabs.reload(tabs[0].id);
        });
    });
});

// 4. Handle Save Button
saveBtn.addEventListener('click', () => {
    const from = fromSelect.value;
    const to = toSelect.value;
    const displayMode = modeHover.checked ? 'hover' : 'replace';
    
    saveBtn.textContent = "SAVED!";
    saveBtn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)"; 
    statusDiv.textContent = "Reloading page...";
    statusDiv.classList.add('show');

    chrome.storage.local.set({ 
        fromCurrency: from, 
        toCurrency: to,
        displayMode: displayMode
    }, () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) chrome.tabs.reload(tabs[0].id);
        });
        setTimeout(() => window.close(), 1000);
    });
});