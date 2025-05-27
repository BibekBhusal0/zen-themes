// ==UserScript==
// @name           Complete Hotkeys
// @description    Full set of custom hotkeys
// ==/UserScript==

const { Runtime, Hotkeys, Prefs } = UC_API;
import { showToast } from "./utils/toast.mjs";

const copyGithubRepo = (window) => {
  const url = window.gBrowser.currentURI.spec;
  const githubRepoRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
  const match = url.match(githubRepoRegex);
  if (match && match.length === 3) {
    const username = match[1];
    const repoName = match[2];
    const repoString = `${username}/${repoName}`;
    navigator.clipboard
      .writeText(repoString)
      .then(() => {
        showToast("gh-success", "success");
      })
      .catch(() => {
        showToast("gh-fail", "error");
      });
  } else {
    showToast("gh-not-found", "error");
  }
};

const alternateSearch = (window, split) => {
  try {
    const currentURL = window.gBrowser.currentURI.spec;
    let searchQuery = null;
    let targetSearchEngine = null;
    if (currentURL.includes("duckduckgo.com")) {
      const urlParams = new URLSearchParams(new URL(currentURL).search);
      searchQuery = urlParams.get("q");
      targetSearchEngine = "Google";
    } else if (currentURL.includes("google.com")) {
      const urlParams = new URLSearchParams(new URL(currentURL).search);
      searchQuery = urlParams.get("q");
      targetSearchEngine = "DuckDuckGo";
    }
    if (searchQuery) {
      let newURL;
      const previousTab = window.gBrowser.selectedTab;
      if (targetSearchEngine === "Google") {
        newURL = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        showToast("searching-google", "success");
      } else if (targetSearchEngine === "DuckDuckGo") {
        newURL = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`;
        showToast("searching-duckduckgo", "success");
      } else {
        showToast("search-fail", "error");
        return;
      }
      openTrustedLinkIn(newURL, "tab");
      const currentTab = window.gBrowser.selectedTab;
      if (previousTab && split) gZenViewSplitter.splitTabs([ currentTab, previousTab ], 'vsep', 1); 
    } else {
      showToast("search-fail", "error");
    }
  } catch (error) {
    showToast("search-fail", "error");
  }
};

const togglePref = (prefName) => {
  const pref = Prefs.get(prefName);
  if (!pref || pref.type !== "boolean") return;
  pref.setTo(!pref.value);
};

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
    command: () => Runtime.restart(true),
  },

  {
    id: "testHotkey",
    modifiers: "ctrl shift alt",
    key: "T",
    command: (param) => {
      console.log("Test hotkey pressed! Parameter:", param);
      showToast("test", "info");
    },
  },

  {
    id: "previousTab",
    modifiers: "alt",
    key: "J",
    command: (window) =>
      window.gBrowser.tabContainer.advanceSelectedTab(1, true),
  },

  {
    id: "nextTab",
    modifiers: "alt",
    key: "K",
    command: (window) =>
      window.gBrowser.tabContainer.advanceSelectedTab(-1, true),
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
    command: (window) => window.gBrowser.goBack(),
  },

  {
    id: "nextTabHistory",
    modifiers: "alt",
    key: "L",
    command: (window) => window.gBrowser.goForward(),
  },

  {
    id: "copyGithubRepo",
    modifiers: "ctrl shift alt",
    key: "G",
    command: copyGithubRepo,
  },

  {
    id: "alternateSearchSplit",
    modifiers: "alt",
    key: "Y",
    command: (window) => alternateSearch(window, true),
  },

  {
    id: "alternateSearch",
    modifiers: "alt ctrl",
    key: "Y",
    command: (window) => alternateSearch(window, false),
  },

  {
    id: "toggleToolbar",
    modifiers: "alt ctrl",
    key: "T",
    command: () => togglePref("zen.view.compact.hide-toolbar"),
  },

  {
    id: "toggleTabbar",
    modifiers: "alt ctrl",
    key: "A",
    command: () => togglePref("zen.view.compact.hide-tabbar"),
  },

  {
    id: "toggleDarkMode",
    modifiers: "ctrl alt shift",
    key: "D",
    command: () => togglePref("pdf.dark.mode.disabled"),
  },

  {
    id: "toggleGameMode",
    modifiers: "alt",
    key: "G",
    command: () => togglePref("natsumi.gamemode.enabled"),
  },

  {
    id: "openSettings",
    modifiers: "ctrl alt",
    key: "S",
    command: () => openTrustedLinkIn("about:preferences", "tab"),
  },

  {
    id: "openAdvancedSettings",
    modifiers: "ctrl shift alt",
    key: "S",
    command: () => openTrustedLinkIn("about:config", "tab"),
  },

  {
    id: "pasteAndGo",
    modifiers: "alt",
    key: "V",
    command: () => {
      navigator.clipboard.readText().then((text) => {
        if (text) {
          try {
            new URL(text);
            openTrustedLinkIn(text, "tab");
          } catch (error) {
            const searchURL = `https://duckduckgo.com/?q=${encodeURIComponent(text)}`;
            openTrustedLinkIn(searchURL, "tab");
          }
        }
      });
    },
  },
];

if (typeof UC_API !== "undefined") {
  Runtime.startupFinished().then(() => {
    hotkeys.forEach((hotkey) => {
      Hotkeys.define(hotkey).autoAttach({ suppressOriginal: false });
    });
  });
}
