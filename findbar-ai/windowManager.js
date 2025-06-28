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

const _actors = new Set();
let _lazy = {};
ChromeUtils.defineESModuleGetters(_lazy, {
  ActorManagerParent: "resource://gre/modules/ActorManagerParent.sys.mjs",
});

const windowManagerName = "FindbarAIWindowManager";

// Debug logging helper
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

const windowManagerAPI = () => {
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

export default windowManagerAPI;
