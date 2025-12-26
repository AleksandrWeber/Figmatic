import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

async function listModels() {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return;
  const genAI = new GoogleGenerativeAI(API_KEY);
  try {
    const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).listModels(); // This might not work based on SDK
    console.log(models);
  } catch (e) {
    // If listModels is not on model, it might be on genAI or elsewhere depending on SDK version
    try {
      // In some versions it's like this:
      // const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
      // but let's try to find the SDK way.
      console.log("Searching for SDK listModels method...");
    } catch (e2) { }
  }
}
listModels();
