import PREFS from "../../prefs.js";

const gemini = {
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
    return PREFS.geminiApiKey;
  },
  set apiKey(value) {
    if (typeof value === "string") PREFS.geminiApiKey = value;
  },

  get model() {
    return PREFS.geminiModel;
  },
  set model(value) {
    if (this.AVAILABLE_MODELS.includes(value)) PREFS.geminiModel = value;
  },

  get apiUrl() {
    const model = this.model;
    if (!model) return null;
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  },

  async sendMessage(requestBody) {
    const apiKey = this.apiKey;
    const apiUrl = this.apiUrl;
    if (!apiKey || !apiUrl) {
      throw new Error("Invalid arguments for sendMessage.");
    }
    let response = await fetch(apiUrl, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `API Error: ${response.status} - ${errorData.error.message}`,
      );
    }

    let data = await response.json();
    let modelResponse = data.candidates?.[0]?.content;
    return modelResponse;
  },
};

export default gemini;
