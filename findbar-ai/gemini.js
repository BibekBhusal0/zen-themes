import { windowManagerAPI } from "./windowManager.js";
import getPref from "../utils/getPref.mjs";

// Prefs keys
const API_KEY = "extension.findbar-ai.gemini-api-key";
const MODEL = "extension.findbar-ai.gemini-model";

// Available Gemini models

const gemini = {
  history: [],
  AVAILABLE_MODELS : [
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
  systemInstruction: null,

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
    if (this.AVAILABLE_MODELS.includes(value)) {
      UC_API.Prefs.set(MODEL, value);
    }
  },

  get apiUrl() {
    const model = this.model;
    if (!model) return null;
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  },

  async getSystemPrompt() {
    let systemPrompt = `You are a helpful AI assistant integrated into Zen Browser, a minimal and modern fork of Firefox. Your primary purpose is to answer user questions based on the content of the current webpage.

**Your Instructions:**

**DO:**
- Strictly base all your answers on the webpage content provided below.
- If the user's question cannot be answered from the content, state that the information is not available on the page.
- Be concise, accurate, and helpful.
- If the webpage content is empty, inform the user that you cannot access the content of the current page. This often happens on special browser pages (like New Tab, Settings, or \`about:\` pages) or on pages with restricted access.

**DON'T:**
- Do not provide information from your general knowledge; use only the provided text.
- Do not answer questions that are not related to the content of the webpage.
- Do not guess or invent information.

Here is the info about current page:
`;

    const pageContent = await windowManagerAPI.getPageTextContent();
    systemPrompt += JSON.stringify(pageContent);
    return systemPrompt;
  },

  setSystemPrompt(promptText) {
    if (promptText) {
      this.systemInstruction = { parts: [{ text: promptText }] };
    } else {
      this.systemInstruction = null;
    }
    return this;
  },

  async sendMessage(prompt) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("Prompt must be a non-empty string.");
    }
    const apiKey = this.apiKey;
    const apiUrl = this.apiUrl;
    if (!apiKey || !apiUrl) {
      throw new Error(
        "Gemini client not configured. API key and model are required."
      );
    }

    if (!this.systemInstruction) {
        this.setSystemPrompt(await this.getSystemPrompt());
    }

    this.history.push({ role: "user", parts: [{ text: prompt }] });

    const requestBody = {
      contents: this.history,
    };

    if (this.systemInstruction) {
      requestBody.systemInstruction = this.systemInstruction;
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API Error: ${response.status} - ${errorData.error.message}`
        );
      }

      const data = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        this.history.pop();
        return "The model did not return a response. This could be due to safety settings or other issues.";
      }

      const modelResponseText = data.candidates[0].content.parts[0].text;
      this.history.push({
        role: "model",
        parts: [{ text: modelResponseText }],
      });

      return modelResponseText;
    } catch (error) {
      this.history.pop();
      throw error;
    }
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
