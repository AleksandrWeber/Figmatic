import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const API_KEY = process.env.GEMINI_API_KEY;

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(systemInstructions: string = "", tools: any[] = []) {
    if (!API_KEY) {
      throw new Error("❌ GEMINI_API_KEY not found in .env file");
    }
    this.genAI = new GoogleGenerativeAI(API_KEY);

    this.model = this.genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: systemInstructions,
      tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined
    });
  }

  async chat(message: string, toolHandlers: Record<string, Function> = {}): Promise<string> {
    const chat = this.model.startChat({
      history: [],
    });

    let result = await chat.sendMessage(message);
    let response = await result.response;
    let functionCalls = response.functionCalls();

    // Loop for function calling
    while (functionCalls && functionCalls.length > 0) {
      const toolResponses: any[] = [];

      for (const call of functionCalls) {
        console.log(`🛠️ Executing tool: ${call.name}`, call.args);
        const handler = toolHandlers[call.name];

        if (handler) {
          const toolResult = await handler(call.args);
          toolResponses.push({
            functionResponse: {
              name: call.name,
              response: { content: toolResult }
            }
          });
        } else {
          console.warn(`⚠️ No handler found for tool: ${call.name}`);
          toolResponses.push({
            functionResponse: {
              name: call.name,
              response: { error: `No handler for ${call.name}` }
            }
          });
        }
      }

      const toolResponse = await chat.sendMessage(toolResponses);
      response = await toolResponse.response;
      functionCalls = response.functionCalls();
    }

    return response.text();
  }

  async analyzeDesign(dsl: any): Promise<any> {
    const prompt = `
      You are an expert Frontend Developer AI.
      Analyze the following simplified Figma design structure (DSL) and provide recommendations.
      
      DSL:
      ${JSON.stringify(dsl, null, 2)}

      Tasks:
      1. Suggest better semantic naming for components and classes.
      2. Identify if any "Container" should be a specific HTML tag (e.g., nav, main, footer).
      3. Provide a brief summary of the design's purpose.

      Return only a JSON object in this format:
      {
        "recommendations": [
          { "originalName": "string", "suggestedName": "string", "suggestedTag": "string", "reason": "string" }
        ],
        "summary": "string"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean up markdown code blocks if present
      const jsonText = text.replace(/```json|```/g, "").trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error("❌ Gemini Error:", error);
      return { recommendations: [], summary: "Failed to analyze design" };
    }
  }
}
