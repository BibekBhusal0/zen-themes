// ==UserScript==
// @name           Complete Hotkeys
// @description    Full set of custom hotkeys
// ==/UserScript==

const hotkeys = [
  {
    id: "duplicateTab",
    modifiers: "alt",
    key: "D",
    command: (window) => {
      const newTab = window.gBrowser.duplicateTab(window.gBrowser.selectedTab);
      window.gBrowser.selectedTab = newTab;
    },
  },

  {
    id: "restartBrowser",
    modifiers: "ctrl shift alt",
    key: "R",
    command: () => {
      UC_API.Runtime.restart(true);
    },
  },

  {
    id: "testHotkey",
    modifiers: "ctrl shift alt",
    key: "T",
    command: (param) => {
      console.log("Test hotkey pressed! Parameter:", param);
    },
  },

  {
    id: "previousTab",
    modifiers: "alt",
    key: "J",
    command: (window) => {
      window.gBrowser.tabContainer.advanceSelectedTab(1, true);
    },
  },

  {
    id: "nextTab",
    modifiers: "alt",
    key: "K",
    command: (window) => {
      window.gBrowser.tabContainer.advanceSelectedTab(-1, true);
    },
  },

  {
    id: "toggletabpin",
    modifiers: "alt",
    key: "o",
    command: (window) => {
      const tab = window.gBrowser.selectedTab;
      if (tab.pinned) {
        window.gBrowser.unpinMultiSelectedTabs();
      } else {
        window.gBrowser.pinMultiSelectedTabs();
      }
    },
  },

  {
    id: "previousTabHistory",
    modifiers: "alt",
    key: "H",
    command: (window) => {
      window.gBrowser.goBack();
    },
  },

  {
    id: "nextTabHistory",
    modifiers: "alt",
    key: "L",
    command: (window) => {
      window.gBrowser.goForward();
    },
  },
];

hotkeys.forEach((hotkey) => {
  UC_API.Hotkeys.define(hotkey).autoAttach({ suppressOriginal: false });
});
