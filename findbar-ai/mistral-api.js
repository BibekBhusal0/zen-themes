import getPref from "../utils/getPref.mjs";

const API_KEY = "extension.findbar-ai.mistral-api-key";
const MODEL = "extension.findbar-ai.mistral-model";

export const MISTRAL_MODELS = [
  "mistral-tiny",
  "mistral-small",
  "mistral-medium",
  "mistral-large",
];

function getApiKey() {
  return getPref(API_KEY, "");
}
function getModel() {
  return getPref(MODEL, "mistral-small");
}

export async function sendMistralMessage(prompt, context, options = {}) {
  const apiKey = getApiKey();
  const model = options.model || getModel();
  // Accept godMode and toolDeclarations for future use (not supported by Mistral API yet)
  // const godMode = options.godMode;
  // const toolDeclarations = options.toolDeclarations;
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

  const body = {
    model,
    messages,
    temperature: options.temperature || 1.0,
    max_tokens: options.max_tokens || 512,
    // stream: false // Not implemented here
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
    throw new Error("Failed to connect to Mistral API: " + e.message);
  }

  if (!response.ok) {
    let errorMsg = `Mistral API Error: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error && errorData.error.message) errorMsg += ` - ${errorData.error.message}`;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (!data.choices || !data.choices.length) {
    return { answer: "[Mistral] No response from model." };
  }
  const answer = data.choices[0].message.content;
  return {
    answer,
    citations: [], // Mistral does not provide citations
  };
} 