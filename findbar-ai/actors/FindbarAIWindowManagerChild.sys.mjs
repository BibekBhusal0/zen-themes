export class FindbarAIWindowManagerChild extends JSWindowActorChild {
  constructor() {
    super();
    this._currentHighlight = null;
    this._highlightTimer = null;
  }

  // handleEvent(event) {
  //   debugLog(`findbar: child handling event: ${event.type}`);
  //   if (event.type === "DOMContentLoaded") {
  //     this.sendAsyncMessage("FindbarAI:ContentLoaded", {
  //       url: this.document.location.href,
  //       title: this.document.title,
  //     });
  //   }
  // }

  debugLog(...args) {
    if (this.browsingContext.top) {
      this.browsingContext.top.window.console.log(
        "[findbar-ai] windowManager.js (Child):",
        ...args,
      );
    }
  }

  debugError(...args) {
    if (this.browsingContext.top) {
      this.browsingContext.top.window.console.error(
        "[findbar-ai] windowManager.js (Child Error):",
        ...args,
      );
    }
  }

  async receiveMessage(message) {
    this.debugLog(`Received message: ${message.name}`);
    switch (message.name) {
      case "FindbarAI:GetPageHTMLContent":
        return {
          content: this.document.documentElement.outerHTML,
          url: this.document.location.href,
          title: this.document.title,
        };

      case "FindbarAI:GetSelectedText":
        const selection = this.contentWindow.getSelection();
        return {
          selectedText: selection.toString(),
          hasSelection: !selection.isCollapsed,
        };

      case "FindbarAI:GetPageTextContent":
        return {
          textContent: this.extractTextContent(),
          url: this.document.location.href,
          title: this.document.title,
        };

      case "FindbarAI:HighlightAndScroll":
        return this.highlightAndScroll(message.data.text);

      default:
        this.debugLog(`Unhandled message: ${message.name}`);
    }
  }

  extractTextContent() {
    this.debugLog("extractTextContent called");
    const clonedDocument = this.document.cloneNode(true);
    const elementsToRemove = clonedDocument.querySelectorAll(
      "script, style, noscript, iframe, svg, canvas, input, textarea, select",
    );
    elementsToRemove.forEach((el) => el.remove());
    const textContent = clonedDocument.body.innerText
      .replace(/\s+/g, " ")
      .trim();
    return textContent;
  }

  injectHighlightStyle() {
    this.debugLog("injectHighlightStyle called");
    const styleId = "findbar-ai-highlight-style";
    if (this.document.getElementById(styleId)) return;

    this.debugLog("Injecting highlight style into the page.");
    const style = this.document.createElement("style");
    style.id = styleId;
    style.textContent = `
      mark.findbar-ai-highlight {
        background-color: yellow !important;
        color: black !important;
        outline: 1px solid orange !important;
      }
    `;
    this.document.head.appendChild(style);
  }

  clearHighlight() {
    this.debugLog("clearHighlight called");
    if (this._highlightTimer) {
      this.browsingContext.top.window.clearTimeout(this._highlightTimer);
      this._highlightTimer = null;
    }

    if (this._currentHighlight && this._currentHighlight.parentNode) {
      const parent = this._currentHighlight.parentNode;
      parent.replaceChild(
        this.document.createTextNode(this._currentHighlight.textContent),
        this._currentHighlight,
      );
      parent.normalize();
      this._currentHighlight = null;
    }
  }

  findRangeFromText(searchText) {
    this.debugLog(`Starting search for: "${searchText}"`);
    const walker = this.document.createTreeWalker(
      this.document.body,
      NodeFilter.SHOW_TEXT,
    );
    const nodes = [];
    let fullText = "";

    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (
        parent &&
        (parent.closest("script, style, noscript, [hidden]") ||
          getComputedStyle(parent).display === "none")
      ) {
        continue;
      }
      nodes.push({
        node: node,
        start: fullText.length,
        end: fullText.length + node.textContent.length,
      });
      fullText += node.textContent;
    }
    this.debugLog(
      `Constructed text from ${nodes.length} visible nodes. Total length: ${fullText.length} characters.`,
    );

    const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedText.replace(/\s+/g, "\\s+"), "i");
    this.debugLog("Created Regex:", searchRegex);

    const match = fullText.match(searchRegex);
    if (!match) {
      this.debugError(
        "Regex search failed. The provided text could not be found in the page's visible content.",
        `Searched for: "${searchText}"`,
      );
      return null;
    }

    const matchStartIndex = match.index;
    const matchEndIndex = matchStartIndex + match[0].length;
    this.debugLog(
      `Regex match found. Start Index: ${matchStartIndex}, End Index: ${matchEndIndex}`,
    );

    let startNode, startOffset, endNode, endOffset;

    this.debugLog("Mapping indices to DOM nodes...");
    for (const nodeInfo of nodes) {
      if (
        !startNode &&
        matchStartIndex >= nodeInfo.start &&
        matchStartIndex < nodeInfo.end
      ) {
        startNode = nodeInfo.node;
        startOffset = matchStartIndex - nodeInfo.start;
        this.debugLog(
          `Found startNode. Node:`,
          startNode,
          `Offset: ${startOffset}`,
        );
      }
      if (
        !endNode &&
        matchEndIndex > nodeInfo.start &&
        matchEndIndex <= nodeInfo.end
      ) {
        endNode = nodeInfo.node;
        endOffset = matchEndIndex - nodeInfo.start;
        this.debugLog(`Found endNode. Node:`, endNode, `Offset: ${endOffset}`);
        break;
      }
    }

    if (startNode && endNode) {
      this.debugLog(
        "Successfully found both start and end nodes. Creating range...",
      );
      const range = this.document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    }

    this.debugError("Failed to map character indices to DOM nodes.");
    return null;
  }

  highlightAndScroll(text) {
    this.debugLog("Highlight and scroll triggered with text:", `"${text}"`);
    this.injectHighlightStyle();
    this.clearHighlight();

    const range = this.findRangeFromText(text);

    if (range) {
      this.debugLog("Range object created successfully:", range);
      const mark = this.document.createElement("mark");
      mark.className = "findbar-ai-highlight";
      try {
        range.surroundContents(mark);
        this._currentHighlight = mark;
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
        this.debugLog("Highlight successful.");
        this._highlightTimer = this.browsingContext.top.window.setTimeout(
          () => this.clearHighlight(),
          3000,
        );
        return { success: true };
      } catch (e) {
        this.debugError(
          "Highlight failed. Could not wrap the found range with a <mark> tag:",
          e,
        );
        this.debugLog("Falling back to selecting the range and scrolling.");
        this.browsingContext.top.window.getSelection().removeAllRanges();
        this.browsingContext.top.window.getSelection().addRange(range);
        range.startContainer.parentElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return {
          success: false,
          error: "Could not highlight text, but scrolled to it.",
        };
      }
    } else {
      this.debugError(
        `Highlight failed. A DOM range could not be created for the text: "${text}"`,
      );
      return {
        success: false,
        error: "Text not found or could not be mapped in the DOM.",
      };
    }
  }
}
