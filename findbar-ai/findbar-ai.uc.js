// prefs keys
const EXPANDED = "extension.findbar-ai.expanded";

const findbar = {
  enabled: true,
  findbar: null,

  async updateFindbar() {
    this.findbar = await gBrowser.getFindBar();
  },

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

  show() {
    if (!this.findbar) return false;

    this.findbar.hidden = false;
    return true;
  },

  hide() {
    if (!this.findbar) return false;
    this.findbar.hidden = true;
    return true;
  },

  toggleVisibility() {
    if (!this.findbar) return;
    if (this.findbar.hidden) this.show();
    else this.hide();
  },

  init() {
    this.updateFindbar();
    this.addListeners();
  },
  destroy() {
    this.findbar = null;
    this.removeListeners();
  },

  addKeymaps: function(e) {
    if (e.key && e.key.toLowerCase() === "f" && e.ctrlKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.shiftKey) this.show();
      else this.expanded = true;
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
window.findbar = findbar;
