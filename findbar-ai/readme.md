# Findbar AI for Zen Browser

Inspired by Arc Browser, this script transforms the standard findbar in **Zen Browser** into a modern, floating, AI-powered chat interface. It leverages Google's Gemini API to allow you to interact with and ask questions about the content of the current webpage.

## Demo

https://github.com/user-attachments/assets/258d2643-6135-4b2b-accc-c1d59f3f76fc

https://github.com/user-attachments/assets/73413ee0-15b6-4ef3-bc16-faa0302c622f

## Features

- **Modern, Floating UI**: Replaces the default findbar with a sleek, centered, and collapsible interface.
- **AI-Powered Chat**: Integrates Google's Gemini AI to provide a conversational experience.
- **Page Content Awareness**: The AI can read the text content of the current webpage to answer your questions accurately.
- **Buildin Keyboard Shortcuts**: Use the `Ctrl+Shift+F`, `alt+Enter` keymap to open findbar.
- **Customizable**: Many customization options from `about:config`.
- **AI Interacting with Browser**: AI can make tool calls to control the browser.
- **Context Menu**: Directoly ask question about current page to AI from context Menu.

## 🚨 Caution 🚨

- **Privacy**: To answer questions about a webpage, this script sends the text content of the page to Google's Gemini API. Please be aware of the privacy implications before using this feature on pages with sensitive information.
- **Heavy Development**: This is an experimental project and is under active development. Expect breaking changes, bugs, and frequent updates.

## Installation

### Method 1: Using `fx-autoconfig`

1.  **Setup `fx-autoconfig`**: If you haven't already, follow the setup instructions at [MrOtherGuy/fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig).

2.  **Clone this Repository**: Open a terminal or command prompt, navigate to the `js` directory created by `fx-autoconfig` inside your profile folder, and clone the repository with the name `custom`:

    ```bash
    git clone https://github.com/BibekBhusal0/zen-custom-js.git custom
    ```

3.  **Import the Script**: In your JS directory, inside `import.uc.js`, add the following line to import the script:

    ```javascript
    import "./custom/findbar-ai/findbar-ai.uc.js";
    ```

4.  **Import the Styles**: In your `userChrome.css` file, add the following line to import the required styles:

    ```css
    @import "js/custom/findbar-ai/style.css";
    ```

5.  **Restart Zen Browser**: Restart the browser for all changes to take effect. You might need to clear the startup cache from `about:support`.

### Method 2: Using Sine

[Sine](https://github.com/CosmoCreeper/Sine) is a modern userscript and theme manager. This script will be available on the Sine marketplace in a future update.

## Usage

1.  **Get an API Key**: After installation, the Findbar AI will prompt you for a Gemini API key. You can get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  **Save the Key**: Paste the key into the input field and click "Save". The chat interface will now appear.
3.  **Start Chatting**:
    - Press `Ctrl+F` to open the standard findbar.
    - Click the "Expand" button to switch to the AI chat view or enter your query and click on ask if you are in Minimal Mode.
    - Type your questions about the current page and press "Send".
    - Use `Ctrl+Shift+F` to open the AI chat directly, using any text you have selected on the page as the initial prompt.

## Customization

You can customize the Findbar AI via `about:config`.

### Preferences (`about:config`)

| Preference                                   | Type    | Default              | Description                                                                        |
| -------------------------------------------- | ------- | -------------------- | ---------------------------------------------------------------------------------- |
| `extension.findbar-ai.enabled`               | Boolean | `true`               | Toggles the entire feature on or off.                                              |
| `extension.findbar-ai.gemini-api-key`        | String  | _(empty)_            | **Required**. Your Google Gemini API key.                                          |
| `extension.findbar-ai.gemini-model`          | String  | `"gemini-2.0-flash"` | The specific Gemini model to use for chat.                                         |
| `extension.findbar-ai.context-menu-enabled`  | Boolean | `true`               | Weather or not to enable context menu item                                         |
| `extension.findbar-ai.context-menu-autosend` | Boolean | `true`               | When true, message is autometically send to AI after clicking in context menu item |
| `extension.findbar-ai.debug-mode`            | Boolean | `false`              | Set to `true` to enable verbose logging in the Browser Console.                    |
| `extension.findbar-ai.god-mode`              | Boolean | `false`              | When `true` AI can make tool calls.                                                |
| `extension.findbar-ai.citations-enabled`     | Boolean | `false`              | When `true` AI will give source where it the statement from (experimental).        |

> [!WARNING]
> Don't turn both god-mode and citation at the same time. AI might not function properly.

### Keymaps

| Shortcut       | Action                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `Ctrl+Shift+F` | Opens the findbar directly into the expanded AI mode.                                                       |
| `Escape`       | If the AI interface is expanded, it collapses to the standard findbar. If not expanded, closes the findbar. |
| `Alt + Enter`  | If findbar is not expanded, this expandes findbar while sending query from findbar to AI                    |

## Tool-calls

AI can also make tool calls to enable this go to `about:config` and set `extension.findbar-ai.god-mode`

Currently available tool calls are:

- **Search** : Searches specific term in search engines from browsers, and it can be open in `current tab`, `new tab`, `new window`, `incognito`, `glance`, `vsplit`, `hsplit`.
- **Open Link** : Opens link, and it can be open in `current tab`, `new tab`, `new window`, `incognito`, `glance`, `vsplit`, `hsplit`.
- **New Split** : Opens 2 tab it can be open it can be opened in `horizontal` or `vertical` split.
- **Get Page Text Content**: Returns text content.
- **Get HTML Content**: Returns entire HTML content of page.

More tools will be comming soon.

## Development Roadmap

- [x] Add styles to findbar
- [x] Make findbar collapsible
- [x] Custom keymaps for findbar
- [x] Basic chat
- [x] Integrating Gemini API
- [x] Reading current page HTML
- [x] Add Readme
- [x] Loading indicator
- [x] Improve system prompts
- [x] Markdown formatting
- [x] Minimal styles (like Arc Browser)
- [x] Highlight text in page that corresponds to AI's answer
- [ ] AI interacting with page content (filling forms, clicking buttons)
- [ ] Conformation before calling tools
- [x] Tool calls (opening links, changing workspaces)
- [ ] Browser management tools
- [ ] Add support for other AI models (Claude, OpenAI)
- [ ] Drag-and-drop to resize and move the findbar (optional)
- [ ] Pin/unpin the findbar (optional)
- [x] Context Menu integration
- [ ] Different themes (glass, light, dark, etc.)
- [ ] Smooth animations for all interactions
- [ ] Custom system prompts

## Credits

- **[CosmoCreeper](https://github.com/CosmoCreeper)**: For creating **Sine** and for the JSWindowActor pattern which made page content interaction possible.
- **[natsumi-browser](https://github.com/greeeen-dev/natsumi-browser)**: For inspiration on the modern, floating UI styles.
