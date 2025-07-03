import { sendGeminiMessage, GEMINI_MODELS } from "./gemini-api.js";
import { sendMistralMessage, MISTRAL_MODELS } from "./mistral-api.js";
import { windowManagerAPI } from "./windowManager.js";
import getPref from "../utils/getPref.mjs";

// Tool declarations for godMode
export const toolDeclarations = [
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
          "Opens a given URL in a specified location. Can also create a split view with the current tab, but should only do this if the user explicitly asks for it.",
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
          "Retrieves the text content of the current web page to answer questions. This should be used be default",
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

export const DEFAULT_SYSTEM_INSTRUCTION_MARKDOWN = "You are a helpful assistant. Answer user questions about the current web page, and use tools if needed. Respond in markdown if appropriate.";
export const DEFAULT_SYSTEM_INSTRUCTION_PLAINTEXT = "You are a helpful assistant. Answer user questions about the current web page, and use tools if needed. Please respond in plaintext, **NOT** markdown or LaTeX.";
const MARKDOWN_ENABLED = "extension.findbar-ai.markdown-enabled";

export async function sendMessage({ provider, prompt, context, model, godMode, toolDeclarations, ...options }) {
  let sendFn, MODELS;
  if (provider === "gemini") {
    sendFn = sendGeminiMessage;
    MODELS = GEMINI_MODELS;
  } else if (provider === "mistral") {
    sendFn = sendMistralMessage;
    MODELS = MISTRAL_MODELS;
  } else {
    throw new Error("Unknown provider: " + provider);
  }

  // Track conversation history for tool use
  let history = options.history || [];
  let markdownEnabled = getPref(MARKDOWN_ENABLED, true);
  let systemInstruction;
  if (markdownEnabled) {
    systemInstruction = DEFAULT_SYSTEM_INSTRUCTION_MARKDOWN;
  } else {
    systemInstruction = DEFAULT_SYSTEM_INSTRUCTION_PLAINTEXT;
  }
  let lastResponse;

  // First LLM call
  lastResponse = await sendFn(prompt, context, {
    ...options,
    model,
    godMode,
    toolDeclarations,
    history,
    systemInstruction,
  });

  // God Mode: handle tool calls (Gemini only for now)
  if (godMode && lastResponse && lastResponse.parts) {
    // Find function calls in the response
    const functionCalls = lastResponse.parts.filter(
      (part) => part.functionCall
    );
    if (functionCalls.length > 0) {
      // Execute each tool and collect responses
      const functionResponses = [];
      for (const call of functionCalls) {
        const { name, args } = call.functionCall;
        if (getPref && getPref('extension.findbar-ai.debug', false)) {
          console.log('[findbar-ai][llm.js] Tool call:', name, 'Args:', args);
        }
        if (toolRegistry[name]) {
          const toolResult = await toolRegistry[name](args);
          if (getPref && getPref('extension.findbar-ai.debug', false)) {
            console.log('[findbar-ai][llm.js] Tool result for', name, ':', toolResult);
          }
          functionResponses.push({
            functionResponse: { name, response: toolResult },
          });
        } else {
          functionResponses.push({
            functionResponse: {
              name,
              response: { error: `Tool '${name}' not implemented.` },
            },
          });
        }
      }
      // Add tool responses to history and send follow-up
      history = [
        ...history,
        { role: "user", parts: [{ text: prompt }] },
        { role: "tool", parts: functionResponses },
      ];
      // Second LLM call with tool results
      lastResponse = await sendFn("", context, {
        ...options,
        model,
        godMode,
        toolDeclarations,
        history,
        systemInstruction,
      });
    }
  }

  // Return the final answer (normalize for both providers)
  if (lastResponse && lastResponse.answer) return lastResponse;
  // Gemini: parse answer from parts if needed
  if (lastResponse && lastResponse.parts) {
    const textPart = lastResponse.parts.find((p) => p.text)?.text;
    if (textPart) return { answer: textPart };
  }
  return lastResponse;
}

export function getAvailableModels(provider) {
  if (provider === "gemini") return GEMINI_MODELS;
  if (provider === "mistral") return MISTRAL_MODELS;
  return [];
}

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
    console.error(`Error getting search URL for engine "${engineName}".`, e);
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
    console.error(`Failed to open link "${link}" in "${where}".`, e);
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
    console.error("Failed to create split view.", e);
    return { error: "Failed to create split view." };
  }
}

export const toolRegistry = {
  search,
  openLink,
  newSplit,
  getPageTextContent: windowManagerAPI.getPageTextContent.bind(windowManagerAPI),
  getHTMLContent: windowManagerAPI.getHTMLContent.bind(windowManagerAPI),
}; 
