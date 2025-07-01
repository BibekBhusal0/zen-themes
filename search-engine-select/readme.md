# Search Engine Select

Search Engine Select is a user script for **Zen Browser** that adds a floating UI to switch search engines directly from a search results page. This script provides an easy and intuitive way to quickly perform the same search on different engines.

## Demo

https://github.com/user-attachments/assets/52a6b810-77ee-4a04-b239-8d59e01478ef

## Features

- Automatically detects the current search engine and search term.
- A floating UI that can be repositioned vertically by dragging.
- Quick search engine switching with various interaction modes:
  - **Left-click:** Search in the current tab.
  - **Right-click:** Open search in a background tab.
  - **Ctrl+Click:** Open in a new tab and create a Split View.
  - **Alt+Click:** Open search in a Glance view.
- Favicon support with Google Favicon API fallback.
- Responsive pop-up menu that opens above or below the UI to stay on screen.

## Usage

- After installation, perform a search on any engine (e.g., Google, DuckDuckGo). The floating switcher UI will appear on the results right side of page.
- The UI displays the icon of the current search engine.
- **Click on the UI** to open a list of all your other installed search engines.
- **Click an engine** from the list with different mouse combinations to perform the same search there.
- **Drag the handle** on the right side of the UI to move it up or down the page.

## Customization

You can customize the script's behavior via `about:config`.

| Preference                                         | Type    | Default | Description                                                                       |
| -------------------------------------------------- | ------- | ------- | --------------------------------------------------------------------------------- |
| `extension.search-engine-select.enabled`           | Boolean | `true`  | Toggles the entire feature on or off in real-time (no need to restart).           |
| `extension.search-engine-select.remember-position` | Boolean | `true`  | If `true`, the vertical position of the UI will be saved between sessions.        |
| `extension.search-engine-select.y-coor`            | String  | `"60%"` | Stores the last y coordinate position. This is managed automatically.             |
| `extension.search-engine-select.debug-mode`        | Boolean | `false` | Set to `true` to enable detailed logging in the Browser Console (`Ctrl+Shift+J`). |
