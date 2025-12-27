import { getFigmaFile } from "../src/core/figma/figma-api.js";
import { Agent } from "../src/core/agent.js";
import * as fs from "fs";
import * as path from "path";

async function verifyFullPage() {
  console.log("🚀 Starting Full Page Scale Verification...");

  const FIGMA_FILE_KEY = "U3LB45bgtgmp9HI54EnvTR";

  try {
    const data = await getFigmaFile(FIGMA_FILE_KEY);
    const page = data.document.children[0];
    const frame = page.children[0];

    console.log(`🎯 Targeting frame: ${frame.name}`);

    const agent = new Agent();
    const artifacts = await agent.processFullPage(frame, {
      framework: "react",
      styles: "scss"
    });

    console.log(`\n✅ Generated ${artifacts.length} artifacts.`);

    // Check if _variables.scss exists and has content
    const variables = artifacts.find(a => a.path === "_variables.scss");
    if (variables) {
      console.log("\n📦 Global Tokens (_variables.scss):");
      console.log(variables.content.substring(0, 300) + "...");
    }

    // Check one component
    const header = artifacts.find(a => a.path.includes("Header"));
    if (header) {
      console.log(`\n📄 Component found: ${header.path}`);
    }

  } catch (error) {
    console.error("❌ Full page verification failed:", error);
  }
}

verifyFullPage();
