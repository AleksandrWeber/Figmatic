import { GeminiService } from "./core/ai/gemini-service.js";

async function verifyLoop() {
  console.log("🚀 Starting Gemini Loop Verification...");

  const tools = [
    {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "The city name" }
        },
        required: ["location"]
      }
    },
    {
      name: "calculate_sum",
      description: "Calculate the sum of two numbers",
      parameters: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" }
        },
        required: ["a", "b"]
      }
    }
  ];

  const toolHandlers = {
    get_weather: async (args: { location: string }) => {
      console.log(`📡 Fetching weather for ${args.location}...`);
      return `The weather in ${args.location} is sunny, 25°C.`;
    },
    calculate_sum: async (args: { a: number; b: number }) => {
      console.log(`🔢 Calculating sum of ${args.a} and ${args.b}...`);
      return args.a + args.b;
    }
  };

  const systemInstructions = "You are a helpful assistant that can use tools to answer questions.";
  const gemini = new GeminiService(systemInstructions, tools);

  try {
    const question = "What is the weather in Kyiv and what is 123 + 456?";
    console.log(`❓ User Question: ${question}`);

    const response = await gemini.chat(question, toolHandlers);

    console.log("\n✅ Final Gemini Response:");
    console.log(response);
  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
}

verifyLoop();
