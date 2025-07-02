import { sendGeminiMessage, GEMINI_MODELS } from "./gemini-api.js";
import { sendMistralMessage, MISTRAL_MODELS } from "./mistral-api.js";

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

// Tool registry for godMode
const toolRegistry = {
  // Example: 'search': async (args) => { ... },
  // You can extend this with real tool implementations
};

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
  let systemInstruction = options.systemInstruction;
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
        if (toolRegistry[name]) {
          const toolResult = await toolRegistry[name](args);
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