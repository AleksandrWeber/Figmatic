import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { getFigmaFile } from "./core/figma/figma-api.ts";
import { Agent } from "./core/agent.ts";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

async function runInteractive() {
  console.log("🚀 Figma Interactive Agent Started");

  const FIGMA_FILE_KEY = "U3LB45bgtgmp9HI54EnvTR";
  const agent = new Agent();
  const outputDir = path.resolve("output");

  let data: any;
  try {
    data = await getFigmaFile(FIGMA_FILE_KEY);
  } catch (error) {
    console.error("❌ Failed to get Figma file:", error);
    return;
  }

  const page = data.document.children[0];
  const firstFrame = page.children[0];

  while (true) {
    console.log("\n--- Generation Options ---");
    console.log("1. Generate Base Code (Normal)");
    console.log("2. Refine with Instructions");
    console.log("3. Exit");

    const choice = await question("Select an option (1-3): ");

    if (choice === "3") break;

    let instructions: string | undefined = undefined;
    if (choice === "2") {
      instructions = await question("Enter your refinement instructions (e.g., 'Make the header text red'): ");
    }

    console.log("🤖 Agent: Processing...");
    const artifacts = await agent.processFullPage(firstFrame, FIGMA_FILE_KEY, {}, instructions);

    // Save artifacts
    for (const art of artifacts) {
      const filePath = path.join(outputDir, art.path);
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(filePath, art.content, "utf-8");
    }

    console.log(`✅ Generation complete! Created ${artifacts.length} artifacts in /output`);

    if (choice === "1") {
      console.log("You can now choose 'Refine' to modify this output.");
    }
  }

  rl.close();
}

runInteractive().catch(err => {
  console.error("💥 Fatal error:", err);
  rl.close();
});
