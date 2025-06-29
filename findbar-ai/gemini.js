import { windowManagerAPI } from "./windowManager.js";
import getPref from "../utils/getPref.mjs";

// Prefs keys
const API_KEY = "extension.findbar-ai.gemini-api-key";
const MODEL = "extension.findbar-ai.gemini-model";
const GOD_MODE = "extension.findbar-ai.god-mode";
const DEBUG_MODE = "extension.findbar-ai.debug-mode";

// Debug logging helper
const debugLog = (...args) => {
  if (getPref(DEBUG_MODE, false)) {
    console.log("FindbarAI [Gemini]:", ...args);
  }
};

const debugError = (...args) => {
  if (getPref(DEBUG_MODE, false)) {
    console.error("FindbarAI [Gemini]:", ...args);
  }
};

// --- Internal Helper for Search ---
async function getSearchURL(engineName, searchTerm) {
  try {
    const engine = await Services.search.getEngineByName(engineName);
    if (engine) {
      const submission = engine.getSubmission(searchTerm.trim());
      return submission.uri.spec;
    }
    return null;
  } catch (e) {
    debugError(`Error getting search URL for engine "${engineName}".`, e);
    return null;
  }
}

// --- Tool Implementations ---
async function openLink(link, where = "new tab") {
  if (!link) return { error: "openLink requires a link." };
  const whereNormalized = where?.toLowerCase()?.trim();
  try {
    switch (whereNormalized) {
      case "current tab":
        openTrustedLinkIn(link, "current");
        break;
      case "new tab":
        openTrustedLinkIn(link, "tab");
        break;
      case "new window":
        openTrustedLinkIn(link, "window");
        break;
      case "incognito":
      case "private":
        window.openTrustedLinkIn(link, "window", { private: true });
        break;
      case "glance":
        if (window.gZenGlanceManager) {
          const rect = gBrowser.selectedBrowser.getBoundingClientRect();
          window.gZenGlanceManager.openGlance({
            url: link,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: 10,
            height: 10,
          });
        } else {
          openTrustedLinkIn(link, "tab");
          return { result: `Glance not available. Opened in a new tab.` };
        }
        break;
      case "vsplit":
      case "hsplit":
        if (window.gZenViewSplitter) {
          const sep = whereNormalized === "vsplit" ? "vsep" : "hsep";
          const tab1 = gBrowser.selectedTab;
          await openTrustedLinkIn(link, "tab");
          const tab2 = gBrowser.selectedTab;
          gZenViewSplitter.splitTabs([tab1, tab2], sep, 1);
        } else return { error: "Split view is not available." };
        break;
      default:
        openTrustedLinkIn(link, "tab");
        return {
          result: `Unknown location "${where}". Opened in a new tab as fallback.`,
        };
    }
    return { result: `Successfully opened ${link} in ${where}.` };
  } catch (e) {
    debugError(`Failed to open link "${link}" in "${where}".`, e);
    return { error: `Failed to open link.` };
  }
}

async function search(searchTerm, engineName, where) {
  const defaultEngine = Services.search.defaultEngine.name;
  const searchEngine = engineName || defaultEngine;
  if (!searchTerm) return { error: "Search tool requires a searchTerm." };

  const url = await getSearchURL(searchEngine, searchTerm);
  if (url) {
    return await openLink(url, where);
  } else {
    return { error: `Could not find search engine named '${searchEngine}'.` };
  }
}

async function newSplit(link1, link2, type = "horizontal") {
  if (!window.gZenViewSplitter)
    return { error: "Split view function is not available." };
  if (!link1 || !link2) return { error: "newSplit requires two links." };
  try {
    const sep = type.toLowerCase() === "vertical" ? "vsep" : "hsep";
    await openTrustedLinkIn(link1, "tab");
    const tab1 = gBrowser.selectedTab;
    await openTrustedLinkIn(link2, "tab");
    const tab2 = gBrowser.selectedTab;
    gZenViewSplitter.splitTabs([tab1, tab2], sep, 1);
    return {
      result: `Successfully created ${type} split view with the provided links.`,
    };
  } catch (e) {
    debugError("Failed to create split view.", e);
    return { error: "Failed to create split view." };
  }
}

const availableTools = {
  search,
  newSplit,
  openLink,
  getPageTextContent:
    windowManagerAPI.getPageTextContent.bind(windowManagerAPI),
  getHTMLContent: windowManagerAPI.getHTMLContent.bind(windowManagerAPI),
};

const toolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "search",
        description:
          "Performs a web search using a specified search engine and opens the results.",
        parameters: {
          type: "OBJECT",
          properties: {
            searchTerm: {
              type: "STRING",
              description: "The term to search for.",
            },
            engineName: {
              type: "STRING",
              description: "Optional. The name of the search engine to use.",
            },
            where: {
              type: "STRING",
              description:
                "Optional. Where to open the search results. Defaults to 'new tab'.",
            },
          },
          required: ["searchTerm"],
        },
      },
      {
        name: "openLink",
        description:
          "Opens a given URL in a specified location. Can also create a split view with the current tab.",
        parameters: {
          type: "OBJECT",
          properties: {
            link: { type: "STRING", description: "The URL to open." },
            where: {
              type: "STRING",
              description:
                "Where to open the link. Options: 'current tab', 'new tab', 'new window', 'incognito', 'glance', 'vsplit', 'hsplit'. Defaults to 'new tab'.",
            },
          },
          required: ["link"],
        },
      },
      {
        name: "newSplit",
        description:
          "Creates a split view by opening two new URLs in two new tabs, then arranging them side-by-side.",
        parameters: {
          type: "OBJECT",
          properties: {
            link1: {
              type: "STRING",
              description: "The URL for the first new tab.",
            },
            link2: {
              type: "STRING",
              description: "The URL for the second new tab.",
            },
            type: {
              type: "STRING",
              description:
                "The split type: 'horizontal' or 'vertical'. Defaults to 'horizontal'.",
            },
          },
          required: ["link1", "link2"],
        },
      },
      {
        name: "getPageTextContent",
        description:
          "Retrieves the text content of the current web page to answer questions if the initial context is insufficient.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "getHTMLContent",
        description:
          "Retrieves the full HTML source of the current web page for detailed analysis. Use this tool very rarely, only when text content is insufficient.",
        parameters: { type: "OBJECT", properties: {} },
      },
    ],
  },
];

const gemini = {
  history: [],
  systemInstruction: null,
  AVAILABLE_MODELS: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
  ],

  get apiKey() {
    return getPref(API_KEY, "");
  },
  set apiKey(value) {
    UC_API.Prefs.set(API_KEY, value || "");
  },

  get model() {
    return getPref(MODEL, "gemini-2.0-flash");
  },
  set model(value) {
    if (this.AVAILABLE_MODELS.includes(value)) UC_API.Prefs.set(MODEL, value);
  },

  get godMode() {
    return getPref(GOD_MODE, false);
  },

  get apiUrl() {
    const model = this.model;
    if (!model) return null;
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  },

  async updateSystemPrompt() {
    debugLog("Updating system prompt...");
    const promptText = await this.getSystemPrompt();
    this.setSystemPrompt(promptText);
  },

  async getSystemPrompt() {
    let systemPrompt = `You are a helpful AI assistant integrated into Zen Browser, a minimal and modern fork of Firefox. Your primary purpose is to answer user questions based on the content of the current webpage.

**Your Instructions:**
- Strictly base all your answers on the webpage content provided below.
- If the user's question cannot be answered from the content, state that the information is not available on the page.
- Be concise, accurate, and helpful.`;

    if (this.godMode) {
      const searchEngines = await Services.search.getVisibleEngines();
      const engineNames = searchEngines.map((e) => e.name).join(", ");
      const defaultEngine = Services.search.defaultEngine.name;

      systemPrompt += `
- When asked about your own abilities, describe the functions you can perform based on the tools listed below.

**GOD MODE ENABLED - TOOL USAGE:**
You have access to browser functions. The user knows you have these abilities.
- **CRITICAL**: When you decide to call a tool, your response MUST ONLY contain the \`functionCall\` part. Do NOT include any other text, as it will be hidden from the user and cause errors. Any text you want the user to see must be in the *next* turn after you receive the tool's output.
- Use tools when the user explicitly asks, or when it is the only logical way to fulfill their request (e.g., "search for...").

**Available Tools:**
- \`search(searchTerm, engineName, where)\`: Performs a web search. Available engines: ${engineNames}. The default is '${defaultEngine}'.
- \`openLink(link, where)\`: Opens a URL. Use this to open a single link or to create a split view with the *current* tab.
- \`newSplit(link1, link2, type)\`: Use this specifically for creating a split view with *two new tabs*.
- \`getPageTextContent()\` / \`getHTMLContent()\`: Use these to get updated page information if context is missing. Prefer \`getPageTextContent\`.`;
    }

    systemPrompt += `

Here is the initial info about the current page:
`;
    const pageContext = await windowManagerAPI.getPageTextContent();
    systemPrompt += JSON.stringify(pageContext);
    return systemPrompt;
  },

  setSystemPrompt(promptText) {
    this.systemInstruction = promptText
      ? { parts: [{ text: promptText }] }
      : null;
    return this;
  },

  async sendMessage(prompt, pageContext) {
    const apiKey = this.apiKey;
    const apiUrl = this.apiUrl;
    if (!apiKey || !apiUrl || !prompt || typeof prompt !== "string") {
      throw new Error("Invalid arguments for sendMessage.");
    }

    if (!this.systemInstruction) {
      await this.updateSystemPrompt();
    }

    const fullPrompt = `[Current Page Context: ${JSON.stringify(pageContext)}] ${prompt}`;
    this.history.push({ role: "user", parts: [{ text: fullPrompt }] });

    const requestBody = {
      contents: this.history,
      systemInstruction: this.systemInstruction,
    };

    if (this.godMode) {
      requestBody.tools = toolDeclarations;
    }

    let response = await fetch(apiUrl, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      this.history.pop();
      const errorData = await response.json();
      throw new Error(
        `API Error: ${response.status} - ${errorData.error.message}`,
      );
    }

    let data = await response.json();
    let modelResponse = data.candidates?.[0]?.content;

    if (!modelResponse) {
      this.history.pop();
      return "The model did not return a valid response.";
    }

    this.history.push(modelResponse);

    const functionCalls = modelResponse.parts.filter(
      (part) => part.functionCall,
    );

    if (this.godMode && functionCalls.length > 0) {
      debugLog("Function call(s) requested by model:", functionCalls);

      const functionResponses = [];
      for (const call of functionCalls) {
        const { name, args } = call.functionCall;
        if (availableTools[name]) {
          debugLog(`Executing tool: ${name} with args:`, args);
          const toolResult = await availableTools[name](args);
          debugLog(`Tool ${name} result:`, toolResult);
          functionResponses.push({
            functionResponse: { name, response: toolResult },
          });
        } else {
          debugError(`Tool ${name} not found!`);
          functionResponses.push({
            functionResponse: {
              name,
              response: { error: `Tool ${name} is not available.` },
            },
          });
        }
      }

      this.history.push({ role: "tool", parts: functionResponses });

      const secondRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: this.history,
          systemInstruction: this.systemInstruction,
        }),
      });

      if (!secondRes.ok) {
        this.history.splice(-2);
        const errorData = await secondRes.json();
        throw new Error(
          `API Error on second call: ${secondRes.status} - ${errorData.error.message}`,
        );
      }

      data = await secondRes.json();
      modelResponse = data.candidates?.[0]?.content;
      this.history.push(modelResponse);
    }

    const responseText =
      modelResponse.parts.find((part) => part.text)?.text || "";
    if (!responseText && functionCalls.length === 0) {
      this.history.pop();
    }

    return responseText || "I used my tools to complete your request.";
  },

  getHistory() {
    return [...this.history];
  },
  clearHistory() {
    this.history = [];
    return this;
  },
  getLastMessage() {
    return this.history.length > 0
      ? this.history[this.history.length - 1]
      : null;
  },
};

export default gemini;
