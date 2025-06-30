import getPref from "chrome://userscripts/content/custom/utils/getPref.mjs";

const debugLog = (...args) => {
  if (getPref("extension.findbar-ai.debug-mode", false)) {
    console.log("[findbar-ai] Window Manager (Parent):", ...args);
  }
};

const debugError = (...args) => {
  if (getPref("extension.findbar-ai.debug-mode", false)) {
    console.error("[findbar-ai] Window Manager (Parent Error):", ...args);
  }
};

debugLog("Parent actor loaded");

export class FindbarAIWindowManagerParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    debugLog(`Parent received message: ${message.name}`);
    switch (message.name) {
      case "FindbarAI:ContentLoaded":
        debugLog(`Page loaded: ${message.data.title} - ${message.data.url}`);
        break;

      default:
        debugLog(`Parent unhandled message: ${message.name}`);
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
    // __AUTO_GENERATED_PRINT_VAR_START__
    console.log(
      "FindbarAIWindowManagerParent#highlightAndScrollToText text:",
      text,
    ); // __AUTO_GENERATED_PRINT_VAR_END__
    try {
      const result = await this.sendQuery("FindbarAI:HighlightAndScroll", {
        text,
      });
      // __AUTO_GENERATED_PRINT_VAR_START__
      console.log(
        "FindbarAIWindowManagerParent#highlightAndScrollToText result:",
        result,
      ); // __AUTO_GENERATED_PRINT_VAR_END__
      return result;
    } catch (e) {
      debugError("Failed to send highlight command to child:", e);
      return {};
    }
  }
}
