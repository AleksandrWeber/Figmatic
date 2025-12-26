import "dotenv/config";
import { getFigmaImages, downloadAsset } from "./core/figma/figma-api.ts";
import * as path from "path";
import * as fs from "fs";

async function verify() {
  console.log("🧪 Verifying Asset Management API...");

  const FILE_KEY = "U3LB45bgtgmp9HI54EnvTR";
  const TEST_NODE_ID = "0:1"; // Usually the document or root, but let's try to export it as an image for testing

  try {
    console.log(`1. Fetching image URL for node ${TEST_NODE_ID}...`);
    const images = await getFigmaImages(FILE_KEY, [TEST_NODE_ID], "png");
    console.log("   Result:", images);

    if (images[TEST_NODE_ID]) {
      const dest = path.resolve("output/test-asset.png");
      console.log(`2. Downloading asset to ${dest}...`);
      await downloadAsset(images[TEST_NODE_ID], dest);

      if (fs.existsSync(dest)) {
        console.log("✅ Asset downloaded successfully!");
      } else {
        console.log("❌ Asset file not found after download.");
      }
    } else {
      console.log("⚠️ No image URL returned for this node. This is expected if the node is empty or invalid.");
    }
  } catch (err) {
    console.error("💥 Verification failed:", err);
  }
}

verify();
