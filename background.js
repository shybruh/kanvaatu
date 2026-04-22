// background.js
// This runs in the background and is NOT blocked by Temu/Amazon CSP.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchRates") {
        fetch("https://open.er-api.com/v6/latest/USD")
            .then(response => response.json())
            .then(data => {
                sendResponse({ success: true, rates: data.rates });
            })
            .catch(error => {
                console.error("Background Fetch Error:", error);
                sendResponse({ success: false, error: error.message });
            });
        
        // Return true to indicate we will send a response asynchronously
        return true;
    }
});