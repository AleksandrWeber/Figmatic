import { getFigmaFile } from "../src/core/figma/figma-api.js";
import { Agent } from "../src/core/agent.js";

async function verifyAgent() {
  console.log("🚀 Starting Agent Flow Verification...");

  const FIGMA_FILE_KEY = "U3LB45bgtgmp9HI54EnvTR";

  try {
    const data = await getFigmaFile(FIGMA_FILE_KEY);
    const page = data.document.children[0];
    const frame = page.children[0];

    // Find Header or first child
    const targetNode = frame.children.find((n: any) => n.name === "Header") || frame.children[0];

    console.log(`🎯 Targeting node: ${targetNode.name}`);

    const agent = new Agent();
    const result = await agent.processFigmaNode(targetNode, {
      framework: "react",
      styles: "scss"
    });

    console.log("\n✅ AI Plan Summary:");
    console.log(JSON.stringify(result.plan, null, 2));

    console.log("\n✅ Generated React Component (Sample):");
    console.log(result.reactCode.substring(0, 200) + "...");

  } catch (error) {
    console.error("❌ Agent verification failed:", error);
  }
}

verifyAgent();
