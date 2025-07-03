import windowManager, { windowManagerAPI } from "./windowManager.js";
import { markedStyles } from "chrome://userscripts/content/engine/marked.js";
import getPref from "../utils/getPref.mjs";
import { sendMessage, toolDeclarations } from "./llm.js";
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
const PROVIDER_PREF = "extension.findbar-ai.llm-provider";
const DEBUG = "extension.findbar-ai.debug";
const ASK_BUTTON_ENABLED = "extension.findbar-ai.ask-button-enabled";
const COPY_BTN_ENABLED = "extension.findbar-ai.copy-btn-enabled";

// TODO: impliment this
const CONFORMATION = "extension.findbar-ai.confirmation-before-tool-call";
const SHOW_TOOL_CALL = "extension.findbar-ai.show-tool-call";
const CONTEXT_MENU_ENABLED = "extension.findbar-ai.context-menu-enabled";
const CONTEXT_MENU_AUTOSEND = "extension.findbar-ai.context-menu-autosend";
const DND_ENABLED = "extension.findbar-ai.dnd-enabled";
const POSITION = "extension.findbar-ai.position";

//default configurations
UC_API.Prefs.setIfUnset(MINIMAL, true);
UC_API.Prefs.setIfUnset(ASK_BUTTON_ENABLED, true);
UC_API.Prefs.setIfUnset(COPY_BTN_ENABLED, true);

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
  if (Array.isArray(markdown)) {
    // If array of objects, render as markdown code blocks; if array of strings, as bullet points
    if (markdown.every(item => typeof item === 'object')) {
      markdown = markdown.map(item => `\n\n\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\``).join('');
    } else {
      markdown = markdown.map(item => `- ${typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}`).join('\n');
    }
  }
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

// Add a helper for debug logging
function debugLog(...args) {
  if (getPref('extension.findbar-ai.debug', false)) {
    console.log('[findbar-ai]', ...args);
  }
}

const findbar = {
  findbar: null,
  expandButton: null,
  chatContainer: null,
  apiKeyContainer: null,
  _updateFindbar: null,
  _addKeymaps: null,
  _handleInputKeyPress: null,
  _clearGeminiData: null,
  _isExpanded: false,
  aiResponseDiv: null,
  aiUserQuestionDiv: null,
  labelIntervalId: null,
  _handleContextMenuPrefChange: null,
  _updateContextMenuText: null,
  contextMenuItem: null,

  get expanded() {
    return this._isExpanded;
  },
  set expanded(value) {
    this._isExpanded = value;
    if (!this.findbar) return;

    if (this._isExpanded) {
      this.findbar.classList.add("ai-expanded");
      this.show();
      this.focusPrompt();
      const messagesContainer =
        this?.chatContainer?.querySelector("#chat-messages");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight; 
      }
    } else {
      this.findbar.classList.remove("ai-expanded");
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

  get provider() {
    return getPref(PROVIDER_PREF, "gemini");
  },
  set provider(value) {
    if (value) UC_API.Prefs.set(PROVIDER_PREF, value);
  },

  get godMode() {
    return getPref(GOD_MODE, false);
  },
  set godMode(value) {
    UC_API.Prefs.set(GOD_MODE, !!value);
  },

  get debug() {
    return getPref(DEBUG, false);
  },
  set debug(value) {
    UC_API.Prefs.set(DEBUG, !!value);
  },

  get askButtonEnabled() {
    return getPref(ASK_BUTTON_ENABLED, true);
  },
  set askButtonEnabled(value) {
    UC_API.Prefs.set(ASK_BUTTON_ENABLED, !!value);
  },

  get contextMenuEnabled() {
    return getPref(CONTEXT_MENU_ENABLED, true);
  },
  get contextMenuAutoSend() {
    return getPref(CONTEXT_MENU_AUTOSEND, true);
  },

  get copyBtnEnabled() {
    return getPref(COPY_BTN_ENABLED, true);
  },
  set copyBtnEnabled(value) {
    UC_API.Prefs.set(COPY_BTN_ENABLED, !!value);
  },

  updateFindbar(retryCount = 0) {
    debugLog('findbar-ai updateFindbar() called');
    if (this.debug) debugLog("updateFindbar called");
    this.removeExpandButton();
    this.hide();
    this.expanded = false;
    gBrowser.getFindBar().then((findbar) => {
      if (!findbar && retryCount < 5) {
        setTimeout(() => this.updateFindbar(retryCount + 1), 500);
        return;
      }
      debugLog('findbar-ai gBrowser.getFindBar() resolved:', findbar);
      this.findbar = findbar;
      if (this.debug) debugLog("findbar set:", this.findbar);
      this.addExpandButton();
      this.findbar._findField.addEventListener(
        "keypress",
        this._handleInputKeyPress,
      );
      this.findbar._findField.placeholder = "Press Enter to ask AI";
    });
  },

  show() {
    debugLog('findbar-ai show() called');
    if (!this.findbar) return false;
    debugLog('findbar-ai this.findbar:', this.findbar);
    this.findbar.hidden = false;
    if (!this.expanded) this.findbar._findField.focus();
    // Log the findbar DOM structure for debugging
    debugLog('[findbar-ai] findbar DOM subtree:', this.findbar, this.findbar.outerHTML);
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

  getApiKeyPrefName(provider) {
    if (provider === "mistral") return "extension.findbar-ai.mistral-api-key";
    return "extension.findbar-ai.gemini-api-key";
  },
  getApiKey(provider) {
    return getPref(this.getApiKeyPrefName(provider), "");
  },
  setApiKey(provider, value) {
    UC_API.Prefs.set(this.getApiKeyPrefName(provider), value || "");
  },

  createAPIKeyInterface(provider) {
    const providerOptions = [
      { value: "gemini", label: "Gemini" },
      { value: "mistral", label: "Mistral" },
    ];
    const providerName = provider === "mistral" ? "Mistral" : "Gemini";
    const html = `
      <div class="findbar-ai-setup">
        <div class="ai-setup-content">
          <div class="ai-chat-header">
            <select id="provider-selector" class="provider-selector">
              ${providerOptions
                .map(
                  (opt) => `<option value="${opt.value}" ${opt.value === provider ? "selected" : ""}>${opt.label}</option>`
                )
                .join("")}
            </select>
          </div>
          <h3>${providerName} API Setup Required</h3>
          <p>To use AI features, you need a ${providerName} API key.</p>
          <div class="api-key-input-group">
            <input type="password" id="${providerName.toLowerCase()}-api-key" placeholder="Enter your ${providerName} API key" />
            <button id="save-api-key">Save</button>
          </div>
          <div class="api-key-links">
            <button id="get-api-key-link">Get API Key</button>
          </div>
        </div>
      </div>`;
    const container = createHTMLElement(html);
    const providerSelector = container.querySelector("#provider-selector");
    providerSelector.addEventListener("change", (e) => {
      this.provider = e.target.value;
    });
    const input = container.querySelector(`#${providerName.toLowerCase()}-api-key`);
    const saveBtn = container.querySelector("#save-api-key");
    const getApiKeyLink = container.querySelector("#get-api-key-link");
    if (this.getApiKey(provider)) input.value = this.getApiKey(provider);
    getApiKeyLink.addEventListener("click", () => {
      if (provider === "mistral") {
        openTrustedLinkIn("https://mistral.ai", "tab");
      } else {
        openTrustedLinkIn("https://aistudio.google.com/app/apikey", "tab");
      }
    });
    saveBtn.addEventListener("click", () => {
      const key = input.value.trim();
      if (key) {
        this.setApiKey(provider, key);
      }
    });
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") saveBtn.click();
    });
    return container;
  },

  async sendAIQuery(prompt, providerOverride) {
    if (!this.findbar || !prompt) return;
    if (this.findbar._findField) this.findbar._findField.value = '';
    const container = this.findbar.querySelector('.findbar-container');
    if (!container) return;
    let aiResponseDiv = this.findbar.parentNode.querySelector('.ai-response-container');
    if (!aiResponseDiv) {
      aiResponseDiv = document.createElement('div');
      aiResponseDiv.className = 'ai-response-container';
      if (container.parentNode) {
        container.parentNode.insertBefore(aiResponseDiv, container);
      }
    }
    const userPromptDiv = document.createElement('div');
    userPromptDiv.className = 'user-prompt';
    userPromptDiv.textContent = prompt;
    aiResponseDiv.appendChild(userPromptDiv);
    const aiResponseContentDiv = document.createElement('div');
    aiResponseContentDiv.className = 'ai-response';
    aiResponseContentDiv.textContent = 'Loading...';
    aiResponseDiv.appendChild(aiResponseContentDiv);
    this.findbar.classList.add('ai-active');
    const closeBtn = this.findbar.querySelector('.findbar-closebutton');
    if (closeBtn && closeBtn.parentElement !== this.findbar) {
      this.findbar.appendChild(closeBtn);
    }
    if (closeBtn) closeBtn.classList.add('ai-float-close');
    const pageContext = {
      url: gBrowser.currentURI.spec,
      title: gBrowser.selectedBrowser.contentTitle,
    };
    const provider = providerOverride || this.provider || 'gemini';
    const godMode = this.godMode;
    try {
      if (this.debug) debugLog('[sendAIQuery] Prompt:', prompt, 'Provider:', provider, 'GodMode:', godMode);
      const response = await sendMessage({ provider, prompt, context: pageContext, godMode, toolDeclarations });
      if (this.debug) {
        debugLog('[sendAIQuery] Raw AI response:', response);
        if (response && response.answer && typeof response.answer === 'object') {
          debugLog('[sendAIQuery] AI answer is object/array:', response.answer);
        }
        if (response && response.toolCalls) {
          debugLog('[sendAIQuery] Tool calls:', response.toolCalls);
        }
        // Log special features in the prompt
        if (/getPageTextContent|getHTMLContent|openLink|search|newSplit/.test(prompt)) {
          debugLog('[sendAIQuery] Prompt may trigger tool call:', prompt);
        }
      }
      aiResponseContentDiv.innerHTML = '';
      if (response && response.answer) {
        aiResponseContentDiv.appendChild(parseMD(response.answer));
        if (this.copyBtnEnabled) {
          const copyBtn = document.createElement('button');
          copyBtn.className = 'ai-copy-btn';
          copyBtn.textContent = 'Copy';
          copyBtn.style.marginLeft = '8px';
          copyBtn.addEventListener('click', () => {
            // Copy plain text (not HTML)
            const temp = document.createElement('div');
            temp.innerHTML = response.answer;
            const text = temp.textContent || temp.innerText || '';
            navigator.clipboard.writeText(text);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
          });
          aiResponseContentDiv.appendChild(copyBtn);
        }
      }
      // No citation UI or click handling remains
    } catch (e) {
      aiResponseContentDiv.textContent = `Error: ${e.message}`;
      if (this.debug) debugLog('[sendAIQuery] Error:', e);
    }
  },

  removeAIResponse() {
    // Remove the single .ai-response-container (for when closing/clearing)
    const aiResponseDiv = this.findbar?.parentNode?.querySelector('.ai-response-container');
    if (aiResponseDiv) aiResponseDiv.remove();
    if (this.findbar) {
      this.findbar.classList.remove('ai-active');
      const closeBtn = this.findbar.querySelector('.findbar-closebutton');
      if (closeBtn) closeBtn.classList.remove('ai-float-close');
      const container = this.findbar.querySelector('.findbar-container');
      if (closeBtn && container && closeBtn.parentElement !== container) {
        container.appendChild(closeBtn);
      }
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

  init() {
    if (this.debug) debugLog("findbar.init called");
    if (!this.enabled) return;
    this.updateFindbar();
    this.addListeners();
    this.removeAIResponse();
  },
  destroy() {
    this.findbar = null;
    this.expanded = false;
    this.removeListeners();
    this.removeExpandButton();
    this.removeAIResponse();
  },

  addExpandButton() {
    if (!this.askButtonEnabled) {
      // Always move the close button into the container even if ask button is disabled
      const container = this.findbar?.querySelector('.findbar-container');
      const closeBtn = this.findbar?.querySelector('.findbar-closebutton');
      if (container && closeBtn && closeBtn.parentElement !== container) {
        container.appendChild(closeBtn);
      }
      return false;
    }
    if (this.debug) debugLog("addExpandButton called", this.findbar);
    if (!this.findbar) return false;
    const button_id = "findbar-ask-btn";
    const container = this.findbar.querySelector('.findbar-container');
    if (!container) return false;
    const existing = container.querySelector(`#${button_id}`);
    if (existing) existing.remove();
    const askBtn = createHTMLElement(`<button id="${button_id}" class="send-btn">Ask</button>`);
    askBtn.addEventListener('click', () => {
      const prompt = this.findbar._findField.value.trim();
      if (prompt) {
        this.sendAIQuery(prompt);
      }
    });
    container.appendChild(askBtn);
    this.expandButton = askBtn;
    if (this.debug) debugLog("Ask button injected", askBtn);
    const closeBtn = this.findbar.querySelector('.findbar-closebutton');
    if (closeBtn && closeBtn.parentElement !== container) {
      container.appendChild(closeBtn);
    }
    return true;
  },

  removeExpandButton() {
    if (!this.expandButton) return false;
    this.expandButton.remove();
    this.expandButton = null;
    return true;
  },

  handleInputKeyPress: function(e) {
    if (e?.key === "Enter" && !e.altKey) {
      e.preventDefault();
      const inpText = this?.findbar?._findField?.value?.trim();
      if (inpText) {
        this.sendAIQuery(inpText);
      }
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

  addContextMenuItem() {
    if (this.contextMenuItem) return;
    const contextMenu = document.getElementById("contentAreaContextMenu");
    if (!contextMenu) return;

    // Create Ask AI menu
    const aiMenu = document.createXULElement("menu");
    aiMenu.id = "ai-findbar-context-menu";
    aiMenu.setAttribute("label", "Ask AI");

    // Helper to create menu items
    const createMenuItem = (id, label, handler) => {
      const item = document.createXULElement("menuitem");
      item.id = id;
      item.setAttribute("label", label);
      item.addEventListener("command", handler);
      return item;
    };

    // Handlers for each action
    const handleSummarizePage = async () => {
      this.expanded = true;
      const prompt = "Summarize the current page.";
      if (this.contextMenuAutoSend) {
        const provider = this.provider || 'gemini';
        this.sendAIQuery(prompt, provider);
      } else {
        if (this.findbar && this.findbar._findField) {
          this.findbar._findField.value = prompt;
          this.findbar._findField.focus();
        }
      }
    };
    const handleExplainSelection = async () => {
      const selection = await windowManagerAPI.getSelectedText();
      let prompt = "Explain this in context of the current page.\n";
      if (selection && selection.hasSelection) {
        const selectedTextFormatted = selection.selectedText
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => "> " + line)
          .join("\n");
        prompt += selectedTextFormatted;
      } else {
        prompt = "Explain the current page.";
      }
      this.expanded = true;
      if (this.contextMenuAutoSend) {
        const provider = this.provider || 'gemini';
        this.sendAIQuery(prompt, provider);
      } else {
        if (this.findbar && this.findbar._findField) {
          this.findbar._findField.value = prompt;
          this.findbar._findField.focus();
        }
      }
    };
    const handleTranslateSelection = async () => {
      const selection = await windowManagerAPI.getSelectedText();
      let prompt = "Translate this to English.\n";
      if (selection && selection.hasSelection) {
        const selectedTextFormatted = selection.selectedText
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => "> " + line)
          .join("\n");
        prompt += selectedTextFormatted;
      } else {
        prompt = "Translate the current page to English.";
      }
      this.expanded = true;
      if (this.contextMenuAutoSend) {
        const provider = this.provider || 'gemini';
        this.sendAIQuery(prompt, provider);
      } else {
        if (this.findbar && this.findbar._findField) {
          this.findbar._findField.value = prompt;
          this.findbar._findField.focus();
        }
      }
    };
    const handleQuizSelection = async () => {
      const selection = await windowManagerAPI.getSelectedText();
      let prompt = "Generate a quiz (with answers) based on this text.\n";
      if (selection && selection.hasSelection) {
        const selectedTextFormatted = selection.selectedText
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => "> " + line)
          .join("\n");
        prompt += selectedTextFormatted;
      } else {
        prompt = "Generate a quiz (with answers) based on the current page.";
      }
      this.expanded = true;
      if (this.contextMenuAutoSend) {
        const provider = this.provider || 'gemini';
        this.sendAIQuery(prompt, provider);
      } else {
        if (this.findbar && this.findbar._findField) {
          this.findbar._findField.value = prompt;
          this.findbar._findField.focus();
        }
      }
    };
    const handleContinueWriting = async () => {
      const selection = await windowManagerAPI.getSelectedText();
      let prompt = "Continue writing from here.\n";
      if (selection && selection.hasSelection) {
        const selectedTextFormatted = selection.selectedText
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => "> " + line)
          .join("\n");
        prompt += selectedTextFormatted;
      } else {
        prompt = "Continue writing based on the current page.";
      }
      this.expanded = true;
      if (this.contextMenuAutoSend) {
        const provider = this.provider || 'gemini';
        this.sendAIQuery(prompt, provider);
      } else {
        if (this.findbar && this.findbar._findField) {
          this.findbar._findField.value = prompt;
          this.findbar._findField.focus();
        }
      }
    };
    const handleRewriteSelection = async () => {
      const selection = await windowManagerAPI.getSelectedText();
      let prompt = "Rewrite this to improve clarity and style.\n";
      if (selection && selection.hasSelection) {
        const selectedTextFormatted = selection.selectedText
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => "> " + line)
          .join("\n");
        prompt += selectedTextFormatted;
      } else {
        prompt = "Rewrite the current page to improve clarity and style.";
      }
      this.expanded = true;
      if (this.contextMenuAutoSend) {
        const provider = this.provider || 'gemini';
        this.sendAIQuery(prompt, provider);
      } else {
        if (this.findbar && this.findbar._findField) {
          this.findbar._findField.value = prompt;
          this.findbar._findField.focus();
        }
      }
    };

    // Create the <menupopup> and add items
    const aiMenuPopup = document.createXULElement("menupopup");
    aiMenuPopup.appendChild(createMenuItem("ai-findbar-summarize", "Summarize Page", handleSummarizePage));
    aiMenuPopup.appendChild(createMenuItem("ai-findbar-explain", "Explain Selection", handleExplainSelection));
    aiMenuPopup.appendChild(createMenuItem("ai-findbar-translate", "Translate Selection", handleTranslateSelection));
    aiMenuPopup.appendChild(createMenuItem("ai-findbar-quiz", "Generate Quiz from Selection", handleQuizSelection));
    aiMenuPopup.appendChild(createMenuItem("ai-findbar-continue", "Continue Writing", handleContinueWriting));
    aiMenuPopup.appendChild(createMenuItem("ai-findbar-rewrite", "Rewrite Selection", handleRewriteSelection));
    aiMenu.appendChild(aiMenuPopup);

    // Insert menu after searchselect or redo separator
    const searchSelectItem = contextMenu.querySelector("#context-searchselect");
    if (searchSelectItem) {
      if (searchSelectItem.nextSibling) {
        contextMenu.insertBefore(aiMenu, searchSelectItem.nextSibling);
      } else {
        contextMenu.appendChild(aiMenu);
      }
    } else {
      const redoSeparator = contextMenu.querySelector("#context-sep-redo");
      if (redoSeparator) {
        if (redoSeparator.nextSibling) {
          contextMenu.insertBefore(aiMenu, redoSeparator.nextSibling);
        } else {
          contextMenu.appendChild(aiMenu);
        }
      } else {
        return;
      }
    }
    this.contextMenuItem = aiMenu;
    this._updateContextMenuText = this.updateContextMenuText.bind(this);
    contextMenu.addEventListener("popupshowing", this._updateContextMenuText);
  },
  removeContextMenuItem: function() {
    this?.contextMenuItem?.remove();
    this.contextMenuItem = null;
    document
      ?.getElementById("contentAreaContextMenu")
      ?.removeEventListener("popupshowing", this._updateContextMenuText);
  },
  handleContextMenuPrefChange: function(pref) {
    if (pref.value) this.addContextMenuItem();
    else this.removeContextMenuItem();
  },
  updateContextMenuText() {
    if (!this.contextMenuEnabled) return;
    if (!this.contextMenuItem) return;
    const hasSelection = gContextMenu?.isTextSelected === true;
    this.contextMenuItem.label = hasSelection ? "Ask AI" : "Summarize with AI";
  },

  addListeners() {
    this._updateFindbar = this.updateFindbar.bind(this);
    this._addKeymaps = this.addKeymaps.bind(this);
    this._handleInputKeyPress = this.handleInputKeyPress.bind(this);
    this._clearGeminiData = null;
    this._handleContextMenuPrefChange = this.handleContextMenuPrefChange.bind(this);
    gBrowser.tabContainer.addEventListener("TabSelect", this._updateFindbar);
    document.addEventListener("keydown", this._addKeymaps);
    UC_API.Prefs.addListener(GOD_MODE, this._clearGeminiData);
    UC_API.Prefs.addListener(CONTEXT_MENU_ENABLED, this._handleContextMenuPrefChange);
    UC_API.Prefs.addListener(ASK_BUTTON_ENABLED, () => this.updateFindbar());
  },
  removeListeners() {
    if (this.findbar)
      this.findbar._findField.removeEventListener(
        "keypress",
        this._handleInputKeyPress,
      );
    gBrowser.tabContainer.removeEventListener("TabSelect", this._updateFindbar);
    document.removeEventListener("keydown", this._addKeymaps);
    UC_API.Prefs.removeListener(GOD_MODE, this._clearGeminiData);
    UC_API.Prefs.removeListener(CONTEXT_MENU_ENABLED, this._handleContextMenuPrefChange);
    this._handleInputKeyPress = null;
    this._updateFindbar = null;
    this._addKeymaps = null;
    this._handleContextMenuPrefChange = null;
    this._clearGeminiData = null;
  },
};

findbar.init();
UC_API.Prefs.addListener(ENABLED, findbar.handleEnabledChange.bind(findbar));
window.findbar = findbar;

// Ensure context menu is injected on first open if config is enabled
(function ensureContextMenuInjection() {
  let injected = false;
  function maybeInjectAIContextMenu() {
    if (injected) return;
    if (!findbar.contextMenuEnabled) return;
    const contextMenu = document.getElementById("contentAreaContextMenu");
    if (contextMenu) {
      findbar.addContextMenuItem();
      injected = true;
      contextMenu.removeEventListener("popupshowing", maybeInjectAIContextMenu);
    }
  }
  document.addEventListener("popupshowing", maybeInjectAIContextMenu);
})();
