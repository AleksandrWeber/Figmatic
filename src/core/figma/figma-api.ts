import fetch, { Headers } from "node-fetch";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

// 🌐 Base API URL
const FIGMA_API_BASE_URL = "https://api.figma.com/v1";

// 🔑 Token Helper
function getToken(): string {
  const token = (process.env.FIGMA_TOKEN || process.env.X_Figma_Token || "").trim();
  if (!token) {
    throw new Error("❌ FIGMA_TOKEN not found. Please ensure you have a .env file with FIGMA_TOKEN in your workspace root, or set it in your environment variables, or enter it in the sidebar.");
  }
  // Debug log (masked)
  console.log(`🔑 Figmatic: Using token starting with "${token.substring(0, 4)}..."`);
  return token;
}

// 📁 Cache settings
let CUSTOM_CACHE_DIR: string | null = null;

export function setCacheDir(dir: string) {
  CUSTOM_CACHE_DIR = dir;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getCacheDir(): string {
  if (CUSTOM_CACHE_DIR) return CUSTOM_CACHE_DIR;
  return path.resolve(process.env.FIGMATIC_CACHE_DIR || path.join(process.cwd(), "cache"));
}

// ⏳ helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 📉 Throttling settings
const THROTTLE_DELAY = 1000; // 1 second pause between successful requests to avoid spamming

// ⏳ Centralized Fetch with Retry
async function fetchWithRetry(url: string, options: any = {}, maxRetries: number = 7, onProgress?: (msg: string) => void): Promise<any> {
  const headers = {
    ...options.headers,
    "X-Figma-Token": getToken()
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 3000; // Increased backoff base to 3s
        const msg = `⏳ Rate limited (429), waiting ${waitTime / 1000}s (attempt ${attempt}/${maxRetries})...`;
        console.log(msg);
        onProgress?.(msg);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        if (response.status === 401) throw new Error("❌ Invalid Figma Token.");
        if (response.status === 403) throw new Error("❌ Access Denied. Check token permissions or File ID.");
        if (response.status === 404) throw new Error("❌ File Not Found.");
        throw new Error(`❌ Figma API error: ${response.status}`);
      }

      // Mandatory throttle pause after a successful request
      await sleep(THROTTLE_DELAY);

      return response;
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      const msg = `⚠️ Request failed, retrying (${attempt}/${maxRetries}): ${err.message}`;
      console.log(msg);
      onProgress?.(msg);
      await sleep(2000);
    }
  }
}

export async function getFigmaFile(fileKey: string, onProgress?: (msg: string) => void) {
  const cachePath = path.join(getCacheDir(), `${fileKey}.json`);

  if (fs.existsSync(cachePath)) {
    console.log(`📦 Using cached Figma file: ${fileKey}.json`);
    return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  }

  const url = `${FIGMA_API_BASE_URL}/files/${fileKey}`;
  const response = await fetchWithRetry(url, {}, 7, onProgress);
  const data = await response.json();

  if (!fs.existsSync(getCacheDir())) fs.mkdirSync(getCacheDir(), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");

  return data;
}

export async function getFigmaImages(fileKey: string, ids: string[], format: string = "png", onProgress?: (msg: string) => void): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const idsParam = ids.join(",");
  const url = `${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${idsParam}&format=${format}`;

  console.log(`👉 Fetching Image URLs (format: ${format})`);
  const response = await fetchWithRetry(url, {}, 7, onProgress);
  const data = (await response.json()) as { images: Record<string, string> };

  return data.images || {};
}

export async function downloadAsset(url: string, dest: string, onProgress?: (msg: string) => void): Promise<void> {
  const parentDir = path.dirname(dest);
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

  console.log(`👉 Downloading asset: ${path.basename(dest)}`);
  const response = await fetchWithRetry(url, {}, 7, onProgress);
  const buffer = await response.buffer();

  fs.writeFileSync(dest, buffer);
}
