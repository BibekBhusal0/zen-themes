// ==UserScript==
// @name           Complete Hotkeys
// @description    Full set of custom hotkeys
// ==/UserScript==

const { Runtime, Hotkeys, Prefs } = UC_API;

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
        console.log("Copied GitHub repo: " + repoString);
      })
      .catch(() => {
        console.log("Failed to copy GitHub repo");
      });
  } else {
    console.log("Not a GitHub repository page");
  }
};

const alternateSearch = (window) => {
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
      if (targetSearchEngine === "Google") {
        newURL = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      } else if (targetSearchEngine === "DuckDuckGo") {
        newURL = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`;
      } else {
        console.log("Not a recognized search engine.");
        return;
      }
      openTrustedLinkIn(newURL, "tab");
      console.log(`Searching ${targetSearchEngine} for '${searchQuery}'`);
    } else {
      console.log("No search query found.");
    }
  } catch (error) {
    console.log("Alternate search failed.");
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
    command: (param) => console.log("Test hotkey pressed! Parameter:", param),
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
    id: "alternateSearch",
    modifiers: "alt",
    key: "Y",
    command: alternateSearch,
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
    id: "openSettings",
    modifiers: "ctrl alt",
    key: "S",
    command: () => openTrustedLinkIn("about:preferences", "tab"),
  },

  {
    id: "toggleDarkMode",
    modifiers: "ctrl alt shift",
    key: "D",
    command: () => togglePref("pdf.dark.mode.disabled"),
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
