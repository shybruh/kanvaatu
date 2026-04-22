# Kanvaatu 💱

A lightweight Chrome extension that automatically converts prices on any website to your local currency — in real time, on every page.

---

## Features

- **Works on any website** — scans all visible prices and converts them automatically
- **Two display modes:**
  - **Replace** — swaps the original price with the converted amount in-place
  - **Hover** — keeps the original price, shows a tooltip with the converted amount on hover
- **160+ currencies supported** — powered by the [Open Exchange Rates API](https://open.er-api.com/)
- **Smart price detection** — handles both standard (`$10.99`) and split-node prices (common on sites like Amazon and Temu)
- **Strikethrough-aware** — skips crossed-out "original" prices so only the active price gets converted
- **Enable/disable toggle** — turn the extension on or off without changing your settings
- **Persists your settings** — currency preferences and display mode are saved across sessions

---

## Installation

> Chrome Web Store listing coming soon. For now, install manually:

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select the project folder
5. The Kanvaatu icon will appear in your toolbar

---

## Usage

1. Click the **Kanvaatu icon** in your Chrome toolbar
2. Select the **source currency** (the currency used on the website)
3. Select **your currency** (what you want prices converted to)
4. Choose a **display mode** — Replace or Hover
5. Click **Apply Settings** — the current tab reloads and prices are converted

---

## How It Works

| File | Role |
|---|---|
| `manifest.json` | Extension configuration (Manifest V3) |
| `background.js` | Service worker — fetches exchange rates (bypasses site CSPs) |
| `content.js` | Injected into every page — scans the DOM and converts prices |
| `popup.html/js` | Extension popup UI for settings |

**Rate fetching** is handled in the background service worker to avoid being blocked by Content Security Policies on sites like Amazon or Temu. The content script communicates with it via `chrome.runtime.sendMessage`.

**DOM scanning** uses a `TreeWalker` to efficiently walk all text nodes, detect price patterns via regex, and either replace them in-place or attach hover tooltips. A `WeakSet` tracks already-processed nodes to avoid duplicate conversions. The scanner runs every second using `requestIdleCallback` to catch dynamically loaded content without impacting page performance.

---

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your currency preferences |
| `activeTab` | Reload the current tab when settings are applied |
| `scripting` | Inject the content script into pages |
| `https://open.er-api.com/*` | Fetch live exchange rates |

## Contributing

Pull requests are welcome! If you find a site where price detection breaks, please open an issue with the URL and a screenshot.

---

## License

WTFPL
