import getPref from "../utils/getPref.mjs";
import { toolRegistry, toolDeclarations } from "./llm.js";

const API_KEY = "extension.findbar-ai.mistral-api-key";
const MODEL = "extension.findbar-ai.mistral-model";

export const MISTRAL_MODELS = [
  "mistral-small",
  "mistral-medium-latest",
  "mistral-large-latest",
  "pixtral-large-latest",
];

function getApiKey() {
  return getPref(API_KEY, "");
}
function getModel() {
  return getPref(MODEL, "mistral-medium-latest");
}

// --- Mistral API Rate Limiting ---
let mistralRequestQueue = [];
let lastMistralRequestTime = 0;

function enqueueMistralRequest(fn) {
  return new Promise((resolve, reject) => {
    mistralRequestQueue.push({ fn, resolve, reject });
    processMistralQueue();
  });
}

async function processMistralQueue() {
  if (processMistralQueue.running) return;
  processMistralQueue.running = true;
  while (mistralRequestQueue.length > 0) {
    const now = Date.now();
    const wait = Math.max(0, 1000 - (now - lastMistralRequestTime));
    if (wait > 0) await new Promise(res => setTimeout(res, wait));
    const { fn, resolve, reject } = mistralRequestQueue.shift();
    try {
      const result = await fn();
      lastMistralRequestTime = Date.now();
      console.log('Mistral API request completed at', new Date().toISOString());
      resolve(result);
    } catch (e) {
      lastMistralRequestTime = Date.now();
      console.log('Mistral API request failed at', new Date().toISOString());
      reject(e);
    }
  }
  processMistralQueue.running = false;
  // If new requests were added while we were processing, start again
  if (mistralRequestQueue.length > 0) {
    processMistralQueue();
  }
}

// Recursively convert all type fields to lowercase (OpenAI/Mistral schema compliance)
function normalizeSchemaTypes(obj) {
  if (Array.isArray(obj)) {
    return obj.map(normalizeSchemaTypes);
  } else if (obj && typeof obj === "object") {
    const newObj = {};
    for (const key in obj) {
      if (key === "type" && typeof obj[key] === "string") {
        newObj[key] = obj[key].toLowerCase();
      } else {
        newObj[key] = normalizeSchemaTypes(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// Add a helper for debug logging
function debugLog(...args) {
  if (getPref('extension.findbar-ai.debug', false)) {
    console.log('[findbar-ai]', ...args);
  }
}

export async function sendMistralMessage(prompt, context, options = {}) {
  const apiKey = getApiKey();
  const model = options.model || getModel();
  if (!apiKey) throw new Error("No Mistral API key set.");
  if (!prompt) throw new Error("No prompt provided.");

  const apiUrl = "https://api.mistral.ai/v1/chat/completions";
  const messages = [
    { role: "user", content: prompt }
  ];
  // Optionally add context as a system message
  if (context && (context.url || context.title)) {
    messages.unshift({ role: "system", content: `Page context: ${JSON.stringify(context)}` });
  }

  // Prepare tools for Mistral API (OpenAI-compatible format)
  let tools = undefined;
  if (options.toolDeclarations) {
    tools = options.toolDeclarations[0].functionDeclarations.map(fn => ({
      type: "function",
      function: {
        name: fn.name,
        description: fn.description,
        parameters: normalizeSchemaTypes(fn.parameters),
      }
    }));
  }

  const body = {
    model,
    messages,
    temperature: options.temperature || 1.0,
    max_tokens: options.max_tokens || 512,
    ...(tools ? { tools } : {}),
    ...(options.toolChoice ? { tool_choice: options.toolChoice } : {}),
    ...(options.parallelToolCalls !== undefined ? { parallel_tool_calls: options.parallelToolCalls } : {}),
  };

  let response;
  try {
    response = await enqueueMistralRequest(async () => {
      return await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    });
  } catch (e) {
    console.error("Failed to connect to Mistral API:", e);
    throw new Error("Failed to connect to Mistral API: " + e.message);
  }

  if (!response.ok) {
    let errorMsg = `Mistral API Error: ${response.status}`;
    try {
      const errorData = await response.json();
      console.error("Mistral API Error Details:", errorData);
      if (errorData.error && errorData.error.message) errorMsg += ` - ${errorData.error.message}`;
    } catch (err) {
      console.error("Mistral API Error: Could not parse error response.", err);
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  // Handle tool calls if present
  if (choice?.message?.tool_calls && Array.isArray(choice.message.tool_calls)) {
    const toolCalls = choice.message.tool_calls;
    const toolResponses = [];
    for (const call of toolCalls) {
      const fnName = call.function?.name;
      let fnArgs = {};
      try {
        fnArgs = JSON.parse(call.function?.arguments || "{}")
      } catch (e) {
        fnArgs = {};
      }
      if (getPref && getPref('extension.findbar-ai.debug', false)) {
        console.log('[findbar-ai][mistral-api.js] Tool call:', fnName, 'Args:', fnArgs);
      }
      let toolResult;
      if (toolRegistry[fnName]) {
        toolResult = await toolRegistry[fnName](fnArgs);
        if (getPref && getPref('extension.findbar-ai.debug', false)) {
          console.log('[findbar-ai][mistral-api.js] Tool result for', fnName, ':', toolResult);
        }
      } else {
        toolResult = { error: `Tool '${fnName}' not implemented.` };
      }
      toolResponses.push({
        role: "tool",
        tool_call_id: call.id,
        name: fnName,
        content: JSON.stringify(toolResult),
      });
    }
    // Add tool responses to messages and send follow-up
    const assistantMessage = {
      role: "assistant",
      content: choice.message.content || "",
      tool_calls: choice.message.tool_calls
    };
    const followupMessages = [
      ...messages,
      assistantMessage,
      ...toolResponses
    ];
    const followupBody = {
      model,
      messages: followupMessages,
      temperature: options.temperature || 1.0,
      max_tokens: options.max_tokens || 512,
    };
    let followupResponse;
    try {
      followupResponse = await enqueueMistralRequest(async () => {
        return await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(followupBody)
        });
      });
    } catch (e) {
      console.error("Failed to connect to Mistral API (follow-up):", e);
      throw new Error("Failed to connect to Mistral API (follow-up): " + e.message);
    }
    if (!followupResponse.ok) {
      let errorMsg = `Mistral API Error (follow-up): ${followupResponse.status}`;
      try {
        const errorData = await followupResponse.json();
        console.error("Mistral API Follow-up Error Details:", errorData);
        if (errorData.error && errorData.error.message) errorMsg += ` - ${errorData.error.message}`;
      } catch (err) {
        console.error("Mistral API Follow-up Error: Could not parse error response.", err);
      }
      throw new Error(errorMsg);
    }
    const followupData = await followupResponse.json();
    const followupChoice = followupData.choices?.[0];
    return {
      answer: followupChoice?.message?.content || "[Mistral] No response from model after tool call.",
    };
  }

  // No tool call, just return the answer
  const answer = choice?.message?.content;
  return {
    answer,
  };
} 
