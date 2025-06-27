// prefs keys
const EXPANDED = "extension.findbar-ai.expanded";
const DISABLED = "extension.findbar-ai.disabled";

// set expanded to false initially
UC_API.Prefs.set(EXPANDED, false);

const findbar = {
  findbar: null,
  expandButton: null,

  get expanded() {
    return UC_API.Prefs.get(EXPANDED).value || false;
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
    return !( UC_API.Prefs.get(DISABLED).value || false );
  },
  set enabled(value) {
    if (typeof value === "boolean") UC_API.Prefs.set(DISABLED, !value);
  },
  toggleEnabled() {
    this.enabled = !this.enabled;
  },
  handleEnabledChange(enabled) {
    if (!enabled) this.init();
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
    this.findbar.hide();
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
    if (e.key && e.key.toLowerCase() === "f" && e.ctrlKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.shiftKey) this.show();
      else this.expanded = true;
    }

    if (e.key?.toLowerCase() === "escape") {
      if (this.expanded) {
        e.preventDefault();
        e.stopPropagation();
        this.expanded = false;
      } else if (this.findbar && !this.findbar.hidden) {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      }
    }
  },

  addListeners() {
    gBrowser.tabContainer.addEventListener(
      "TabSelect",
      this.updateFindbar.bind(this),
    );
    document.addEventListener("keydown", this.addKeymaps.bind(this));
    UC_API.Prefs.addListener(EXPANDED, this.handleExpandChange.bind(this));
  },
  removeListeners() {
    gBrowser.tabContainer.removeEventListener("TabSelect", this.updateFindbar);
    document.removeEventListener("keydown", this.addKeymaps);
    UC_API.Prefs.removeListeners(EXPANDED, this.handleExpandChange);
  },
};

findbar.init();
UC_API.Prefs.addListener(DISABLED, findbar.handleEnabledChange.bind(findbar));
window.findbar = findbar;
