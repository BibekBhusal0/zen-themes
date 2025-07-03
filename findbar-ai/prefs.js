export const PREFS = {
  ENABLED: "extension.findbar-ai.enabled",
  MINIMAL: "extension.findbar-ai.minimal",

  GOD_MODE: "extension.findbar-ai.god-mode",
  CITATIONS_ENABLED: "extension.findbar-ai.citations-enabled",

  CONTEXT_MENU_ENABLED: "extension.findbar-ai.context-menu-enabled",
  CONTEXT_MENU_AUTOSEND: "extension.findbar-ai.context-menu-autosend",

  DEBUG_MODE: "extension.findbar-ai.debug-mode",

  MISTRAL_API_KEY: "extension.findbar-ai.mistral-api-key",
  MISTRAL_MODEL: "extension.findbar-ai.mistral-model",

  GEMINI_API_KEY: "extension.findbar-ai.gemini-api-key",
  GEMINI_MODEL: "extension.findbar-ai.gemini-model",

  //TODO: Not yet implimented
  COPY_BTN_ENABLED: "extension.findbar-ai.copy-btn-enabled",
  MARKDOWN_ENABLED: "extension.findbar-ai.markdown-enabled",

  CONFORMATION: "extension.findbar-ai.confirmation-before-tool-call",
  SHOW_TOOL_CALL: "extension.findbar-ai.show-tool-call",
  DND_ENABLED: "extension.findbar-ai.dnd-enabled",
  POSITION: "extension.findbar-ai.position",

  defaultValues: {},

  getPref(key) {
    try {
      const pref = UC_API.Prefs.get(key);
      if (!pref) return PREFS.defaultValues[key];
      if (!pref.exists()) return PREFS.defaultValues[key];
      return pref.value;
    } catch {
      return PREFS.defaultValues[key];
    }
  },

  setInitialPrefs() {
    for (const [key, value] of Object.entries(PREFS.defaultValues)) {
      UC_API.Prefs.setIfUnset(key, value);
    }
  },

  get enabled() {
    return this.getPref(this.ENABLED);
  },
  set enabled(value) {
    UC_API.Prefs.set(this.ENABLED, value);
  },

  get minimal() {
    return this.getPref(this.MINIMAL);
  },
  set minimal(value) {
    UC_API.Prefs.set(this.MINIMAL, value);
  },

  set godMode(value) {
    UC_API.Prefs.set(this.GOD_MODE, value);
  },
  get godMode() {
    return this.getPref(this.GOD_MODE);
  },

  get citationsEnabled() {
    return this.getPref(this.CITATIONS_ENABLED);
  },
  set citationsEnabled(value) {
    UC_API.Prefs.set(this.CITATIONS_ENABLED, value);
  },

  get contextMenuEnabled() {
    return this.getPref(this.CONTEXT_MENU_ENABLED);
  },
  set contextMenuEnabled(value) {
    UC_API.Prefs.set(this.CONTEXT_MENU_ENABLED, value);
  },

  get contextMenuAutoSend() {
    return this.getPref(this.CONTEXT_MENU_AUTOSEND);
  },
  set contextMenuAutoSend(value) {
    UC_API.Prefs.set(this.CONTEXT_MENU_AUTOSEND, value);
  },

  get mistralApiKey() {
    return this.getPref(this.MISTRAL_API_KEY);
  },
  set mistralApiKey(value) {
    UC_API.Prefs.set(this.MISTRAL_API_KEY, value);
  },

  get mistralModel() {
    return this.getPref(this.MISTRAL_MODEL);
  },
  set mistralModel(value) {
    UC_API.Prefs.set(this.MISTRAL_MODEL, value);
  },

  get geminiApiKey() {
    return this.getPref(this.GEMINI_API_KEY);
  },
  set geminiApiKey(value) {
    UC_API.Prefs.set(this.GEMINI_API_KEY, value);
  },

  get geminiModel() {
    return this.getPref(this.GEMINI_MODEL);
  },
  set geminiModel(value) {
    UC_API.Prefs.set(this.GEMINI_MODEL, value);
  },

  get copyBtnEnabled() {
    return this.getPref(this.COPY_BTN_ENABLED);
  },
  set copyBtnEnabled(value) {
    UC_API.Prefs.set(this.COPY_BTN_ENABLED, value);
  },
};

export const debugLog = (...args) => {
  if (PREFS.getPref(PREFS.DEBUG_MODE, false)) {
    console.log("FindbarAI :", ...args);
  }
};

export const debugError = (...args) => {
  if (PREFS.getPref(PREFS.DEBUG_MODE, false)) {
    console.error("FindbarAI :", ...args);
  }
};

PREFS.defaultValues = {
  [PREFS.ENABLED]: true,
  [PREFS.MINIMAL]: true,
  [PREFS.GOD_MODE]: false,
  [PREFS.CITATIONS_ENABLED]: false,
  [PREFS.CONTEXT_MENU_ENABLED]: true,
  [PREFS.CONTEXT_MENU_AUTOSEND]: true,
  [PREFS.MISTRAL_API_KEY]: "",
  [PREFS.MISTRAL_MODEL]: "mistral-medium-latest",
  [PREFS.GEMINI_API_KEY]: "",
  [PREFS.GEMINI_MODEL]: "gemini-2.0-flash",
  [PREFS.COPY_BTN_ENABLED]: true,
  [PREFS.MARKDOWN_ENABLED]: true,
  [PREFS.CONFORMATION]: true,
  [PREFS.SHOW_TOOL_CALL]: false,
  [PREFS.DND_ENABLED]: true,
  [PREFS.POSITION]: "top-right",
};

export default PREFS;
