import getPref from "../utils/getPref.mjs";

const API_KEY = "extension.findbar-ai.gemini-api-key";
const MODEL = "extension.findbar-ai.gemini-model";
const CITATIONS_ENABLED = "extension.findbar-ai.citations-enabled";

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-1.0-pro",
];

function getApiKey() {
  return getPref(API_KEY, "");
}
function getModel() {
  return getPref(MODEL, "gemini-2.0-flash");
}
function getCitationsEnabled() {
  return getPref(CITATIONS_ENABLED, true);
}
function getApiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export async function sendGeminiMessage(prompt, context, options = {}) {
  const apiKey = getApiKey();
  const model = options.model || getModel();
  const apiUrl = getApiUrl(model);
  const citationsEnabled = getCitationsEnabled();
  if (!apiKey || !apiUrl || !prompt || typeof prompt !== "string") {
    throw new Error("Invalid arguments for sendGeminiMessage.");
  }
  const systemInstruction = options.systemInstruction || null;
  const history = options.history || [];
  const godMode = options.godMode;
  const toolDeclarations = options.toolDeclarations;
  const fullPrompt = `[Current Page Context: ${JSON.stringify(context || {})}] ${prompt}`;
  const contents = [...history, { role: "user", parts: [{ text: fullPrompt }] }];
  const requestBody = {
    contents,
    systemInstruction,
  };
  if (citationsEnabled) {
    requestBody.generationConfig = { responseMimeType: "application/json" };
  }
  if (godMode && toolDeclarations) {
    requestBody.tools = toolDeclarations;
  }
  let response = await fetch(apiUrl, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API Error: ${response.status} - ${errorData.error.message}`);
  }
  let data = await response.json();
  let modelResponse = data.candidates?.[0]?.content;
  if (!modelResponse) {
    return { answer: "The model did not return a valid response." };
  }
  // Try to parse JSON if citations enabled
  if (citationsEnabled) {
    try {
      const responseText = modelResponse.parts.find((part) => part.text)?.text || "{}";
      const parsedResponse = JSON.parse(responseText);
      return parsedResponse;
    } catch (e) {
      return { answer: modelResponse.parts[0]?.text || "[Empty Response]" };
    }
  } else {
    const responseText = modelResponse.parts.find((part) => part.text)?.text || "";
    return { answer: responseText };
  }
} 
