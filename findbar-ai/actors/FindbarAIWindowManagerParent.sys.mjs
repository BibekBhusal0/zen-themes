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

const debugLog = (...args) => {
  if (getPref("extensions.findbar-ai.debug-mode", false)) {
    console.log(...args);
  }
};

const debugError = (...args) => {
  if (getPref("extensions.findbar-ai.debug-mode", false)) {
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

  // Helper method to get page content
  async getPageContent() {
    try {
      const result = await this.sendQuery("FindbarAI:GetPageContent");
      return result;
    } catch (e) {
      debugError("Failed to get page content:", e);
      return null;
    }
  }

  // Helper method to get selected text
  async getSelectedText() {
    try {
      const result = await this.sendQuery("FindbarAI:GetSelectedText");
      return result;
    } catch (e) {
      debugError("Failed to get selected text:", e);
      return null;
    }
  }
}
