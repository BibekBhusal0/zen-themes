// https://github.com/CosmoCreeper/Sine/blob/main/engine/injectAPI.js
// ===========================================================
// Module to read HTML content (and maybe modify if I implement it)
// ===========================================================
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

const getUrlAndTitle = () => {
  return {
    url: gBrowser.currentURI.spec,
    title: gBrowser.selectedBrowser.contentTitle,
  };
};

const _actors = new Set();
let _lazy = {};
ChromeUtils.defineESModuleGetters(_lazy, {
  ActorManagerParent: "resource://gre/modules/ActorManagerParent.sys.mjs",
});

const windowManagerName = "FindbarAIWindowManager";

// Debug logging helper
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

const windowManager = () => {
  if (_actors.has(windowManagerName)) {
    return;
  }

  const decl = {};
  decl[windowManagerName] = {
    parent: {
      esModuleURI:
        "chrome://userscripts/content/custom/findbar-ai/actors/FindbarAIWindowManagerParent.sys.mjs",
    },
    child: {
      esModuleURI:
        "chrome://userscripts/content/custom/findbar-ai/actors/FindbarAIWindowManagerChild.sys.mjs",
      events: {
        DOMContentLoaded: {},
      },
    },
    matches: ["https://*", "http://*"],
  };

  try {
    _lazy.ActorManagerParent.addJSWindowActors(decl);
    _actors.add(windowManagerName);
    debugLog("FindbarAI WindowManager registered successfully");
  } catch (e) {
    debugError(`Failed to register JSWindowActor: ${e}`);
  }
};

export const windowManagerAPI = {
  getWindowManager() {
    try {
      if (!gBrowser || !gBrowser.selectedBrowser) return undefined;
      const context = gBrowser.selectedBrowser.browsingContext;
      if (!context || !context.currentWindowContext) return undefined;
      return context.currentWindowContext.getActor(windowManagerName);
    } catch {
      return undefined;
    }
  },

  async getHTMLContent() {
    const wm = this.getWindowManager();
    if (!wm) return {};
    try {
      return await wm.getPageHTMLContent();
    } catch (error) {
      debugError("Failed to get page HTML content:", error);
      return {};
    }
  },

  async getSelectedText() {
    const wm = this.getWindowManager();
    if (!wm) return getUrlAndTitle();
    try {
      return await wm.getSelectedText();
    } catch (error) {
      debugError("Failed to get selected text:", error);
      return getUrlAndTitle();
    }
  },

  async getPageTextContent() {
    const wm = this.getWindowManager();
    if (!wm) return getUrlAndTitle();
    try {
      return await wm.getPageTextContent();
    } catch (error) {
      debugError("Failed to get page text content:", error);
      return getUrlAndTitle();
    }
  },

  async highlightAndScrollToText(text) {
    const wm = this.getWindowManager();
    if (!wm) return { error: "Window manager not available." };
    try {
      return await wm.highlightAndScrollToText(text);
    } catch (error) {
      debugError("Failed to highlight text:", error);
      return { error: "Failed to highlight text." };
    }
  },
};

export default windowManager;
