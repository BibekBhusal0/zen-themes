import windowManager, { windowManagerAPI } from "./windowManager.js";
import { markedStyles } from "chrome://userscripts/content/engine/marked.js";
import getPref from "../utils/getPref.mjs";
import gemini from "./gemini.js";
windowManager();

const createHTMLElement = (htmlString) => {
  let element = new DOMParser().parseFromString(htmlString, "text/html");
  if (element.body.children.length) element = element.body.firstChild;
  else element = element.head.firstChild;
  return element;
};

// prefs keys
const ENABLED = "extension.findbar-ai.enabled";
const MINIMAL = "extension.findbar-ai.minimal";
const GOD_MODE = "extension.findbar-ai.god-mode";
const CITATIONS_ENABLED = "extension.findbar-ai.citations-enabled";

//default configurations
UC_API.Prefs.setIfUnset(MINIMAL, true);
UC_API.Prefs.setIfUnset(CITATIONS_ENABLED, false); // experimental

var markdownStylesInjected = false;
const injectMarkdownStyles = () => {
  if (!markedStyles) return false;
  try {
    const styleTag = createHTMLElement(`<style>${markedStyles}<style>`);
    document.head.appendChild(styleTag);
    markdownStylesInjected = true;
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
};

function parseMD(markdown) {
  const markedOptions = { breaks: true, gfm: true };
  if (!markdownStylesInjected) {
    injectMarkdownStyles();
  }
  const content = window.marked
    ? window.marked.parse(markdown, markedOptions)
    : markdown;
  let htmlContent = createHTMLElement(
    `<div class="markdown-body">${content}</div>`,
  );

  return htmlContent;
}

const findbar = {
  findbar: null,
  expandButton: null,
  chatContainer: null,
  apiKeyContainer: null,
  _updateFindbar: null,
  _addKeymaps: null,
  _handleInputKeyPress: null,
  _handleGodModeChange: null,
  _handleCitationChange: null,
  _isExpanded: false,

  get expanded() {
    return this._isExpanded;
  },
  set expanded(value) {
    this._isExpanded = value;
    if (!this.findbar) return;

    if (this._isExpanded) {
      this.findbar.classList.add("ai-expanded");
      this.show();
      this.showAIInterface();
      this.focusPrompt();
      const messagesContainer =
        this?.chatContainer?.querySelector("#chat-messages");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } else {
      this.findbar.classList.remove("ai-expanded");
      this.hideAIInterface();
    }
  },
  toggleExpanded() {
    this.expanded = !this.expanded;
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

  get minimal() {
    return getPref(MINIMAL, true);
  },
  set minimal(value) {
    if (typeof value === "boolean") UC_API.Prefs.set(MINIMAL, value);
  },

  updateFindbar() {
    this.removeExpandButton();
    this.removeAIInterface();
    this.hide();
    if (!gemini.godMode) {
      gemini.setSystemPrompt(null);
      gemini.clearHistory();
    }
    gBrowser.getFindBar().then((findbar) => {
      this.findbar = findbar;
      this.addExpandButton();
      this.findbar._findField.addEventListener(
        "keypress",
        this._handleInputKeyPress,
      );
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
    if (gemini.apiKey) input.value = gemini.apiKey;
    saveBtn.addEventListener("click", () => {
      const key = input.value.trim();
      if (key) {
        gemini.apiKey = key;
        this.showAIInterface();
      }
    });
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") saveBtn.click();
    });
    return container;
  },

  async sendMessage(prompt) {
    const container = this.chatContainer;
    if (!container || !prompt) return;

    const promptInput = container.querySelector("#ai-prompt");
    const sendBtn = container.querySelector("#send-prompt");

    const pageContext = {
      url: gBrowser.currentURI.spec,
      title: gBrowser.selectedBrowser.contentTitle,
    };

    this.addChatMessage({ answer: prompt }, "user");
    if (promptInput) promptInput.value = "";
    if (sendBtn) {
      sendBtn.textContent = "Sending...";
      sendBtn.disabled = true;
    }

    const loadingIndicator = this.createLoadingIndicator();
    const messagesContainer =
      this.chatContainer.querySelector("#chat-messages");
    if (messagesContainer) {
      messagesContainer.appendChild(loadingIndicator);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    try {
      const response = await gemini.sendMessage(prompt, pageContext);
      if (response && response.answer) {
        this.addChatMessage(response, "ai");
      }
    } catch (e) {
      this.addChatMessage({ answer: `Error: ${e.message}` }, "error");
    } finally {
      loadingIndicator.remove();
      if (sendBtn) {
        sendBtn.textContent = "Send";
        sendBtn.disabled = false;
      }
      this.focusPrompt();
    }
  },

  createChatInterface() {
    const modelOptions = gemini.AVAILABLE_MODELS.map((model) => {
      const displayName =
        model.charAt(0).toUpperCase() + model.slice(1).replace(/-/g, " ");
      return `<option value="${model}" ${model === gemini.model ? "selected" : ""
        }>${displayName}</option>`;
    }).join("");

    const html = `
      <div class="findbar-ai-chat">
        <div class="ai-chat-header">
          <select id="model-selector" class="model-selector">${modelOptions}</select>
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
    const handleSend = () => this.sendMessage(promptInput.value.trim());
    sendBtn.addEventListener("click", handleSend);
    promptInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    clearBtn.addEventListener("click", () => {
      container.querySelector("#chat-messages").innerHTML = "";
      gemini.setSystemPrompt(null);
      gemini.clearHistory();
    });

    chatMessages.addEventListener("click", async (e) => {
      if (e.target.classList.contains("citation-link")) {
        const button = e.target;
        const citationId = button.dataset.citationId;
        const messageEl = button.closest(".chat-message[data-citations]");

        if (messageEl) {
          const citations = JSON.parse(messageEl.dataset.citations);
          const citation = citations.find((c) => c.id == citationId);
          if (citation && citation.source_quote) {
            let prefix = citation.prefix_context || "";
            let suffix = citation.suffix_context || "";

            if (prefix.endsWith(citation.source_quote))
              prefix = prefix.slice(0, -citation.source_quote.length);
            if (suffix.startsWith(citation.source_quote))
              suffix = suffix.slice(citation.source_quote.length);

            const searchText = prefix + citation.source_quote + suffix;

            console.log(
              `[findbar-ai] Citation [${citationId}] clicked. Requesting highlight for:`,
              searchText,
            );
            await windowManagerAPI.highlightAndScrollToText(searchText);
          }
        }
      }
    });

    return container;
  },

  createLoadingIndicator() {
    const messageDiv = createHTMLElement(
      `<div class="chat-message chat-message-loading"></div>`,
    );
    const contentDiv = createHTMLElement(
      `<div class="message-content">Loading...</div>`,
    );
    messageDiv.appendChild(contentDiv);
    return messageDiv;
  },

  addChatMessage(response, type) {
    const { answer, citations } = response;
    if (!this.chatContainer || !answer) return;
    const messagesContainer =
      this.chatContainer.querySelector("#chat-messages");
    if (!messagesContainer) return;

    const messageDiv = createHTMLElement(
      `<div class="chat-message chat-message-${type}"></div>`,
    );
    if (citations && citations.length > 0) {
      messageDiv.dataset.citations = JSON.stringify(citations);
    }

    const contentDiv = createHTMLElement(`<div class="message-content"></div>`);
    const processedContent = answer.replace(
      /\[(\d+)\]/g,
      `<button class="citation-link" data-citation-id="$1">[$1]</button>`,
    );
    contentDiv.appendChild(parseMD(processedContent));

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
      const history = gemini.getHistory();
      for (const message of history) {
        if (
          message.role === "tool" ||
          (message.parts && message.parts.some((p) => p.functionCall))
        )
          continue;

        const isModel = message.role === "model";
        const textContent = message.parts[0].text;
        if (!textContent) continue;

        let responsePayload = {};

        if (isModel && gemini.citationsEnabled) {
          try {
            responsePayload = JSON.parse(textContent);
          } catch (e) {
            responsePayload = { answer: textContent };
          }
        } else {
          responsePayload.answer = textContent.replace(
            /\[Current Page Context:.*?\]\s*/,
            "",
          );
        }

        if (responsePayload.answer) {
          this.addChatMessage(responsePayload, isModel ? "ai" : "user");
        }
      }
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
  setPromptText(text) {
    const promptInput = this?.chatContainer?.querySelector("#ai-prompt");
    if (promptInput && text) promptInput.value = text;
  },
  async setPromptTextFromSelection() {
    let text = "";
    const selection = await windowManagerAPI.getSelectedText();
    if (!selection || !selection.hasSelection)
      text = this?.findbar?._findField?.value;
    else text = selection.selectedText;
    this.setPromptText(text);
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
    button.addEventListener("click", () => {
      this.toggleExpanded();
      if (this.minimal) {
        const inpText = this?.findbar?._findField?.value?.trim();
        this.sendMessage(inpText);
      }
    });
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

  handleInputKeyPress: function(e) {
    if (e?.key === "Enter" && e?.altKey) {
      const inpText = this?.findbar?._findField?.value?.trim();
      this.expanded = true;
      this.sendMessage(inpText);
    }
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
      this.setPromptTextFromSelection();
    }
    if (e.key?.toLowerCase() === "escape") {
      if (this.expanded) {
        e.preventDefault();
        e.stopPropagation();
        this.expanded = false;
        this.focusInput();
      }
    }
  },

  addListeners() {
    this._updateFindbar = this.updateFindbar.bind(this);
    this._addKeymaps = this.addKeymaps.bind(this);
    this._handleInputKeyPress = this.handleInputKeyPress.bind(this);
    this._handleGodModeChange = gemini.updateSystemPrompt.bind(gemini);
    this._handleCitationChange = gemini.updateSystemPrompt.bind(gemini);

    gBrowser.tabContainer.addEventListener("TabSelect", this._updateFindbar);
    document.addEventListener("keydown", this._addKeymaps);
    UC_API.Prefs.addListener(GOD_MODE, this._handleGodModeChange);
    UC_API.Prefs.addListener(CITATIONS_ENABLED, this._handleCitationChange);
  },
  removeListeners() {
    if (this.findbar)
      this.findbar._findField.removeEventListener(
        "keypress",
        this._handleInputKeyPress,
      );
    gBrowser.tabContainer.removeEventListener("TabSelect", this._updateFindbar);
    document.removeEventListener("keydown", this._addKeymaps);
    UC_API.Prefs.removeListener(GOD_MODE, this._handleGodModeChange);
    UC_API.Prefs.removeListener(CITATIONS_ENABLED, this._handleCitationChange);

    this._handleInputKeyPress = null;
    this._updateFindbar = null;
    this._addKeymaps = null;
    this._handleGodModeChange = null;
    this._handleCitationChange = null;
  },
};

findbar.init();
UC_API.Prefs.addListener(ENABLED, findbar.handleEnabledChange.bind(findbar));
window.findbar = findbar;
