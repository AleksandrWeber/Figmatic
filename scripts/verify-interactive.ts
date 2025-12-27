import "dotenv/config";
import { Agent } from "../src/core/agent.ts";
import { getFigmaFile } from "../src/core/figma/figma-api.ts";

async function verify() {
  console.log("🧪 Verifying Interactive Dialogue Mode...");

  const FILE_KEY = "U3LB45bgtgmp9HI54EnvTR";
  const agent = new Agent();

  try {
    const data = await getFigmaFile(FILE_KEY);
    const firstFrame = data.document.children[0].children[0];

    const instructions = "Add a red background color to the title element and make it very large.";
    console.log(`1. Generating with instructions: "${instructions}"`);

    const artifacts = await agent.processFullPage(firstFrame, FILE_KEY, {}, instructions);

    const headerScss = artifacts.find(a => a.path.includes("header.scss"));
    if (headerScss) {
      console.log("--- Header SCSS Output ---");
      console.log(headerScss.content);

      if (headerScss.content.toLowerCase().includes("red") || headerScss.content.includes("background-color")) {
        console.log("✅ Instructions successfully influenced the SCSS!");
      } else {
        console.log("❌ Instructions DID NOT seem to influence the SCSS.");
      }
    } else {
      console.log("❌ Header SCSS not found in artifacts.");
    }

  } catch (err) {
    console.error("💥 Verification failed:", err);
  }
}

verify();
