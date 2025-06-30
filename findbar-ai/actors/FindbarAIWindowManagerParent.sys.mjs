import getPref from "chrome://userscripts/content/custom/utils/getPref.mjs";

const debugLog = (...args) => {
  if (getPref("extension.findbar-ai.debug-mode", false)) {
    console.log(...args);
  }
};

const debugError = (...args) => {
  if (getPref("extension.findbar-ai.debug-mode", false)) {
    console.error(...args);
  }
};

debugLog("findbar: Window Manager parent loaded");

export class FindbarAIWindowManagerParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    debugLog("findbar: parent received message");
    debugLog(`Message name: ${message.name}`);
    switch (message.name) {
      case "FindbarAI:ContentLoaded":
        debugLog(`Page loaded: ${message.data.title} - ${message.data.url}`);
        break;

      default:
        debugLog(`findbar: parent unhandled message: ${message.name}`);
    }
  }

  async getPageHTMLContent() {
    try {
      const result = await this.sendQuery("FindbarAI:GetPageHTMLContent");
      return result;
    } catch (e) {
      debugError("Failed to get page content:", e);
      return {};
    }
  }

  async getSelectedText() {
    try {
      const result = await this.sendQuery("FindbarAI:GetSelectedText");
      return result;
    } catch (e) {
      debugError("Failed to get selected text:", e);
      return {};
    }
  }

  async getPageTextContent() {
    try {
      const result = await this.sendQuery("FindbarAI:GetPageTextContent");
      return result;
    } catch (e) {
      debugError("Failed to get page text content:", e);
      return {};
    }
  }

  async highlightAndScrollToText(text) {
    try {
      const result = await this.sendQuery("FindbarAI:HighlightAndScroll", {
        text,
      });
      return result;
    } catch (e) {
      debugError("Failed to send highlight command to child:", e);
      return {};
    }
  }
}
