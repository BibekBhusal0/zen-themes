import windowManager, { windowManagerAPI } from "./windowManager.js";
import getPref from "../utils/getPref.mjs";
windowManager();

const createHTMLElement = (htmlString) => {
  return new DOMParser().parseFromString(htmlString, "text/html").body
    .firstChild;
};

// prefs keys
const EXPANDED = "extension.findbar-ai.expanded";
const ENABLED = "extension.findbar-ai.enabled";
const API_KEY = "extension.findbar-ai.gemini-api-key";
const MODEL = "extension.findbar-ai.gemini-model";
const DEBUG_MODE = "extension.findbar-ai.debug-mode";

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

const gemini = {
  history: [],
  systemInstruction: null,

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
    UC_API.Prefs.set(MODEL, value);
  },

  get apiUrl() {
    const model = this.model;
    if (!model) return null;
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  },

  setSystemPrompt(promptText) {
    if (promptText) {
      this.systemInstruction = { parts: [{ text: promptText }] };
    } else {
      this.systemInstruction = null;
    }
    return this;
  },

  async sendMessage(prompt) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("Prompt must be a non-empty string.");
    }
    const apiKey = this.apiKey;
    const apiUrl = this.apiUrl;
    if (!apiKey || !apiUrl) {
      throw new Error(
        "Gemini client not configured. API key and model are required.",
      );
    }

    this.history.push({ role: "user", parts: [{ text: prompt }] });

    const requestBody = {
      contents: this.history,
    };

    if (this.systemInstruction) {
      requestBody.systemInstruction = this.systemInstruction;
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API Error: ${response.status} - ${errorData.error.message}`,
        );
      }

      const data = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        this.history.pop();
        return "The model did not return a response. This could be due to safety settings or other issues.";
      }

      const modelResponseText = data.candidates[0].content.parts[0].text;
      this.history.push({
        role: "model",
        parts: [{ text: modelResponseText }],
      });

      return modelResponseText;
    } catch (error) {
      this.history.pop();
      throw error;
    }
  },

  getHistory() {
    return [...this.history];
  },

  clearHistory() {
    this.history = [];
    return this;
  },

  getLastMessage() {
    return this.history.length > 0
      ? this.history[this.history.length - 1]
      : null;
  },
};

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

  updateFindbar() {
    this.removeExpandButton();
    this.removeAIInterface();
    this.expanded = false;
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
          </div>
        </div>
      </div>`;
    const container = createHTMLElement(html);

    const input = container.querySelector("#gemini-api-key");
    const saveBtn = container.querySelector("#save-api-key");
    const getApiKeyLink = container.querySelector("#get-api-key-link");

    getApiKeyLink.addEventListener("click", () => {
      openTrustedLinkIn("https://aistudio.google.com/app/apikey", "tab");
    });

    if (gemini.apiKey) {
      input.value = gemini.apiKey;
    }

    saveBtn.addEventListener("click", () => {
      const key = input.value.trim();
      if (key) {
        gemini.apiKey = key;
        this.showAIInterface();
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
        `<option value="${model}" ${model === gemini.model ? "selected" : ""
        }>${model}</option>`,
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
      gemini.model = e.target.value;
    });

    const sendMessage = async () => {
      const prompt = promptInput.value.trim();
      if (!prompt) return;

      this.addChatMessage(prompt, "user");
      promptInput.value = "";
      sendBtn.textContent = "Sending...";
      sendBtn.disabled = true;

      try {
        const response = await gemini.sendMessage(prompt);
        this.addChatMessage(response, "ai");
      } catch (e) {
        this.addChatMessage(`Error: ${e.message}`, "error");
      } finally {
        sendBtn.textContent = "Send";
        sendBtn.disabled = false;
        this.focusPrompt();
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
      gemini.clearHistory();
    });

    return container;
  },

  addChatMessage(content, type) {
    if (!this.chatContainer) return;

    const messagesContainer =
      this.chatContainer.querySelector("#chat-messages");
    if (!messagesContainer) return;

    const messageDiv = createHTMLElement(
      `<div class="chat-message chat-message-${type}"></div>`,
    );
    const contentDiv = createHTMLElement(`<div class="message-content"></div>`);
    contentDiv.textContent = content;

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  showAIInterface() {
    if (!this.findbar) return;

    this.removeAIInterface();

    if (!gemini.apiKey) {
      this.apiKeyContainer = this.createAPIKeyInterface();
      this.findbar.insertBefore(this.apiKeyContainer, this.expandButton);
    } else {
      this.chatContainer = this.createChatInterface();
      this.findbar.insertBefore(this.chatContainer, this.expandButton);
      this.focusPrompt();
    }
  },

  focusInput() {
    if (this.findbar) setTimeout(() => this.findbar._findField.focus(), 10);
  },
  focusPrompt() {
    const promptInput = this.chatContainer?.querySelector("#ai-prompt");
    if (promptInput) setTimeout(() => promptInput.focus(), 10);
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
      `<button id="${button_id}" anonid="${button_id}"></button>`,
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

  addKeymaps: function(e) {
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
      this.focusPrompt();
      windowManagerAPI.getSelectedText().then((selection) => {
        if (!selection || !selection.hasSelection || !this.chatContainer)
          return;
        const promptInput = this.chatContainer.querySelector("#ai-prompt");
        if (promptInput) {
          promptInput.value = selection.selectedText;
        }
      });
    }

    if (e.key?.toLowerCase() === "escape") {
      if (this.expanded) {
        e.preventDefault();
        e.stopPropagation();
        this.expanded = false;
        this.focusInput();
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
