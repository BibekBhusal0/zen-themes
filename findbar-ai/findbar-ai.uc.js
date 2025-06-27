// prefs keys
const EXPANDED = "extension.findbar-ai.expanded";
const ENABLED = "extension.findbar-ai.enabled";

// WindowManager
import windowManagerAPI from "./windowManager.js";
windowManagerAPI();
console.log("findbar: main file loaded");

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

// set expanded to false initially
UC_API.Prefs.set(EXPANDED, false);

const findbar = {
  findbar: null,
  expandButton: null,
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
    if (expanded.value) this.show();
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
    gBrowser.getFindBar().then((findbar) => {
      this.findbar = findbar;
      this.addExpandButton();
    });
  },

  show() {
    if (!this.findbar) return false;
    this.findbar.hidden = false;
    this.findbar._findField.focus();
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

  init() {
    if (!this.enabled) return;
    this.updateFindbar();
    this.addListeners();
  },
  destroy() {
    this.findbar = null;
    this.removeListeners();
    this.removeExpandButton();
  },

  addExpandButton() {
    if (!this.findbar) return false;
    const button_id = "findbar-expand";
    if (this.findbar.getElement(button_id)) return true;
    const button = document.createElement("div");
    button.setAttribute("anonid", button_id);
    button.addEventListener("click", () => this.toggleExpanded());
    button.id = button_id;
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
    }

    if (e.key?.toLowerCase() === "escape") {
      if (this.expanded) {
        e.preventDefault();
        e.stopPropagation();
        this.expanded = false;
      }
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
