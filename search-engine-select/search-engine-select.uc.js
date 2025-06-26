// ==UserScript==
// @author         Bibek Bhusal
// @name           Search Engine Select
// @description    Adds a floating UI to switch search engines on a search results page.
// ==/UserScript==

(function() {
  "use strict";

  if (window.SearchEngineSwitcher) {
    window.SearchEngineSwitcher.destroy();
  }

  window.SearchEngineSwitcher = {
    DRAG_ENABLED: true,
    DEBUG_MODE: false,
    _container: null,
    _engineSelect: null,
    _engineOptions: null,
    _dragHandle: null,
    _styleElement: null,

    _engineCache: [],
    _currentSearchInfo: null,

    _isDragging: false,
    _startY: 0,
    _initialTop: 0,
    _savedTop: "50%",

    async init() {
      if (this.DEBUG_MODE) console.log("SES: Initializing...");
      await this.buildEngineRegexCache();
      this.createUI();
      this.attachEventListeners();
      this.updateSwitcherVisibility();
    },

    destroy() {
      if (this._container && this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }
      if (this._styleElement && this._styleElement.parentNode) {
        this._styleElement.parentNode.removeChild(this._styleElement);
      }
      gBrowser.tabContainer.removeEventListener("TabSelect", this);
      if (gBrowser.removeTabsProgressListener) {
        gBrowser.removeTabsProgressListener(this);
      }
      if (window.gURLBar) {
        gURLBar.inputField.removeEventListener(
          "keydown",
          this.urlBarKeyListener,
        );
      }
      this._container = null;
      if (this.DEBUG_MODE) console.log("SES: Destroyed successfully.");
    },

    googleFaviconAPI: (url) => {
      try {
        const hostName = new URL(url).hostname;
        return `https://s2.googleusercontent.com/s2/favicons?domain_url=https://${hostName}&sz=32`;
      } catch (e) {
        return null;
      }
    },

    getFaviconImg(engine) {
      const img = document.createElement("img");
      const fallbackIcon = "chrome://branding/content/icon32.png";
      const submissionUrlForFavicon =
        engine.getSubmission("test_query").uri.spec;

      if (engine.iconURI) {
        img.src = engine.iconURI.spec;
      } else {
        img.src =
          window.SearchEngineSwitcher.googleFaviconAPI(
            submissionUrlForFavicon,
          ) || fallbackIcon;
      }

      img.onerror = () => {
        img.src = fallbackIcon;
      };
      return img;
    },

    async buildEngineRegexCache() {
      if (this.DEBUG_MODE) console.log("SES: Building engine regex cache...");
      this._engineCache = [];
      const engines = await Services.search.getVisibleEngines();
      const PLACEHOLDER = "SEARCH_TERM_PLACEHOLDER_E6A8D";

      for (const engine of engines) {
        try {
          const submission = engine.getSubmission(PLACEHOLDER);
          if (!submission) continue;

          let urlTemplate = submission.uri.spec;

          let regexString = urlTemplate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          const placeholderForRegex = PLACEHOLDER.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );
          regexString = regexString.replace(placeholderForRegex, "([^&]*)");

          const regex = new RegExp(`^${regexString}`);
          this._engineCache.push({ engine, regex });

          if (this.DEBUG_MODE)
            console.log(`  - Engine: ${engine.name}, Regex: ${regex.source}`);
        } catch (e) {
          console.error(`SES: Failed to process engine ${engine.name}`, e);
        }
      }
    },

    matchUrl(url) {
      if (!url) return null;
      if (this.DEBUG_MODE) console.log(`SES: Matching URL -> ${url}`);

      for (const item of this._engineCache) {
        const match = url.match(item.regex);
        if (match && match[1]) {
          try {
            const term = decodeURIComponent(match[1].replace(/\+/g, " "));
            if (this.DEBUG_MODE)
              console.log(
                `  ✔️ MATCHED: Engine='${item.engine.name}', Term='${term}'`,
              );
            return { engine: item.engine, term: term };
          } catch (e) {
            continue;
          }
        }
      }
      if (this.DEBUG_MODE) console.log("  ❌ NO MATCH FOUND");
      return null;
    },

    updateSwitcherVisibility() {
      const url = gBrowser.selectedBrowser.currentURI.spec;
      const newSearchInfo = this.matchUrl(url);

      if (newSearchInfo) {
        this._currentSearchInfo = newSearchInfo;
      }

      if (this._currentSearchInfo) {
        this._show();
      } else {
        this._hide();
      }
    },

    _show() {
      if (!this._container) return;
      this._container.style.display = "flex";
      this.updateSelectedEngineDisplay();
    },

    _hide() {
      if (!this._container) return;
      this._container.style.display = "none";
      if (this._engineOptions) {
        this._engineOptions.style.display = "none";
      }
    },

    updateSelectedEngineDisplay() {
      if (!this._currentSearchInfo || !this._engineSelect) return;

      this._engineSelect.innerHTML = ""; // Clear previous content
      const { engine } = this._currentSearchInfo;

      const img = this.getFaviconImg(engine);

      const nameSpan = document.createElement("span");
      nameSpan.textContent = engine.name;

      this._engineSelect.appendChild(img);
      this._engineSelect.appendChild(nameSpan);
    },

    handleEvent() {
      const url = gBrowser.selectedBrowser.currentURI.spec;
      this._currentSearchInfo = this.matchUrl(url);
      this.updateSwitcherVisibility();
    },

    onLocationChange(browser) {
      if (browser === gBrowser.selectedBrowser) {
        const url = browser.currentURI.spec;
        const newSearchInfo = this.matchUrl(url);

        if (newSearchInfo) {
          this._currentSearchInfo = newSearchInfo;
          this._show();
        }
      }
    },

    urlBarKeyListener: async (event) => {
      if (event.key === "Enter") {
        const self = window.SearchEngineSwitcher;
        let engineName;
        try {
          engineName = document
            .getElementById("urlbar-search-mode-indicator-title")
            .innerText.trim();
        } catch (e) {
          if (self.DEBUG_MODE)
            console.log(
              "SES: Could not find search mode indicator, likely not a search.",
            );
          return;
        }

        if (engineName) {
          const engine = await Services.search.getEngineByName(engineName);
          const term = gURLBar.value.trim();

          if (engine && term) {
            if (self.DEBUG_MODE)
              console.log(
                `SES: URL bar search detected. Engine: ${engine.name}, Term: ${term}`,
              );
            self._currentSearchInfo = { engine, term };
            self._show();
          }
        }
      }
    },

    async handleEngineClick(event, newEngine) {
      event.preventDefault();
      event.stopPropagation();

      if (!this._currentSearchInfo || !this._currentSearchInfo.term) return;

      if (this._currentSearchInfo.engine.name === newEngine.name) {
        if (this.DEBUG_MODE)
          console.log(
            `SES: Click on same engine ('${newEngine.name}'). Aborting.`,
          );
        this._engineOptions.style.display = "none";
        this._container.classList.remove("options-visible");
        return;
      }

      const term = this._currentSearchInfo.term;
      const submission = newEngine.getSubmission(term);
      const newUrl = submission.uri.spec;

      if (this.DEBUG_MODE)
        console.log(
          `SES: Click on '${newEngine.name}', Term: '${term}'. URL: ${newUrl}`,
        );

      this._engineOptions.style.display = "none";
      this._container.classList.remove("options-visible");

      this._currentSearchInfo.engine = newEngine;
      this.updateSelectedEngineDisplay();

      if (
        event.button === 0 &&
        event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        // Ctrl+Click: Split View
        if (this.DEBUG_MODE) console.log("  > Action: Split View");
        if (window.gZenViewSplitter) {
          const previousTab = window.gBrowser.selectedTab;
          await openTrustedLinkIn(newUrl, "tab");
          const currentTab = window.gBrowser.selectedTab;
          gZenViewSplitter.splitTabs([currentTab, previousTab], "vsep", 1);
        } else {
          openTrustedLinkIn(newUrl, "tab");
        }
      } else if (event.button === 0 && event.altKey) {
        // Alt+Click: Glance
        if (this.DEBUG_MODE) console.log("  > Action: Glance");
        if (window.gZenGlanceManager) {
          const rect = gBrowser.selectedBrowser.getBoundingClientRect();
          window.gZenGlanceManager.openGlance({
            url: newUrl,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: 10,
            height: 10,
          });
        } else {
          openTrustedLinkIn(newUrl, "tab");
        }
      } else if (event.button === 1) {
        // Middle Click: Background Tab
        if (this.DEBUG_MODE) console.log("  > Action: Background Tab");
        openTrustedLinkIn(newUrl, "tab-background");
      } else if (event.button === 0) {
        // Left Click: Current Tab
        if (this.DEBUG_MODE) console.log("  > Action: Current Tab");
        openTrustedLinkIn(newUrl, "current");
      }
    },

    toggleOptions: function(event) {
      event.stopPropagation();
      const shouldOpen = this._engineOptions.style.display !== "block";

      if (shouldOpen) {
        const containerRect = this._container.getBoundingClientRect();
        const menuHeight = 200; // Estimated height

        this._engineOptions.classList.remove("popup-above", "popup-below");

        if (containerRect.top < menuHeight + 20) {
          this._engineOptions.classList.add("popup-below");
        } else {
          this._engineOptions.classList.add("popup-above");
        }
        this._engineOptions.style.display = "block";
        this._container.classList.add("options-visible");
      } else {
        this._engineOptions.style.display = "none";
        this._container.classList.remove("options-visible");
      }
    },

    createUI() {
      this._container = document.createElement("div");
      this._container.id = "search-engine-switcher-container";
      this._container.style.top = this._savedTop;

      this._engineSelect = document.createElement("div");
      this._engineSelect.id = "ses-engine-select";

      this._engineOptions = document.createElement("div");
      this._engineOptions.id = "ses-engine-options";

      if (this.DRAG_ENABLED) {
        this._dragHandle = document.createElement("div");
        this._dragHandle.id = "ses-drag-handle";
        this.addDragListeners();
      }

      this._engineSelect.addEventListener(
        "click",
        this.toggleOptions.bind(this),
      );
      document.addEventListener("click", () => {
        this._engineOptions.style.display = "none";
        this._container.classList.remove("options-visible");
      });

      this._container.appendChild(this._engineSelect);
      if (this.DRAG_ENABLED) this._container.appendChild(this._dragHandle);
      this._container.appendChild(this._engineOptions); // Popover is a sibling

      document.documentElement.appendChild(this._container);
      this.populateEngineList();
    },

    async populateEngineList() {
      this._engineOptions.innerHTML = "";
      const engines = await Services.search.getVisibleEngines();
      engines.forEach((engine) => {
        const option = document.createElement("div");
        option.className = "ses-engine-option";
        option.title = `Search with ${engine.name}`;

        const img = this.getFaviconImg(engine);
        const name = document.createElement("span");
        name.textContent = engine.name;

        option.appendChild(img);
        option.appendChild(name);
        option.addEventListener("mousedown", (e) =>
          this.handleEngineClick(e, engine),
        );
        this._engineOptions.appendChild(option);
      });
    },

    addDragListeners() {
      this._dragHandle.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        this._isDragging = true;
        this._engineOptions.style.display = "none";
        this._container.classList.remove("options-visible");
        this._container.classList.add("is-dragging");

        this._startY = e.clientY;
        this._initialTop = this._container.offsetTop;
        this._dragHandle.style.cursor = "grabbing";
        document.addEventListener(
          "mousemove",
          (this._boundDoDrag = this._doDrag.bind(this)),
        );
        document.addEventListener(
          "mouseup",
          (this._boundStopDrag = this._stopDrag.bind(this)),
        );
      });
    },

    _doDrag(e) {
      if (!this._isDragging) return;
      e.preventDefault();
      let newTop = this._initialTop + (e.clientY - this._startY);
      const minTop = 10;
      const maxTop = window.innerHeight - this._container.offsetHeight - 10;
      newTop = Math.max(minTop, Math.min(newTop, maxTop));
      this._container.style.top = `${newTop}px`;
    },

    _stopDrag() {
      if (!this._isDragging) return;
      this._isDragging = false;
      this._container.classList.remove("is-dragging");
      this._dragHandle.style.cursor = "grab";
      this._savedTop = this._container.style.top;
      document.removeEventListener("mousemove", this._boundDoDrag);
      document.removeEventListener("mouseup", this._boundStopDrag);
    },

    attachEventListeners() {
      gBrowser.tabContainer.addEventListener("TabSelect", this, false);
      gBrowser.addTabsProgressListener(this);
      if (window.gURLBar) {
        gURLBar.inputField.addEventListener("keydown", this.urlBarKeyListener);
      }
    },
  };

  if (gBrowserInit.delayedStartupFinished) {
    window.SearchEngineSwitcher.init();
  } else {
    let obs = (s, t) => {
      if (t === "browser-delayed-startup-finished" && s === window) {
        Services.obs.removeObserver(obs, t);
        window.SearchEngineSwitcher.init();
      }
    };
    Services.obs.addObserver(obs, "browser-delayed-startup-finished");
  }
})();
