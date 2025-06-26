const findbar = {
  enabled: true,
  expanded: false,
  findbar: null,

  async updateFindbar() {
    this.findbar = await gBrowser.getFindBar();
  },

  expand() {
    this.show();
    this.expanded = true;
  },
  contract() {
    this.expanded = false;
  },
  toggleExpanded() {
    if (this.expanded) this.contract();
    else this.expand();
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
      else this.expand();
    }
  },

  addListeners() {
    gBrowser.tabContainer.addEventListener(
      "TabSelect",
      this.updateFindbar.bind(this),
    );
    document.addEventListener("keydown", this.addKeymaps.bind(this));
  },
  removeListeners() {
    gBrowser.tabContainer.removeEventListener("TabSelect", this.updateFindbar);
    document.removeEventListener("keydown", this.addKeymaps);
  },
};

findbar.init();
