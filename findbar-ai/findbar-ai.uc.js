import { markedStyles } from "chrome://userscripts/content/engine/marked.js";

// prefs keys
const API_KEY = "extension.findbar-ai.gemini-api-key";
const MODEL = "extension.findbar-ai.gemini-model";
const GOD_MODE = "extension.findbar-ai.god-mode";
const DEBUG_MODE = "extension.findbar-ai.debug-mode";
const CITATIONS_ENABLED = "extension.findbar-ai.citations-enabled";
const ENABLED = "extension.findbar-ai.enabled";
const MINIMAL = "extension.findbar-ai.minimal";

// TODO: impliment this
const CONFORMATION = "extension.findbar-ai.confirmation-before-tool-call";
const SHOW_TOOL_CALL = "extension.findbar-ai.show-tool-call";
const CONTEXT_MENU_ENABLED = "extension.findbar-ai.context-menu-enabled";
const DND_ENABLED = "extension.findbar-ai.dnd-enabled";
const POSITION = "extension.findbar-ai.position";

const getPref = (key, defaultValue) => {
  try {
    const pref = UC_API.Prefs.get(key);
    if (!pref) return defaultValue;
    if (!pref.exists()) return defaultValue;
    return pref.value;
  } catch {
    return defaultValue;
  }
};

const getUrlAndTitle = () => {
  return {
    url: gBrowser.currentURI.spec,
    title: gBrowser.selectedBrowser.contentTitle,
  };
};

const _actors = new Set();
let _lazy = {};
ChromeUtils.defineESModuleGetters(_lazy, {
  ActorManagerParent: "resource://gre/modules/ActorManagerParent.sys.mjs",
});

const windowManagerName = "FindbarAIWindowManager";

// Debug logging helper
const debugLog = (...args) => {
  if (getPref(DEBUG_MODE, false)) {
    console.log(...args);
  }
};

const debugError = (...args) => {
  if (getPref(DEBUG_MODE, false)) {
    console.error(...args);
  }
};

const windowManager = () => {
  if (_actors.has(windowManagerName)) {
    return;
  }

  const decl = {};
  decl[windowManagerName] = {
    parent: {
      esModuleURI:
        "chrome://userscripts/content/FindbarAIWindowManagerParent.sys.mjs",
    },
    child: {
      esModuleURI:
        "chrome://userscripts/content/FindbarAIWindowManagerChild.sys.mjs",
      events: {
        DOMContentLoaded: {},
      },
    },
    matches: ["https://*", "http://*"],
  };

  try {
    _lazy.ActorManagerParent.addJSWindowActors(decl);
    _actors.add(windowManagerName);
    debugLog("FindbarAI WindowManager registered successfully");
  } catch (e) {
    debugError(`Failed to register JSWindowActor: ${e}`);
  }
};

windowManager();
export const windowManagerAPI = {
  getWindowManager() {
    try {
      if (!gBrowser || !gBrowser.selectedBrowser) return undefined;
      const context = gBrowser.selectedBrowser.browsingContext;
      if (!context || !context.currentWindowContext) return undefined;
      return context.currentWindowContext.getActor(windowManagerName);
    } catch {
      return undefined;
    }
  },

  async getHTMLContent() {
    const wm = this.getWindowManager();
    if (!wm) return {};
    try {
      return await wm.getPageHTMLContent();
    } catch (error) {
      debugError("Failed to get page HTML content:", error);
      return {};
    }
  },

  async getSelectedText() {
    const wm = this.getWindowManager();
    if (!wm) return getUrlAndTitle();
    try {
      return await wm.getSelectedText();
    } catch (error) {
      debugError("Failed to get selected text:", error);
      return getUrlAndTitle();
    }
  },

  async getPageTextContent() {
    const wm = this.getWindowManager();
    if (!wm) return getUrlAndTitle();
    try {
      return await wm.getPageTextContent();
    } catch (error) {
      debugError("Failed to get page text content:", error);
      return getUrlAndTitle();
    }
  },

  async highlightAndScrollToText(text) {
    // __AUTO_GENERATED_PRINT_VAR_START__
    console.log("highlightAndScrollToText text:", text); // __AUTO_GENERATED_PRINT_VAR_END__
    const wm = this.getWindowManager();
    if (!wm) return { error: "Window manager not available." };
    try {
      return await wm.highlightAndScrollToText(text);
    } catch (error) {
      debugError("Failed to highlight text:", error);
      return { error: "Failed to highlight text." };
    }
  },
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
async function openLink(args) {
  const { link, where = "new tab" } = args;
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

async function search(args) {
  const { searchTerm, engineName, where } = args;
  const defaultEngine = Services.search.defaultEngine.name;
  const searchEngine = engineName || defaultEngine;
  if (!searchTerm) return { error: "Search tool requires a searchTerm." };

  const url = await getSearchURL(searchEngine, searchTerm);
  if (url) {
    return await openLink({ link: url, where });
  } else {
    return { error: `Could not find search engine named '${searchEngine}'.` };
  }
}

async function newSplit(args) {
  const { link1, link2, type = "vertical" } = args;
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

// TODO:
// --- Tool for browser control ---
function compactMode() { }
function getBookmakrs() { }
function addBookmakrs() { }
function removeBookmarks() { }

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
                "Optional. Where to open the search results. Options: 'current tab', 'new tab', 'new window', 'incognito', 'glance', 'vsplit', 'hsplit'. Defaults to 'new tab'. Note that 'glance', 'vsplit' and 'hsplit' are special to zen browser. 'glance' opens in small popup and 'vsplit' and 'hsplit' opens in vertical and horizontal split respectively. When user says open in split and don't spicify 'vsplit' or 'hsplit' default to 'vsplit'.",
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
                "Optional. Where to open the link. Options: 'current tab', 'new tab', 'new window', 'incognito', 'glance', 'vsplit', 'hsplit'. Defaults to 'new tab'. Note that 'glance', 'vsplit' and 'hsplit' are special to zen browser. 'glance' opens in small popup and 'vsplit' and 'hsplit' opens in vertical and horizontal split respectively. When user says open in split and don't spicify 'vsplit' or 'hsplit' default to 'vsplit'.",
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
                "Optional, The split type: 'horizontal' or 'vertical'. Defaults to 'vertical'.",
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
  get citationsEnabled() {
    return getPref(CITATIONS_ENABLED, true);
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

## Your Instructions:
- Be concise, accurate, and helpful.`;

    if (this.godMode) {
      const searchEngines = await Services.search.getVisibleEngines();
      const engineNames = searchEngines.map((e) => e.name).join(", ");
      const defaultEngine = Services.search.defaultEngine.name;

      systemPrompt += `
- When asked about your own abilities, describe the functions you can perform based on the tools listed below.

## GOD MODE ENABLED - TOOL USAGE:
You have access to browser functions. The user knows you have these abilities.
- **CRITICAL**: When you decide to call a tool, give short summary of what tool are you calling and why?
- Use tools when the user explicitly asks, or when it is the only logical way to fulfill their request (e.g., "search for...").

## Available Tools:
- \`search(searchTerm, engineName, where)\`: Performs a web search. Available engines: ${engineNames}. The default is '${defaultEngine}'.
- \`openLink(link, where)\`: Opens a URL. Use this to open a single link or to create a split view with the *current* tab.
- \`newSplit(link1, link2, type)\`: Use this specifically for creating a split view with *two new tabs*.
- \`getPageTextContent()\` / \`getHTMLContent()\`: Use these to get updated page information if context is missing. Prefer \`getPageTextContent\`.

## More instructions for Running tools
- While running tool like \`openLink\` and \`newSplit\` make sure URL is valid.
- User will provide URL and title of current of webpage. If you need more context, use the \`getPageTextContent\` or \`getHTMLContent\` tools.
- When the user asks you to "read the current page", use the \`getPageTextContent()\` or \`getHTMLContent\` tool.
- If the user asks you to open a link by its text (e.g., "click the 'About Us' link"), you must first use \`getHTMLContent()\` to find the link's full URL, then use \`openLink()\` to open it.

## Tool Call Examples:
Therse are just examples for you on how you can use tools calls, each example give you some concept, the concept is not specific to single tool.

### Use default value when user don't provides full information, If user don't provide default value you may ask and even give options if possible
#### Searching the Web: 
-   **User Prompt:** "search for firefox themes"
-   **Your Tool Call:** \`{"functionCall": {"name": "search", "args": {"searchTerm": "firefox themes", "engineName": "${defaultEngine}"}}}\`

### Make sure you are calling tools with correct parameters.
#### Opening a Single Link:
-   **User Prompt:** "open github"
-   **Your Tool Call:** \`{"functionCall": {"name": "openLink", "args": {"link": "https://github.com", "where": "new tab"}}}\`

#### Creating a Split View with Two New Pages:
-   **User Prompt:** "show me youtube and twitch side by side"
-   **Your Tool Call:** \`{"functionCall": {"name": "newSplit", "args": {"link1": "https://youtube.com", "link2": "https://twitch.tv"}}}\`

### Use tools to get more context: If user ask anything whose answer is unknown to you and it can be obtained via tool call use it.
#### Reading the Current Page for Context
-   **User Prompt:** "summarize this page for me"
-   **Your Tool Call:** \`{"functionCall": {"name": "getPageTextContent", "args": {}}}\`

### Taking multiple steps; you might need for previous tool to compete and give you output before calling next tool
#### Finding and Clicking a Link on the Current Page
-   **User Prompt:** "click on the contact link"
-   **Your First Tool Call:** \`{"functionCall": {"name": "getHTMLContent", "args": {}}}\`
-   **Your Second Tool Call (after receiving HTML and finding the link):** \`{"functionCall": {"name": "openLink", "args": {"link": "https://example.com/contact-us"}}}\`

### Calling multiple tools at once.
#### Making 2 searches in split 
-   **User Prompt:** "Search for Japan in google and search for America in Youtube. Open them in vertical split."
-   **Your First Tool Call:** \`{"functionCall": {"name": "search", "args": {"searchTerm": "Japan", "engineName": "Google", "where": "new tab"}}}\`
-   **Your Second Tool Call:** \`{"functionCall": {"name": "search", "args": {"searchTerm": "America", "engineName": "Youtube", "where": "vsplit"}}}\`

*(Available search engines: ${engineNames}. Default is '${defaultEngine}'.)*
`;
    }

    if (this.citationsEnabled) {
      systemPrompt += `

## Citation Instructions
- **Output Format**: Your entire response **MUST** be a single, valid JSON object with two keys: \`"answer"\` and \`"citations"\`.
- **Answer**: The \`"answer"\` key holds the conversational text. Use Markdown Syntax for formatting like lists, bolding, etc.
- **Citations**: The \`"citations"\` key holds an array of citation objects.
- **When to Cite**: For any statement of fact that is directly supported by the provided page content, you **SHOULD** provide a citation. It is not mandatory for every sentence.
- **How to Cite**: In your \`"answer"\`, append a marker like \`[1]\`, \`[2]\`. Each marker must correspond to a citation object in the array.
- **CRITICAL RULES FOR CITATIONS**:
    1.  **source_quote**: This MUST be the **exact, verbatim, and short** text from the page content (typically a single sentence or less).
    2.  **Accuracy**: The \`"source_quote"\` field must be identical to the text on the page, including punctuation and casing.
    3.  **Multiple Citations**: If multiple sources support one sentence, format them like \`[1][2]\`, not \`[1,2]\`.
    4.  **Unique IDs**: Each citation object **must** have a unique \`"id"\` that matches its marker in the answer text.
- **Do Not Cite**: Do not cite your own abilities, general greetings, or information not from the provided text.
- **Tool Calls**: If you call a tool, you **must not** provide citations in the same turn.

### Citation Examples

Here are some examples demonstrating the correct JSON output format.

**Example 1: General Question with a List and Multiple Citations**
-   **User Prompt:** "What are the main benefits of using this library?"
-   **Your JSON Response:**
    \`\`\`json
    {
      "answer": "This library offers several key benefits:\n\n*   **High Performance**: It is designed to be fast and efficient for large-scale data processing [1].\n*   **Flexibility**: You can integrate it with various frontend frameworks [2].\n*   **Ease of Use**: The API is well-documented and simple to get started with [3].",
      "citations": [
        {
          "id": 1,
          "source_quote": "The new architecture provides significant performance gains, especially for large-scale data processing."
        },
        {
          "id": 2,
          "source_quote": "It is framework-agnostic, offering adapters for React, Vue, and Svelte."
        },
        {
          "id": 3,
          "source_quote": "Our extensive documentation and simple API make getting started a breeze."
        }
      ]
    }
    \`\`\`

**Example 2: A Sentence Supported by Two Different Sources**
-   **User Prompt:** "Tell me about the project's history."
-   **Your JSON Response:**
    \`\`\`json
    {
      "answer": "The project was initially created in 2021 [1] and later became open-source in 2022 [2].",
      "citations": [
        {
          "id": 1,
          "source_quote": "Development began on the initial prototype in early 2021."
        },
        {
          "id": 2,
          "source_quote": "We are proud to announce that as of September 2022, the project is fully open-source."
        }
      ]
    }
    \`\`\`

**Example 3: The WRONG way (What NOT to do)**
This is incorrect because it uses one citation \`[1]\` for three different facts. This is lazy and unhelpful.
-   **Your JSON Response (Incorrect):**
    \`\`\`json
    {
      "answer": "This project is a toolkit for loading custom JavaScript into the browser [1]. Its main features include a modern UI [1] and an API for managing hotkeys and notifications [1].",
      "citations": [
        {
          "id": 1,
          "source_quote": "...a toolkit for loading custom JavaScript... It has features like a modern UI... provides an API for hotkeys and notifications..."
        }
      ]
    }
    \`\`\`

**Example 4: The WRONG way (What NOT to do)**
This is incorrect because it uses one citation same id for all facts.
\`\`\`json
{
  "answer": "Novel is a Notion-style WYSIWYG editor with AI-powered autocompletion [1]. It is built with Tiptap and Vercel AI SDK [1]. You can install it using npm [1]. Features include a slash menu, bubble menu, AI autocomplete, and image uploads [1].",
  "citations": [
    {
      "id": 1,
      "source_quote": "Novel is a Notion-style WYSIWYG editor with AI-powered autocompletion."
    },
    {
      "id": 1,
      "source_quote": "Built with Tiptap + Vercel AI SDK."
    },
    {
      "id": 1,
      "source_quote": "Installation npm i novel"
    },
    {
      "id": 1,
      "source_quote": "Features Slash menu & bubble menu AI autocomplete (type ++ to activate, or select from slash menu) Image uploads (drag & drop / copy & paste, or select from slash menu)"
    }
  ]
}
\`\`\`

**Example 5: The correct format of previous example**
This example is correct, note that it contain unique \`id\`, and each in text citation match to each citation \`id\`.
\`\`\`json
{
  "answer": "Novel is a Notion-style WYSIWYG editor with AI-powered autocompletion [1]. It is built with Tiptap and Vercel AI SDK [2]. You can install it using npm [3]. Features include a slash menu, bubble menu, AI autocomplete, and image uploads [4].",
  "citations": [
    {
      "id": 1,
      "source_quote": "Novel is a Notion-style WYSIWYG editor with AI-powered autocompletion."
    },
    {
      "id": 2,
      "source_quote": "Built with Tiptap + Vercel AI SDK."
    },
    {
      "id": 3,
      "source_quote": "Installation npm i novel"
    },
    {
      "id": 4,
      "source_quote": "Features Slash menu & bubble menu AI autocomplete (type ++ to activate, or select from slash menu) Image uploads (drag & drop / copy & paste, or select from slash menu)"
    }
  ]
}
\`\`\`
`;
    }

    if (!this.godMode) {
      systemPrompt += `
- Strictly base all your answers on the webpage content provided below.
- If the user's question cannot be answered from the content, state that the information is not available on the page.

Here is the initial info about the current page:
`;
      const pageContext = await windowManagerAPI.getPageTextContent();
      systemPrompt += JSON.stringify(pageContext);
    }

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

    const fullPrompt = `[Current Page Context: ${JSON.stringify(pageContext || {})}] ${prompt}`;
    this.history.push({ role: "user", parts: [{ text: fullPrompt }] });

    const requestBody = {
      contents: this.history,
      systemInstruction: this.systemInstruction,
    };

    if (this.citationsEnabled) {
      requestBody.generationConfig = { responseMimeType: "application/json" };
    }

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
      return { answer: "The model did not return a valid response." };
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
          debugLog(`Executing tool: "${name}" with args:`, args);
          const toolResult = await availableTools[name](args);
          debugLog(`Tool "${name}" executed. Result:`, toolResult);
          functionResponses.push({
            functionResponse: { name, response: toolResult },
          });
        } else {
          debugError(`Tool "${name}" not found!`);
          functionResponses.push({
            functionResponse: {
              name,
              response: { error: `Tool "${name}" is not available.` },
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
          generationConfig: this.citationsEnabled
            ? { responseMimeType: "application/json" }
            : {},
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

    if (this.citationsEnabled) {
      try {
        const responseText =
          modelResponse.parts.find((part) => part.text)?.text || "{}";
        const parsedResponse = JSON.parse(responseText);
        debugLog("Parsed AI Response:", parsedResponse);

        if (!parsedResponse.answer) {
          if (functionCalls.length > 0)
            return { answer: "I used my tools to complete your request." };
          this.history.pop();
        }
        return parsedResponse;
      } catch (e) {
        const rawText = modelResponse.parts[0]?.text || "[Empty Response]";
        debugError(
          "Failed to parse JSON response from AI:",
          e,
          "Raw Text:",
          rawText,
        );
        return {
          answer:
            modelResponse.parts[0].text ||
            "Sorry, I received an invalid response from the server.",
        };
      }
    } else {
      const responseText =
        modelResponse.parts.find((part) => part.text)?.text || "";
      if (!responseText && functionCalls.length === 0) {
        this.history.pop();
      }
      return {
        answer: responseText || "I used my tools to complete your request.",
      };
    }
  },

  getHistory() {
    return [...this.history];
  },
  clearData() {
    this.history = [];
    this.setSystemPrompt(null);
  },
  getLastMessage() {
    return this.history.length > 0
      ? this.history[this.history.length - 1]
      : null;
  },
};

const createHTMLElement = (htmlString) => {
  let element = new DOMParser().parseFromString(htmlString, "text/html");
  if (element.body.children.length) element = element.body.firstChild;
  else element = element.head.firstChild;
  return element;
};

//default configurations
UC_API.Prefs.setIfUnset(MINIMAL, true);
UC_API.Prefs.setIfUnset(CITATIONS_ENABLED, false); // experimental

var markdownStylesInjected = false;
const injectMarkdownStyles = () => {
  if (!markedStyles) return false;
  try {
    const styleTag = createHTMLElement(`<style>${markedStyles}<style>`);
    document.head.appendChild(styleTag);
    markdownStylesInjected = true;
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
};

function parseMD(markdown) {
  const markedOptions = { breaks: true, gfm: true };
  if (!markdownStylesInjected) {
    injectMarkdownStyles();
  }
  const content = window.marked
    ? window.marked.parse(markdown, markedOptions)
    : markdown;
  let htmlContent = createHTMLElement(
    `<div class="markdown-body">${content}</div>`,
  );

  return htmlContent;
}

const findbar = {
  findbar: null,
  expandButton: null,
  chatContainer: null,
  apiKeyContainer: null,
  _updateFindbar: null,
  _addKeymaps: null,
  _handleInputKeyPress: null,
  _clearGeminiData: null,
  _isExpanded: false,

  get expanded() {
    return this._isExpanded;
  },
  set expanded(value) {
    this._isExpanded = value;
    if (!this.findbar) return;

    if (this._isExpanded) {
      this.findbar.classList.add("ai-expanded");
      this.show();
      this.showAIInterface();
      this.focusPrompt();
      const messagesContainer =
        this?.chatContainer?.querySelector("#chat-messages");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } else {
      this.findbar.classList.remove("ai-expanded");
      this.hideAIInterface();
    }
  },
  toggleExpanded() {
    this.expanded = !this.expanded;
  },

  get enabled() {
    return getPref(ENABLED, true);
  },
  set enabled(value) {
    if (typeof value === "boolean") UC_API.Prefs.set(ENABLED, value);
  },
  toggleEnabled() {
    this.enabled = !this.enabled;
  },
  handleEnabledChange(enabled) {
    if (enabled.value) this.init();
    else this.destroy();
  },

  get minimal() {
    return getPref(MINIMAL, true);
  },
  set minimal(value) {
    if (typeof value === "boolean") UC_API.Prefs.set(MINIMAL, value);
  },

  updateFindbar() {
    this.removeExpandButton();
    this.removeAIInterface();
    this.hide();
    this.expanded = false;
    if (!gemini.godMode) {
      gemini.setSystemPrompt(null);
      gemini.clearData();
    }
    gBrowser.getFindBar().then((findbar) => {
      this.findbar = findbar;
      this.addExpandButton();
      this.findbar._findField.addEventListener(
        "keypress",
        this._handleInputKeyPress,
      );
      this.findbar._findField.placeholder = "Press Alt + Enter to ask AI";
    });
  },

  show() {
    if (!this.findbar) return false;
    this.findbar.hidden = false;
    if (!this.expanded) this.findbar._findField.focus();
    return true;
  },
  hide() {
    if (!this.findbar) return false;
    this.findbar.hidden = true;
    this.findbar.close();
    return true;
  },
  toggleVisibility() {
    if (!this.findbar) return;
    if (this.findbar.hidden) this.show();
    else this.hide();
  },

  createAPIKeyInterface() {
    const html = `
      <div class="findbar-ai-setup">
        <div class="ai-setup-content">
          <h3>Gemini AI Setup Required</h3>
          <p>To use AI features, you need a Gemini API key.</p>
          <div class="api-key-input-group">
            <input type="password" id="gemini-api-key" placeholder="Enter your Gemini API key" />
            <button id="save-api-key">Save</button>
          </div>
          <div class="api-key-links">
            <button id="get-api-key-link">Get API Key</button>
          </div>
        </div>
      </div>`;
    const container = createHTMLElement(html);

    const input = container.querySelector("#gemini-api-key");
    const saveBtn = container.querySelector("#save-api-key");
    const getApiKeyLink = container.querySelector("#get-api-key-link");

    getApiKeyLink.addEventListener("click", () => {
      openTrustedLinkIn("https://aistudio.google.com/app/apikey", "tab");
    });
    if (gemini.apiKey) input.value = gemini.apiKey;
    saveBtn.addEventListener("click", () => {
      const key = input.value.trim();
      if (key) {
        gemini.apiKey = key;
        this.showAIInterface();
      }
    });
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") saveBtn.click();
    });
    return container;
  },

  async sendMessage(prompt) {
    const container = this.chatContainer;
    if (!container || !prompt) return;

    const promptInput = container.querySelector("#ai-prompt");
    const sendBtn = container.querySelector("#send-prompt");

    const pageContext = {
      url: gBrowser.currentURI.spec,
      title: gBrowser.selectedBrowser.contentTitle,
    };

    this.addChatMessage({ answer: prompt }, "user");
    if (promptInput) promptInput.value = "";
    if (sendBtn) {
      sendBtn.textContent = "Sending...";
      sendBtn.disabled = true;
    }

    const loadingIndicator = this.createLoadingIndicator();
    const messagesContainer =
      this.chatContainer.querySelector("#chat-messages");
    if (messagesContainer) {
      messagesContainer.appendChild(loadingIndicator);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    try {
      const response = await gemini.sendMessage(prompt, pageContext);
      if (response && response.answer) {
        this.addChatMessage(response, "ai");
      }
    } catch (e) {
      this.addChatMessage({ answer: `Error: ${e.message}` }, "error");
    } finally {
      loadingIndicator.remove();
      if (sendBtn) {
        sendBtn.textContent = "Send";
        sendBtn.disabled = false;
      }
      this.focusPrompt();
    }
  },

  createChatInterface() {
    const modelOptions = gemini.AVAILABLE_MODELS.map((model) => {
      const displayName =
        model.charAt(0).toUpperCase() + model.slice(1).replace(/-/g, " ");
      return `<option value="${model}" ${model === gemini.model ? "selected" : ""
        }>${displayName}</option>`;
    }).join("");

    const html = `
      <div class="findbar-ai-chat">
        <div class="ai-chat-header">
          <select id="model-selector" class="model-selector">${modelOptions}</select>
          <button id="clear-chat" class="clear-chat-btn">Clear</button>
        </div>
        <div class="ai-chat-messages" id="chat-messages"></div>
        <div class="ai-chat-input-group">
          <textarea id="ai-prompt" placeholder="Ask AI anything..." rows="2"></textarea>
          <button id="send-prompt" class="send-btn">Send</button>
        </div>
      </div>`;
    const container = createHTMLElement(html);

    const modelSelector = container.querySelector("#model-selector");
    const chatMessages = container.querySelector("#chat-messages");
    const promptInput = container.querySelector("#ai-prompt");
    const sendBtn = container.querySelector("#send-prompt");
    const clearBtn = container.querySelector("#clear-chat");

    modelSelector.addEventListener("change", (e) => {
      gemini.model = e.target.value;
    });
    const handleSend = () => this.sendMessage(promptInput.value.trim());
    sendBtn.addEventListener("click", handleSend);
    promptInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    clearBtn.addEventListener("click", () => {
      container.querySelector("#chat-messages").innerHTML = "";
      gemini.clearData();
    });

    chatMessages.addEventListener("click", async (e) => {
      if (e.target.classList.contains("citation-link")) {
        const button = e.target;
        const citationId = button.dataset.citationId;
        const messageEl = button.closest(".chat-message[data-citations]");

        if (messageEl) {
          const citations = JSON.parse(messageEl.dataset.citations);
          const citation = citations.find((c) => c.id == citationId);
          if (citation && citation.source_quote) {
            console.log(
              `[findbar-ai] Citation [${citationId}] clicked. Requesting highlight for:`,
              citation.source_quote,
            );
            await windowManagerAPI.highlightAndScrollToText(
              citation.source_quote,
            );
          }
        }
      }
    });

    return container;
  },

  createLoadingIndicator() {
    const messageDiv = createHTMLElement(
      `<div class="chat-message chat-message-loading"></div>`,
    );
    const contentDiv = createHTMLElement(
      `<div class="message-content">Loading...</div>`,
    );
    messageDiv.appendChild(contentDiv);
    return messageDiv;
  },

  addChatMessage(response, type) {
    const { answer, citations } = response;
    if (!this.chatContainer || !answer) return;
    const messagesContainer =
      this.chatContainer.querySelector("#chat-messages");
    if (!messagesContainer) return;

    const messageDiv = createHTMLElement(
      `<div class="chat-message chat-message-${type}"></div>`,
    );
    if (citations && citations.length > 0) {
      messageDiv.dataset.citations = JSON.stringify(citations);
    }

    const contentDiv = createHTMLElement(`<div class="message-content"></div>`);
    const processedContent = answer.replace(
      /\[(\d+)\]/g,
      `<button class="citation-link" data-citation-id="$1">[$1]</button>`,
    );
    contentDiv.appendChild(parseMD(processedContent));

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  showAIInterface() {
    if (!this.findbar) return;
    this.removeAIInterface();

    if (!gemini.apiKey) {
      this.apiKeyContainer = this.createAPIKeyInterface();
      this.findbar.insertBefore(this.apiKeyContainer, this.expandButton);
    } else {
      this.chatContainer = this.createChatInterface();
      const history = gemini.getHistory();
      for (const message of history) {
        if (
          message.role === "tool" ||
          (message.parts && message.parts.some((p) => p.functionCall))
        )
          continue;

        const isModel = message.role === "model";
        const textContent = message.parts[0].text;
        if (!textContent) continue;

        let responsePayload = {};

        if (isModel && gemini.citationsEnabled) {
          try {
            responsePayload = JSON.parse(textContent);
          } catch (e) {
            responsePayload = { answer: textContent };
          }
        } else {
          responsePayload.answer = textContent.replace(
            /\[Current Page Context:.*?\]\s*/,
            "",
          );
        }

        if (responsePayload.answer) {
          this.addChatMessage(responsePayload, isModel ? "ai" : "user");
        }
      }
      this.findbar.insertBefore(this.chatContainer, this.expandButton);
      this.focusPrompt();
    }
  },

  focusInput() {
    if (this.findbar) setTimeout(() => this.findbar._findField.focus(), 10);
  },
  focusPrompt() {
    const promptInput = this.chatContainer?.querySelector("#ai-prompt");
    if (promptInput) setTimeout(() => promptInput.focus(), 10);
  },
  setPromptText(text) {
    const promptInput = this?.chatContainer?.querySelector("#ai-prompt");
    if (promptInput && text) promptInput.value = text;
  },
  async setPromptTextFromSelection() {
    let text = "";
    const selection = await windowManagerAPI.getSelectedText();
    if (!selection || !selection.hasSelection)
      text = this?.findbar?._findField?.value;
    else text = selection.selectedText;
    this.setPromptText(text);
  },

  hideAIInterface() {
    this.removeAIInterface();
  },
  removeAIInterface() {
    if (this.apiKeyContainer) {
      this.apiKeyContainer.remove();
      this.apiKeyContainer = null;
    }
    if (this.chatContainer) {
      this.chatContainer.remove();
      this.chatContainer = null;
    }
  },

  init() {
    if (!this.enabled) return;
    this.updateFindbar();
    this.addListeners();
  },
  destroy() {
    this.findbar = null;
    this.expanded = false;
    this.removeListeners();
    this.removeExpandButton();
    this.removeAIInterface();
  },

  addExpandButton() {
    if (!this.findbar) return false;
    const button_id = "findbar-expand";
    if (this.findbar.getElement(button_id)) return true;
    const button = createHTMLElement(
      `<button id="${button_id}" anonid="${button_id}"></button>`,
    );
    button.addEventListener("click", () => {
      this.toggleExpanded();
      if (this.minimal) {
        const inpText = this?.findbar?._findField?.value?.trim();
        this.sendMessage(inpText);
      }
    });
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

  handleInputKeyPress: function(e) {
    if (e?.key === "Enter" && e?.altKey) {
      const inpText = this?.findbar?._findField?.value?.trim();
      this.expanded = true;
      this.sendMessage(inpText);
    }
  },

  //TODO: add context menu intrigation
  addContextMenuItem: function() { },
  removeContextMenuItem: function() { },

  //TODO: add drag and drop
  doResize: function() { },
  stopResize: function() { },
  doDrag: function() { },
  stopDrag: function() { },
  stopDrag: function() { },

  addKeymaps: function(e) {
    if (
      e.key &&
      e.key.toLowerCase() === "f" &&
      e.ctrlKey &&
      e.shiftKey &&
      !e.altKey
    ) {
      e.preventDefault();
      e.stopPropagation();
      this.expanded = true;
      this.focusPrompt();
      this.setPromptTextFromSelection();
    }
    if (e.key?.toLowerCase() === "escape") {
      if (this.expanded) {
        e.preventDefault();
        e.stopPropagation();
        this.expanded = false;
        this.focusInput();
      }
    }
  },

  addListeners() {
    this._updateFindbar = this.updateFindbar.bind(this);
    this._addKeymaps = this.addKeymaps.bind(this);
    this._handleInputKeyPress = this.handleInputKeyPress.bind(this);
    this._clearGeminiData = gemini.clearData.bind(gemini);

    gBrowser.tabContainer.addEventListener("TabSelect", this._updateFindbar);
    document.addEventListener("keydown", this._addKeymaps);
    UC_API.Prefs.addListener(GOD_MODE, this._clearGeminiData);
    UC_API.Prefs.addListener(CITATIONS_ENABLED, this._clearGeminiData);
  },
  removeListeners() {
    if (this.findbar)
      this.findbar._findField.removeEventListener(
        "keypress",
        this._handleInputKeyPress,
      );
    gBrowser.tabContainer.removeEventListener("TabSelect", this._updateFindbar);
    document.removeEventListener("keydown", this._addKeymaps);
    UC_API.Prefs.removeListener(GOD_MODE, this._clearGeminiData);
    UC_API.Prefs.removeListener(CITATIONS_ENABLED, this._clearGeminiData);

    this._handleInputKeyPress = null;
    this._updateFindbar = null;
    this._addKeymaps = null;
    this._clearGeminiData = null;
  },
};

findbar.init();
UC_API.Prefs.addListener(ENABLED, findbar.handleEnabledChange.bind(findbar));
window.findbar = findbar;
