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
  contract() { this.expanded = false; },
  toggleExpanded() {
    if (this.expanded) this.contract();
    else this.expand();
  },

  show() {
    if (!this.findbar) return false;
    console.log('showing');

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

  addKeymaps: (e) => {
    if (e.key === 'f') {
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        console.log('show');
        e.preventDefault();
        e.stopPropagation();
        findbar.show();
      }
      if (e.ctrlKey && e.shiftKey && !e.altKey) {
        console.log("expand");
        e.preventDefault();
        e.stopPropagation();
        findbar.expand();
      }
    }
  },

  addListeners() {
    gBrowser.tabContainer.addEventListener("TabSelect", this.updateFindbar.bind(this));
    document.addEventListener('keydown', this.addKeymaps);
  },
  removeListeners() {
    gBrowser.tabContainer.removeEventListener("TabSelect", this.updateFindbar);
    document.removeEventListener('keydown', this.addKeymaps);
  }
}

findbar.init();

