import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { ModelType } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const createChatSession = (model: string = ModelType.FLASH): Chat => {
  return ai.chats.create({
    model: model,
    config: {
      systemInstruction: "You are Nova, an advanced, helpful, and concise AI assistant. You provide clear, well-structured responses using Markdown formatting.",
    },
  });
};

export const streamMessage = async (
  chat: Chat, 
  message: string, 
  onChunk: (text: string) => void
): Promise<string> => {
  try {
    const result = await chat.sendMessageStream({ message });
    let fullText = '';
    
    for await (const chunk of result) {
        const contentResponse = chunk as GenerateContentResponse;
        const text = contentResponse.text || '';
        fullText += text;
        onChunk(text);
    }
    return fullText;
  } catch (error) {
    console.error("Error streaming message:", error);
    throw error;
  }
};

export const generateTitle = async (firstMessage: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: ModelType.FLASH,
            contents: `Generate a very short, 3-5 word title for a conversation that starts with: "${firstMessage}". Return ONLY the title, no quotes.`,
        });
        return response.text?.trim() || "New Conversation";
    } catch (e) {
        return "New Conversation";
    }
}