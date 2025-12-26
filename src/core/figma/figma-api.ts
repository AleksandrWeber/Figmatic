import fetch, { Headers } from "node-fetch";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

// 🌐 Base API URL
const FIGMA_API_BASE_URL = "https://api.figma.com/v1";

// 🔑 Token Helper
function getToken(): string {
  const token = process.env.FIGMA_TOKEN || process.env.X_Figma_Token;
  if (!token) {
    throw new Error("❌ FIGMA_TOKEN not found. Please ensure you have a .env file with FIGMA_TOKEN in your workspace root, or set it in your environment variables.");
  }
  return token;
}

// 📁 Cache settings
// 📁 Cache settings - Use absolute path relative to this file
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const CACHE_DIR = path.join(__dirname, "../../../cache");

// ⏳ helper
const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function getFigmaFile(fileKey: string) {
  const cachePath = path.join(CACHE_DIR, `${fileKey}.json`);

  // 1. Check cache
  if (fs.existsSync(cachePath)) {
    console.log(`📦 Using cached Figma file: ${fileKey}.json`);
    const cachedData = fs.readFileSync(cachePath, "utf-8");
    return JSON.parse(cachedData);
  }

  const url = `${FIGMA_API_BASE_URL}/files/${fileKey}`;

  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`👉 Fetching Figma file from API (attempt ${attempt})`);

    const headers = new Headers();
    headers.set("X-Figma-Token", getToken());

    const response = await fetch(url, { headers });

    console.log("👉 Status:", response.status);

    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 2000; // Exponential backoff: 4s, 8s, 16s...
      console.log(`⏳ Rate limited, waiting ${waitTime / 1000} seconds...`);
      await sleep(waitTime);
      continue;
    }

    if (!response.ok) {
      throw new Error(`❌ Figma API error: ${response.status}`);
    }

    const data = await response.json();

    // 2. Save to cache
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`💾 Saved Figma file to cache: ${fileKey}.json`);

    return data;
  }

  throw new Error("❌ Figma API rate limit exceeded after retries");
}

export async function getFigmaImages(fileKey: string, ids: string[], format: string = "png"): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const idsParam = ids.join(",");
  const url = `${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${idsParam}&format=${format}`;

  console.log(`👉 Fetching Image URLs from Figma (format: ${format})`);

  const headers = new Headers();
  headers.set("X-Figma-Token", getToken());

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`❌ Figma Image API error: ${response.status}`);
  }

  const data = (await response.json()) as { images: Record<string, string> };
  return data.images || {};
}

export async function downloadAsset(url: string, dest: string): Promise<void> {
  const parentDir = path.dirname(dest);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`❌ Failed to download asset from ${url}`);
  }

  const buffer = await response.buffer();
  fs.writeFileSync(dest, buffer);
  console.log(`💾 Asset downloaded: ${path.basename(dest)}`);
}
