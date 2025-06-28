const getPref = (key, defaultValue) => {
  try {
    const pref = UC_API.Prefs.get(key);
    if (!pref) return defaultValue;
    if (!pref.exists()) return defaultValue;
    return pref.value;
  } catch {
    return defaultValue;
  }
};

// Helper to create an HTML element from a string
const createHTMLElement = (htmlString) => {
  return new DOMParser().parseFromString(htmlString, "text/html").body
    .firstChild;
};

import windowManagerAPI from "./windowManager.js";
windowManagerAPI();

// prefs keys
const EXPANDED = "extension.findbar-ai.expanded";
const ENABLED = "extension.findbar-ai.enabled";
const API_KEY = "extension.findbar-ai.gemini-api-key";
const MODEL = "extension.findbar-ai.gemini-model";
const DEBUG_MODE = "extension.findbar-ai.debug-mode";

const debugLog = (...args) => {
  if (getPref(DEBUG_MODE, false)) {
    console.log("FindbarAI:", ...args);
  }
};

const debugError = (...args) => {
  if (getPref(DEBUG_MODE, false)) {
    console.error("FindbarAI Error:", ...args);
  }
};

// Available Gemini models
const AVAILABLE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-1.0-pro",
];

// set expanded to false initially
UC_API.Prefs.set(EXPANDED, false);

const findbar = {
  findbar: null,
  expandButton: null,
  chatContainer: null,
  apiKeyContainer: null,
  _updateFindbar: null,
  _addKeymaps: null,
  _handleExpandChange: null,

  get expanded() {
    return getPref(EXPANDED, false);
  },
  set expanded(value) {
    if (typeof value === "boolean") UC_API.Prefs.set(EXPANDED, value);
  },
  toggleExpanded() {
    this.expanded = !this.expanded;
  },
  handleExpandChange(expanded) {
    if (!this.findbar) return false;
    if (expanded.value) {
      this.show();
      this.showAIInterface();
    } else {
      this.hideAIInterface();
    }
    return true;
  },

  get enabled() {
    return getPref(ENABLED, true);
  },
  set enabled(value) {
    if (typeof value === "boolean") UC_API.Prefs.set(ENABLED, value);
  },
  toggleEnabled() {
    this.enabled = !this.enabled;
  },
  handleEnabledChange(enabled) {
    if (enabled.value) this.init();
    else this.destroy();
  },

  get apiKey() {
    return getPref(API_KEY, "");
  },
  set apiKey(value) {
    UC_API.Prefs.set(API_KEY, value || "");
  },

  get model() {
    return getPref(MODEL, "gemini-2.0-flash");
  },
  set model(value) {
    if (AVAILABLE_MODELS.includes(value)) {
      UC_API.Prefs.set(MODEL, value);
    }
  },

  updateFindbar() {
    this.removeExpandButton();
    this.removeAIInterface();
    gBrowser.getFindBar().then((findbar) => {
      this.findbar = findbar;
      this.addExpandButton();
    });
  },

  show() {
    if (!this.findbar) return false;
    this.findbar.hidden = false;
    if (!this.expanded) this.findbar._findField.focus();
    return true;
  },
  hide() {
    if (!this.findbar) return false;
    this.findbar.hidden = true;
    this.findbar.close();
    return true;
  },
  toggleVisibility() {
    if (!this.findbar) return;
    if (this.findbar.hidden) this.show();
    else this.hide();
  },

  async callGeminiAPI(prompt) {
    const apiKey = this.apiKey;
    const model = this.model;

    if (!apiKey) {
      throw new Error("API key not set");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      debugError(`API Error: ${response.status} - ${errorData}`);
      throw new Error(`API Error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received"
    );
  },

  createAPIKeyInterface() {
    const html = `
      <div class="findbar-ai-setup">
        <div class="ai-setup-content">
          <h3>Gemini AI Setup Required</h3>
          <p>To use AI features, you need a Gemini API key.</p>
          <div class="api-key-input-group">
            <input type="password" id="gemini-api-key" placeholder="Enter your Gemini API key" />
            <button id="save-api-key">Save</button>
          </div>
          <div class="api-key-links">
            <button id="get-api-key-link">Get API Key</button>
            <span>•</span>
            <button id="test-existing-key">Test Existing Key</button>
          </div>
        </div>
      </div>`;
    const container = createHTMLElement(html);

    const input = container.querySelector("#gemini-api-key");
    const saveBtn = container.querySelector("#save-api-key");
    const testBtn = container.querySelector("#test-existing-key");
    const getApiKeyLink = container.querySelector("#get-api-key-link");

    getApiKeyLink.addEventListener("click", () => {
      openTrustedLinkIn("https://aistudio.google.com/app/apikey", "tab");
    });

    if (this.apiKey) {
      input.value = this.apiKey;
    }

    saveBtn.addEventListener("click", () => {
      const key = input.value.trim();
      if (key) {
        this.apiKey = key;
        this.showAIInterface();
      }
    });

    testBtn.addEventListener("click", async () => {
      if (this.apiKey) {
        try {
          testBtn.textContent = "Testing...";
          await this.callGeminiAPI("Hello");
          this.showAIInterface();
        } catch (e) {
          alert("API key test failed: " + e.message);
        } finally {
          testBtn.textContent = "Test Existing Key";
        }
      }
    });

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        saveBtn.click();
      }
    });

    return container;
  },

  createChatInterface() {
    const html = `
      <div class="findbar-ai-chat">
        <div class="ai-chat-header">
          <select id="model-selector" class="model-selector">
            ${AVAILABLE_MODELS.map(
              (model) =>
                `<option value="${model}" ${
                  model === this.model ? "selected" : ""
                }>${model}</option>`
            ).join("")}
          </select>
          <button id="clear-chat" class="clear-chat-btn">Clear</button>
        </div>
        <div class="ai-chat-messages" id="chat-messages"></div>
        <div class="ai-chat-input-group">
          <textarea id="ai-prompt" placeholder="Ask AI anything..." rows="2"></textarea>
          <button id="send-prompt" class="send-btn">Send</button>
        </div>
      </div>`;
    const container = createHTMLElement(html);

    const modelSelector = container.querySelector("#model-selector");
    const chatMessages = container.querySelector("#chat-messages");
    const promptInput = container.querySelector("#ai-prompt");
    const sendBtn = container.querySelector("#send-prompt");
    const clearBtn = container.querySelector("#clear-chat");

    modelSelector.addEventListener("change", (e) => {
      this.model = e.target.value;
    });

    const sendMessage = async () => {
      const prompt = promptInput.value.trim();
      if (!prompt) return;

      this.addChatMessage(prompt, "user");
      promptInput.value = "";
      sendBtn.textContent = "Sending...";
      sendBtn.disabled = true;

      try {
        const response = await this.callGeminiAPI(prompt);
        this.addChatMessage(response, "ai");
      } catch (e) {
        this.addChatMessage(`Error: ${e.message}`, "error");
      } finally {
        sendBtn.textContent = "Send";
        sendBtn.disabled = false;
        promptInput.focus();
      }
    };

    sendBtn.addEventListener("click", sendMessage);

    promptInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    clearBtn.addEventListener("click", () => {
      chatMessages.innerHTML = "";
    });

    return container;
  },

  addChatMessage(content, type) {
    if (!this.chatContainer) return;

    const messagesContainer =
      this.chatContainer.querySelector("#chat-messages");
    if (!messagesContainer) return;

    const messageDiv = createHTMLElement(`<div class="chat-message chat-message-${type}"></div>`);
    const contentDiv = createHTMLElement(`<div class="message-content"></div>`);
    contentDiv.textContent = content;

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  showAIInterface() {
    if (!this.findbar) return;

    this.removeAIInterface();

    if (!this.apiKey) {
      this.apiKeyContainer = this.createAPIKeyInterface();
      this.findbar.insertBefore(this.apiKeyContainer, this.expandButton);
    } else {
      this.chatContainer = this.createChatInterface();
      this.findbar.insertBefore(this.chatContainer, this.expandButton);
      const promptInput = this.chatContainer.querySelector("#ai-prompt");
      if (promptInput) setTimeout(() => promptInput.focus(), 0);
    }
  },

  hideAIInterface() {
    this.removeAIInterface();
  },

  removeAIInterface() {
    if (this.apiKeyContainer) {
      this.apiKeyContainer.remove();
      this.apiKeyContainer = null;
    }
    if (this.chatContainer) {
      this.chatContainer.remove();
      this.chatContainer = null;
    }
  },

  init() {
    if (!this.enabled) return;
    this.updateFindbar();
    this.addListeners();
  },
  destroy() {
    this.findbar = null;
    this.expanded = false;
    this.removeListeners();
    this.removeExpandButton();
    this.removeAIInterface();
  },

  addExpandButton() {
    if (!this.findbar) return false;
    const button_id = "findbar-expand";
    if (this.findbar.getElement(button_id)) return true;
    const button = createHTMLElement(
      `<button id="${button_id}" anonid="${button_id}"></button>`
    );
    button.addEventListener("click", () => this.toggleExpanded());
    this.findbar.appendChild(button);
    this.expandButton = button;
    return true;
  },

  removeExpandButton() {
    if (!this.expandButton) return false;
    this.expandButton.remove();
    this.expandButton = null;
    return true;
  },

  addKeymaps: function (e) {
    if (
      e.key &&
      e.key.toLowerCase() === "f" &&
      e.ctrlKey &&
      e.shiftKey &&
      !e.altKey
    ) {
      e.preventDefault();
      e.stopPropagation();
      this.expanded = true;
    }

    if (e.key?.toLowerCase() === "escape") {
      if (this.expanded) {
        e.preventDefault();
        e.stopPropagation();
        this.expanded = false;
      } 
      // else {
      //   this.hide();
      // }
    }
  },

  addListeners() {
    this._updateFindbar = this.updateFindbar.bind(this);
    this._addKeymaps = this.addKeymaps.bind(this);
    this._handleExpandChange = this.handleExpandChange.bind(this);

    gBrowser.tabContainer.addEventListener("TabSelect", this._updateFindbar);
    document.addEventListener("keydown", this._addKeymaps);
    UC_API.Prefs.addListener(EXPANDED, this._handleExpandChange);
  },
  removeListeners() {
    gBrowser.tabContainer.removeEventListener("TabSelect", this._updateFindbar);
    document.removeEventListener("keydown", this._addKeymaps);
    UC_API.Prefs.removeListener(EXPANDED, this._handleExpandChange);

    this._updateFindbar = null;
    this._addKeymaps = null;
    this._handleExpandChange = null;
  },
};

findbar.init();
UC_API.Prefs.addListener(ENABLED, findbar.handleEnabledChange.bind(findbar));
window.findbar = findbar;
