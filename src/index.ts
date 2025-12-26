import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { getFigmaFile } from "./core/figma/figma-api.ts";
import { Agent } from "./core/agent.ts";

async function run() {
  console.log("🚀 Figma agent started");

  const FIGMA_FILE_KEY = "U3LB45bgtgmp9HI54EnvTR";

  let data: any;
  try {
    data = await getFigmaFile(FIGMA_FILE_KEY);
  } catch (error) {
    console.error("❌ Failed to get Figma file:", error);
    return;
  }

  const page = data.document.children[0];
  const firstFrame = page.children[0];

  // ===== Header Search =====
  const headerSection = firstFrame.children.find(
    (node: any) => node.name === "Header"
  );

  if (!headerSection) {
    console.log("❌ Header not found");
    return;
  }

  // ===== Agent Processing =====
  const agent = new Agent();
  const artifacts = await agent.processFullPage(firstFrame, FIGMA_FILE_KEY);

  // ===== Write files =====
  const outputDir = path.resolve("output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const art of artifacts) {
    const filePath = path.join(outputDir, art.path);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(filePath, art.content, "utf-8");
  }

  console.log("✅ Agent full-page processing complete!");
  console.log(`   - Generated ${artifacts.length} artifacts in /output`);
}

run().catch((err) => {
  console.error("💥 Fatal error:", err);
});
