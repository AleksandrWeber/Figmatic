import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

async function listModels() {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY not found in process.env");
    return;
  }
  console.log(`🔑 Key found. Length: ${API_KEY.length}. Starts with: ${API_KEY.substring(0, 5)}...`);

  const genAI = new GoogleGenerativeAI(API_KEY);
  try {
    // There is no direct listModels in the standard SDK sometimes, 
    // but let's try to see if we can find it or just try a different approach.
    console.log("Listing models is not directly supported in this SDK version via a simple method, but trying gemini-pro...");
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("test");
    console.log("✅ gemini-pro works!");
  } catch (e: any) {
    console.error("❌ gemini-pro failed:", e.message);
  }
}

listModels();
