let rates = {};
let fromCurrency = 'USD';
let toCurrency = 'MVR';
let fromSymbol = '$';
let toSymbol = 'Rf';
let conversionRate = 1;
let isRunning = false;
let displayMode = 'replace'; // 'replace' or 'hover'
let processedNodes = new WeakSet();
let priceElements = new WeakMap(); // Store price info for hover mode

// 1. Initialize
chrome.storage.local.get(['fromCurrency', 'toCurrency', 'extensionEnabled', 'displayMode'], async (result) => {
    if (result.extensionEnabled === false) {
        console.log("[Currency Converter] Extension is Disabled.");
        return; 
    }

    fromCurrency = result.fromCurrency || 'USD';
    toCurrency = result.toCurrency || 'MVR';
    displayMode = result.displayMode || 'replace';

    if (fromCurrency === toCurrency) return;

    // Fetch Rates
    chrome.runtime.sendMessage({ action: "fetchRates" }, (response) => {
        if (response && response.success) {
            rates = response.rates;
            initConversion();
        }
    });
});

function initConversion() {
    fromSymbol = getSymbolForCurrency(fromCurrency);
    toSymbol = getSymbolForCurrency(toCurrency);
    
    if (rates[fromCurrency] && rates[toCurrency]) {
        conversionRate = (1 / rates[fromCurrency]) * rates[toCurrency];
        console.log(`[Currency Converter] Rate: 1 ${fromCurrency} = ${conversionRate.toFixed(4)} ${toCurrency}`);
        console.log(`[Currency Converter] Display Mode: ${displayMode}`);
        // Start the engine
        setTimeout(startPulse, 2000);
    }
}

function getSymbolForCurrency(currencyCode) {
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode });
    const parts = formatter.formatToParts(1);
    const symbolPart = parts.find(part => part.type === 'currency');
    return symbolPart ? symbolPart.value : currencyCode;
}

// 2. The Scanner
function scanAndConvert() {
    if (!document.body) return;

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                if (!node.parentElement) return NodeFilter.FILTER_REJECT;
                
                // Skip our own clones
                if (node.parentElement.classList.contains('currency-converter-clone')) {
                    return NodeFilter.FILTER_REJECT;
                }
                
                // Skip already processed nodes
                if (processedNodes.has(node)) {
                    return NodeFilter.FILTER_REJECT;
                }

                const tag = node.parentElement.tagName;
                if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE'].includes(tag)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );

    const nodes = [];
    let node;
    while (node = walker.nextNode()) {
        nodes.push(node);
    }

    // Process nodes - look for currency patterns
    for (let i = 0; i < nodes.length; i++) {
        processNode(nodes[i], i, nodes);
    }
}

function processNode(node, index, allNodes) {
    if (processedNodes.has(node)) return;
    
    const text = node.nodeValue.trim();
    if (!text) return;
    
    // Check if this element or any parent (up to 3 levels) has strikethrough
    let element = node.parentElement;
    let hasStrikethrough = false;
    let level = 0;
    
    while (element && level < 3) {
        const style = window.getComputedStyle(element);
        if (style.textDecoration.includes('line-through') || 
            style.textDecorationLine.includes('line-through') ||
            element.style.textDecoration.includes('line-through')) {
            hasStrikethrough = true;
            break;
        }
        element = element.parentElement;
        level++;
    }
    
    if (hasStrikethrough) {
        processedNodes.add(node);
        return;
    }
    
    const escapedSymbol = fromSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // SCENARIO A: Complete price in one node "$10.99" or "$10"
    const standardRegex = new RegExp(`^${escapedSymbol}\\s?(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?)$`);
    const matchA = text.match(standardRegex);

    if (matchA) {
        const value = parseFloat(matchA[1].replace(/,/g, ''));
        if (!isNaN(value) && value > 0) {
            if (displayMode === 'hover') {
                addHoverTooltip(node, value);
            } else {
                updateInterface(node, value, true);
            }
            processedNodes.add(node);
        }
        return;
    }

    // SCENARIO B: Split price - symbol in one node, number in following nodes
    // Pattern: "$" -> "50" -> "." -> "15"  OR  "$" -> "50.15"
    if (text === fromSymbol) {
        let priceStr = '';
        let nodesToHide = [node]; // Start with the symbol node
        
        // Look ahead to collect all number-related nodes
        for (let j = index + 1; j < allNodes.length && j < index + 10; j++) {
            const nextNode = allNodes[j];
            const nextText = nextNode.nodeValue ? nextNode.nodeValue.trim() : '';
            
            // Stop if we hit non-numeric content (but allow dots and commas)
            if (!nextText || !/^[\d,\.]+$/.test(nextText)) {
                break;
            }
            
            priceStr += nextText;
            nodesToHide.push(nextNode);
            
            // If we have a complete number with cents, we can stop
            if (/^\d+\.\d{2}$/.test(priceStr.replace(/,/g, ''))) {
                break;
            }
        }
        
        // Parse the collected price string
        if (priceStr) {
            const value = parseFloat(priceStr.replace(/,/g, ''));
            if (!isNaN(value) && value > 0) {
                if (displayMode === 'hover') {
                    // In hover mode, mark these nodes for hover functionality
                    const container = node.parentElement;
                    if (container) {
                        addHoverTooltipToContainer(container, value, nodesToHide);
                    }
                } else {
                    // Replace mode: Hide all the original nodes
                    nodesToHide.forEach(n => {
                        updateInterface(n, 0, false);
                        processedNodes.add(n);
                    });
                    
                    // Show converted price on the first node's parent
                    const convertedText = formatCurrency(value * conversionRate, toCurrency);
                    createConvertedDisplay(nodesToHide[0].parentElement, convertedText);
                }
                
                nodesToHide.forEach(n => processedNodes.add(n));
            }
        }
    }
}

// HOVER MODE: Add tooltip functionality
function addHoverTooltip(node, priceValue) {
    const parent = node.parentElement;
    if (!parent) return;
    
    console.log('[Hover] Adding hover tooltip for price:', priceValue);
    
    // Store price info
    priceElements.set(parent, priceValue);
    
    // Add hover class for cursor indication
    parent.classList.add('currency-converter-hoverable');
    
    // Remove existing listeners to avoid duplicates
    parent.removeEventListener('mouseenter', showTooltip);
    parent.removeEventListener('mouseleave', hideTooltip);
    
    // Add event listeners
    parent.addEventListener('mouseenter', showTooltip);
    parent.addEventListener('mouseleave', hideTooltip);
    
    console.log('[Hover] Event listeners attached to:', parent);
}

function addHoverTooltipToContainer(container, priceValue, nodes) {
    if (!container) return;
    
    console.log('[Hover] Adding hover tooltip to container for price:', priceValue);
    
    // Store price info
    priceElements.set(container, priceValue);
    
    // Add hover class
    container.classList.add('currency-converter-hoverable');
    
    // Remove existing listeners
    container.removeEventListener('mouseenter', showTooltip);
    container.removeEventListener('mouseleave', hideTooltip);
    
    // Add event listeners
    container.addEventListener('mouseenter', showTooltip);
    container.addEventListener('mouseleave', hideTooltip);
    
    console.log('[Hover] Event listeners attached to container:', container);
}

function showTooltip(event) {
    const element = event.currentTarget;
    const priceValue = priceElements.get(element);
    if (!priceValue) {
        console.log('[Hover] No price value found for element');
        return;
    }
    
    console.log('[Hover] Showing tooltip for price:', priceValue);
    
    // Check if tooltip already exists
    const tooltipId = `tooltip-${element.dataset.priceId || Date.now()}`;
    let tooltip = document.querySelector(`[data-tooltip-id="${tooltipId}"]`);
    
    if (tooltip) {
        console.log('[Hover] Reusing existing tooltip');
        tooltip.style.display = 'block';
        // Update position
        const rect = element.getBoundingClientRect();
        tooltip.style.left = (rect.left + rect.width / 2) + 'px';
        tooltip.style.top = (rect.top - 8) + 'px';
        return;
    }
    
    // Create tooltip
    const convertedValue = formatCurrency(priceValue * conversionRate, toCurrency);
    console.log('[Hover] Creating new tooltip with value:', convertedValue);
    
    tooltip = document.createElement('div');
    tooltip.className = 'currency-converter-tooltip';
    tooltip.textContent = convertedValue;
    tooltip.dataset.tooltipId = tooltipId;
    
    // Store tooltip ID on element
    if (!element.dataset.priceId) {
        element.dataset.priceId = Date.now();
    }
    
    // Position relative to element
    const rect = element.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - 8) + 'px';
    
    // Append to body to escape parent stacking context
    document.body.appendChild(tooltip);
    console.log('[Hover] Tooltip appended to body');
}

function hideTooltip(event) {
    const element = event.currentTarget;
    const priceId = element.dataset.priceId;
    
    if (priceId) {
        const tooltipId = `tooltip-${priceId}`;
        const tooltip = document.querySelector(`[data-tooltip-id="${tooltipId}"]`);
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
}

function formatCurrency(value, currency) {
    try {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: currency, 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }).format(value);
    } catch (e) {
        // Fallback if currency code is invalid
        return `${currency} ${value.toFixed(2)}`;
    }
}

// REPLACE MODE: Display converted price
function createConvertedDisplay(originalParent, convertedText) {
    if (!originalParent) return;
    
    // Check if we already created a clone for this parent
    let clone = originalParent.nextElementSibling;
    if (clone && clone.classList.contains('currency-converter-clone')) {
        // Update existing clone
        if (clone.textContent !== convertedText) {
            clone.textContent = convertedText;
        }
        return;
    }
    
    // Create new converted display
    clone = document.createElement('span');
    clone.classList.add('currency-converter-clone');
    clone.textContent = convertedText;
    clone.style.cssText = originalParent.style.cssText; // Copy styles
    
    // Hide original parent
    originalParent.style.visibility = 'hidden';
    originalParent.style.position = 'absolute';
    
    // Insert clone
    originalParent.parentNode.insertBefore(clone, originalParent.nextSibling);
}

function updateInterface(originalNode, priceValue, showPrice) {
    const parent = originalNode.parentElement;
    if (!parent) return;

    if (!showPrice) {
        // Just hide this node
        parent.style.visibility = 'hidden';
        parent.style.position = 'absolute';
        return;
    }

    // Format the converted price
    const convertedText = formatCurrency(priceValue * conversionRate, toCurrency);

    // Check if we already have a clone
    let clone = parent.nextElementSibling;
    const isClone = clone && clone.classList.contains('currency-converter-clone');

    if (isClone) {
        // Update existing
        if (clone.textContent !== convertedText) {
            clone.textContent = convertedText;
        }
    } else {
        // Create new clone
        parent.style.visibility = 'hidden';
        parent.style.position = 'absolute';

        clone = parent.cloneNode(true);
        clone.classList.add('currency-converter-clone');
        clone.textContent = convertedText;
        clone.style.visibility = 'visible';
        clone.style.position = 'static';
        
        parent.after(clone);
    }
}

// 4. Pulse Engine
function startPulse() {
    if (isRunning) return;
    isRunning = true;

    // CSS for both modes
    const style = document.createElement('style');
    style.textContent = `
        /* Replace mode styles */
        .currency-converter-clone {
            display: inline-block !important; 
            visibility: visible !important;
            position: static !important;
        }
        
        /* Hover mode styles */
        .currency-converter-hoverable {
            cursor: help !important;
        }
        
        .currency-converter-tooltip {
            position: fixed;
            transform: translate(-50%, -100%);
            display: block;
            padding: 6px 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 13px;
            font-weight: 600;
            border-radius: 14px;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            animation: slideDown 0.2s ease-out;
            z-index: 2147483647 !important;
            pointer-events: none;
        }
        
        /* Arrow pointing down */
        .currency-converter-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #764ba2;
        }
        
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translate(-50%, calc(-100% - 4px));
            }
            to {
                opacity: 1;
                transform: translate(-50%, -100%);
            }
        }
    `;
    document.head.appendChild(style);

    // Hide tooltips on scroll/resize (they'll reappear on next hover)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        document.querySelectorAll('.currency-converter-tooltip').forEach(tooltip => {
            tooltip.style.display = 'none';
        });
    }, true);

    setInterval(() => {
        window.requestIdleCallback(() => {
            scanAndConvert();
        }, { timeout: 1000 });
    }, 1000); 
    
    scanAndConvert();
}