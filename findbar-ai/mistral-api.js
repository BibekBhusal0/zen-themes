import getPref from "../utils/getPref.mjs";
import { toolRegistry, toolDeclarations } from "./llm.js";

const API_KEY = "extension.findbar-ai.mistral-api-key";
const MODEL = "extension.findbar-ai.mistral-model";

export const MISTRAL_MODELS = [
  "mistral-tiny",
  "mistral-small",
  "mistral-medium",
  "mistral-large-latest",
];

function getApiKey() {
  return getPref(API_KEY, "");
}
function getModel() {
  return getPref(MODEL, "mistral-large-latest");
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
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
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
      let toolResult;
      if (toolRegistry[fnName]) {
        toolResult = await toolRegistry[fnName](fnArgs);
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
      followupResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(followupBody)
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
      citations: [],
    };
  }

  // No tool call, just return the answer
  const answer = choice?.message?.content;
  return {
    answer,
    citations: [], // Mistral does not provide citations
  };
} 
