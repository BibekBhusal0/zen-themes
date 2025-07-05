import PREFS, { debugLog, debugError } from "../../prefs.js";

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
    const wait = Math.max(0, 1000 - (now - lastMistralRequestTime)); // 1 request per second
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    const { fn, resolve, reject } = mistralRequestQueue.shift();
    try {
      const result = await fn();
      lastMistralRequestTime = Date.now();
      debugLog("Mistral API request completed at", new Date().toISOString());
      resolve(result);
    } catch (e) {
      lastMistralRequestTime = Date.now();
      debugError("Mistral API request failed at", new Date().toISOString(), e);
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

// Generate a valid tool_call_id for Mistral: 9 chars, a-z, A-Z, 0-9
function generateToolCallId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 9; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

const mistral = {
  name: "mistral",
  label: "Mistral AI",
  faviconUrl:
    "https://www.google.com/s2/favicons?sz=64&domain_url=https%3A%2F%2Fmistral.ai%2F",
  apiKeyUrl: "https://console.mistral.ai/api-keys/",
  AVAILABLE_MODELS: [
    "mistral-small",
    "mistral-medium-latest",
    "mistral-large-latest",
    "pixtral-large-latest",
  ],

  get apiKey() {
    return PREFS.mistralApiKey;
  },
  set apiKey(value) {
    if (typeof value === "string") PREFS.mistralApiKey = value;
  },

  get model() {
    return PREFS.mistralModel;
  },
  set model(value) {
    if (this.AVAILABLE_MODELS.includes(value)) PREFS.mistralModel = value;
  },

  get apiUrl() {
    return "https://api.mistral.ai/v1/chat/completions";
  },

  async sendMessage(requestBody) {
    const apiKey = this.apiKey;
    const apiUrl = this.apiUrl;
    if (!apiKey || !apiUrl) {
      throw new Error("No Mistral API key set.");
    }

    const messages = [];

    if (requestBody.systemInstruction?.parts?.[0]?.text) {
      messages.push({
        role: "system",
        content: requestBody.systemInstruction.parts[0].text,
      });
    }

    // Map history to Mistral messages format
    for (const entry of requestBody.contents) {
      if (entry.role === "user" || entry.role === "assistant") {
        messages.push({
          role: entry.role === "assistant" ? "assistant" : "user", // Mistral uses 'assistant' not 'model'
          content: entry.parts?.[0]?.text || "",
        });
      } else if (entry.role === "tool" && entry.parts) {
        // Handle tool responses from llm/index.js
        for (const part of entry.parts) {
          if (part.functionResponse) {
            messages.push({
              role: "tool",
              name: part.functionResponse.name,
              content: JSON.stringify(part.functionResponse.response),
              tool_call_id: generateToolCallId(), // Use valid tool_call_id
            });
          }
        }
      } else if (entry.role === "model" && entry.parts) {
        // Handle Gemini tool_calls format if coming from Gemini history (should be translated)
        const content = entry.parts.find((p) => p.text)?.text || "";
        const tool_calls = entry.parts
          .filter((p) => p.functionCall)
          .map((p) => ({
            id: generateToolCallId(),
            function: {
              name: p.functionCall.name,
              arguments: JSON.stringify(p.functionCall.args),
            },
          }));
        messages.push({
          role: "assistant",
          content: content,
          ...(tool_calls.length > 0 ? { tool_calls: tool_calls } : {}),
        });
      }
    }

    // Prepare tools for Mistral API (OpenAI-compatible format)
    let tools = undefined;
    if (requestBody.tools) {
      tools = requestBody.tools[0].functionDeclarations.map((fn) => ({
        type: "function",
        function: {
          name: fn.name,
          description: fn.description,
          parameters: normalizeSchemaTypes(fn.parameters),
        },
      }));
    }

    let body = {
      model: this.model,
      messages: messages,
    };

    if (tools) {
      body.tools = tools;
    } else if (requestBody.generationConfig?.responseMimeType === "application/json") {
      body.response_format = { type: "json_object" };
    }

    let response;
    try {
      response = await enqueueMistralRequest(async () => {
        return await fetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      });
    } catch (e) {
      debugError("Failed to connect to Mistral API:", e);
      throw new Error("Failed to connect to Mistral API: " + e.message);
    }

    if (!response.ok) {
      let errorMsg = `Mistral API Error: ${response.status}`;
      try {
        const errorData = await response.json();
        debugError("Mistral API Error Details:", errorData);
        if (errorData.error && errorData.error.message)
          errorMsg += ` - ${errorData.error.message}`;
      } catch (err) {
        debugError("Mistral API Error: Could not parse error response.", err);
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    // Convert Mistral's response format back to the common format expected by llm/index.js
    const modelResponse = {
      role: "model", // Convert Mistral's 'assistant' to 'model' for consistency
      parts: [],
    };

    if (choice?.message?.content) {
      modelResponse.parts.push({ text: choice.message.content });
    }

    if (
      choice?.message?.tool_calls &&
      Array.isArray(choice.message.tool_calls)
    ) {
      for (const call of choice.message.tool_calls) {
        modelResponse.parts.push({
          functionCall: {
            name: call.function?.name,
            args: JSON.parse(call.function?.arguments || "{}"),
          },
        });
      }
    }
    return modelResponse;
  },
};

export default mistral;
