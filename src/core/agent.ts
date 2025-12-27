import { figmaToDSL, DSLNode } from "./dsl/dsl-parser.ts";
import { GeminiService } from "./ai/gemini-service.ts";
import { CodePlanner, ArchitecturePlan } from "./ai/code-planner.ts";
import { generateReactComponent, generateRootComponent } from "./generators/react-generator.ts";
import { generateScss } from "./generators/scss-generator.ts";
import { generateStory } from "./generators/storybook-generator.ts";
import { generateTest } from "./generators/test-generator.ts";
import { extractTokens, DesignTokens, generateTokenScss } from "./parsers/token-parser.ts";
import { getFigmaImages, downloadAsset } from "./figma/figma-api.ts";
import * as path from "path";
import * as fs from "fs";

export class Agent {
  private aiService: GeminiService;
  private planner: CodePlanner;
  private fontDecisionResolver: ((decision: any) => void) | null = null;

  constructor() {
    this.aiService = new GeminiService("You are Figmatic - an expert Frontend Architect AI Agent.");
    this.planner = new CodePlanner(this.aiService);
  }

  async processFullPage(rootNode: any, fileKey: string, projectDir: string, constraints: any = {}, userInstructions?: string, onProgress?: (msg: string) => void) {
    onProgress?.(`🤖 Agent: Processing full page design "${rootNode.name}" in folder "${path.basename(projectDir)}"...`);
    console.log(`🤖 Agent: Processing full page design "${rootNode.name}"...`);

    const projectName = rootNode.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'figmatic_project';

    // 1. Parse Full Page to DSL
    const fullDsl = figmaToDSL(rootNode);

    // 3. Extract Global Tokens
    onProgress?.("💎 Extracting Global Design Tokens...");
    const tokens = extractTokens(fullDsl);
    const tokenScss = generateTokenScss(tokens);

    // 1.5 Font Analysis & User Dialogue
    onProgress?.("🔍 Analyzing typography and licenses...");
    const usedFonts = this.detectFonts(fullDsl);
    const fontAnalysis = await this.analyzeFonts(usedFonts);
    const commercialFonts = fontAnalysis.filter(f => f.isCommercial);

    if (commercialFonts.length > 0) {
      onProgress?.(`⚠️ detected_commercial_fonts:${JSON.stringify(commercialFonts)}`);

      const decision: any = await new Promise((resolve) => {
        this.fontDecisionResolver = resolve;
      });

      onProgress?.("✅ Font decision received. Continuing...");

      // If user provided replacements, update the DSL or planning constraints
      if (decision && typeof decision === 'object' && Object.keys(decision).length > 0) {
        constraints.fontReplacements = decision;
        this.applyFontReplacements(fullDsl, decision);
      }
    }

    // 2. Asset Management
    onProgress?.("🖼️ Handling images and icons...");
    await this.handleAssets(fullDsl, fileKey, projectDir, onProgress);

    // 4. Process each section ...
    const sections = fullDsl.children || [];
    const sectionMetadata: { name: string, fileName: string }[] = [];
    const isTailwind = constraints.styleFramework === 'tailwind';

    const artifacts: any[] = [];

    if (!isTailwind) {
      artifacts.push(
        { path: "src/_variables.scss", content: tokenScss },
        {
          path: "src/_reset.scss",
          content: `* { margin: 0; padding: 0; box-sizing: border-box; }\nhtml, body { height: 100%; }\nimg, picture, video, canvas, svg { display: block; max-width: 100%; }\ninput, button, textarea, select { font: inherit; }\np, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }\n`
        },
        {
          path: "src/_base.scss",
          content: `@import 'reset';\n@import 'variables';\n\nbody {\n  font-family: 'Inter', sans-serif;\n  -webkit-font-smoothing: antialiased;\n  background-color: white;\n}\n`
        }
      );
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      onProgress?.(`🛠️ Orchestrating section ${i + 1}/${sections.length}: ${section.name}...`);
      const { artifacts: sectionArts, componentName } = await this.processSection(section, tokens, constraints, userInstructions);
      artifacts.push(...sectionArts);
      sectionMetadata.push({ name: componentName, fileName: componentName });
    }

    // 5. Generate Root Orchestrator
    onProgress?.("🏗️ Generating Root Orchestrator (App.tsx)...");
    const rootCode = generateRootComponent(sectionMetadata, constraints);
    artifacts.push({ path: "src/App.tsx", content: rootCode });
    if (!isTailwind) {
      artifacts.push({ path: "src/App.scss", content: "@import 'base';\n\n.app-container {\n  display: flex;\n  flex-direction: column;\n  min-height: 100vh;\n}\n" });
    }

    // 6. Project Bootstrapping (Config Files)
    onProgress?.("📦 Bootstrapping project environment...");
    const configArtifacts = this.getBootstrapArtifacts(projectName, constraints.styleFramework || 'scss', !!constraints.generateStorybook);
    artifacts.push(...configArtifacts);

    return artifacts;
  }

  private getBootstrapArtifacts(projectName: string, framework: string, generateStorybook: boolean): any[] {
    const isTailwind = framework === 'tailwind';

    const pkg: any = {
      name: projectName,
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: {
        "dev": "vite",
        "build": "tsc && vite build",
        "preview": "vite preview",
        "test": "vitest run",
        "test:watch": "vitest",
        "storybook": "storybook dev -p 6006",
        "build-storybook": "storybook build"
      },
      dependencies: {
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@testing-library/jest-dom": "^5.16.5",
        "@testing-library/react": "^14.0.0",
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.0.0",
        "jsdom": "^22.0.0",
        "typescript": "^5.0.0",
        "vite": "^4.3.0",
        "vitest": "^0.31.0"
      }
    };

    if (isTailwind) {
      pkg.devDependencies["tailwindcss"] = "^3.3.0";
      pkg.devDependencies["autoprefixer"] = "^10.4.0";
      pkg.devDependencies["postcss"] = "^8.4.0";
    } else {
      pkg.devDependencies["sass"] = "^1.62.0";
    }

    if (generateStorybook) {
      pkg.devDependencies["storybook"] = "^7.0.0";
      pkg.devDependencies["@storybook/react"] = "^7.0.0";
      pkg.devDependencies["@storybook/react-vite"] = "^7.0.0";
      pkg.devDependencies["@storybook/addon-essentials"] = "^7.0.0";
      pkg.devDependencies["@storybook/addon-interactions"] = "^7.0.0";
      pkg.devDependencies["@storybook/addon-links"] = "^7.0.0";
    }

    const artifacts = [
      {
        path: "package.json",
        content: JSON.stringify(pkg, null, 2)
      },
      {
        path: ".gitignore",
        content: "node_modules\ndist\n.vscode\n.DS_Store\n*.local\n.env\n"
      },
      {
        path: "tsconfig.json",
        content: JSON.stringify({
          compilerOptions: {
            target: "ESNext",
            useDefineForClassFields: true,
            lib: ["DOM", "DOM.Iterable", "ESNext"],
            allowJs: false,
            skipLibCheck: true,
            esModuleInterop: false,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            module: "ESNext",
            moduleResolution: "Node",
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx"
          },
          include: ["src"],
          references: [{ path: "./tsconfig.node.json" }]
        }, null, 2)
      },
      {
        path: "tsconfig.node.json",
        content: JSON.stringify({
          compilerOptions: {
            composite: true,
            module: "ESNext",
            moduleResolution: "Node",
            allowSyntheticDefaultImports: true
          },
          include: ["vite.config.ts"]
        }, null, 2)
      },
      {
        path: "vite.config.ts",
        content: `/// <reference types="vitest" />\nimport { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n  test: {\n    globals: true,\n    environment: 'jsdom',\n    setupFiles: './src/test/setup.ts',\n  },\n})\n`
      },
      {
        path: "src/test/setup.ts",
        content: "import '@testing-library/jest-dom';\n"
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <link rel="icon" type="image/svg+xml" href="/vite.svg" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${projectName}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`
      },
      {
        path: "src/main.tsx",
        content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.tsx'\nimport './${isTailwind ? 'index.css' : 'App.scss'}'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n`
      }
    ];

    if (isTailwind) {
      artifacts.push({
        path: "tailwind.config.js",
        content: `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: [\n    "./index.html",\n    "./src/**/*.{js,ts,jsx,tsx}",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}\n`
      });
      artifacts.push({
        path: "postcss.config.js",
        content: `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}\n`
      });
      artifacts.push({
        path: "src/index.css",
        content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`
      });
    }

    if (generateStorybook) {
      artifacts.push({
        path: ".storybook/main.ts",
        content: `import type { StorybookConfig } from "@storybook/react-vite";\n\nconst config: StorybookConfig = {\n  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],\n  addons: [\n    "@storybook/addon-links",\n    "@storybook/addon-essentials",\n    "@storybook/addon-interactions",\n  ],\n  framework: {\n    name: "@storybook/react-vite",\n    options: {},\n  },\n  docs: {\n    autodocs: "tag",\n  },\n};\nexport default config;\n`
      });
      artifacts.push({
        path: ".storybook/preview.ts",
        content: `import type { Preview } from "@storybook/react";\nimport '../src/${isTailwind ? 'index.css' : 'App.scss'}';\n\nconst preview: Preview = {\n  parameters: {\n    actions: { argTypesRegex: "^on[A-Z].*" },\n    controls: {\n      matchers: {\n        color: /(background|color)$/i,\n        date: /Date$/i,\n      },\n    },\n  },\n};\n\nexport default preview;\n`
      });
    }

    return artifacts;
  }

  private async handleAssets(dsl: DSLNode, fileKey: string, projectDir: string, onProgress?: (msg: string) => void) {
    const imageIds: string[] = [];
    const vectorIds: string[] = [];

    const collectIds = (node: DSLNode) => {
      if (node.type === "Image") imageIds.push(node.figmaId);
      if (node.type === "Vector") vectorIds.push(node.figmaId);
      node.children?.forEach(collectIds);
    };
    collectIds(dsl);

    if (imageIds.length > 0) {
      console.log(`🤖 Agent: Exporting ${imageIds.length} images...`);
      const imageUrls = await getFigmaImages(fileKey, imageIds, "png", onProgress);
      for (const [id, url] of Object.entries(imageUrls)) {
        if (url) {
          const node = this.findNodeByFigmaId(dsl, id);
          if (node) {
            onProgress?.(`⬇️ Downloading image: ${node.className}.png`);
            const dest = path.join(projectDir, "src", "assets", `${node.className}.png`);
            await downloadAsset(url, dest, onProgress);
          }
        }
      }
    }

    if (vectorIds.length > 0) {
      console.log(`🤖 Agent: Exporting ${vectorIds.length} vectors/icons...`);
      const vectorUrls = await getFigmaImages(fileKey, vectorIds, "svg", onProgress);
      for (const [id, url] of Object.entries(vectorUrls)) {
        if (url) {
          const node = this.findNodeByFigmaId(dsl, id);
          if (node) {
            onProgress?.(`⬇️ Downloading icon: ${node.className}.svg`);
            const dest = path.join(projectDir, "src", "assets", "icons", `${node.className}.svg`);
            await downloadAsset(url, dest, onProgress);
          }
        }
      }
    }
  }

  private findNodeByFigmaId(node: DSLNode, figmaId: string): DSLNode | null {
    if (node.figmaId === figmaId) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNodeByFigmaId(child, figmaId);
        if (found) return found;
      }
    }
    return null;
  }

  private async processSection(node: DSLNode, tokens: DesignTokens, constraints: any, userInstructions?: string) {
    console.log(`🤖 Agent: Processing section "${node.name}"...`);

    // AI Planning for this component
    const plan: ArchitecturePlan = await this.planner.createPlan(node, constraints, userInstructions);

    const componentName = plan.rootComponent || node.name.replace(/\s+/g, "");
    const reactCode = generateReactComponent(node, plan, constraints);

    const artifacts = [
      { path: `src/components/${componentName}.tsx`, content: reactCode },
      { path: `src/components/${componentName}.test.tsx`, content: generateTest(componentName) }
    ];

    if (constraints.styleFramework !== 'tailwind') {
      const scssCode = generateScss(node, tokens, plan);
      artifacts.push({ path: `src/components/${componentName.toLowerCase()}.scss`, content: scssCode });
    }

    if (constraints.generateStorybook) {
      const storyCode = generateStory(node, plan, componentName);
      artifacts.push({ path: `src/components/${componentName}.stories.tsx`, content: storyCode });
    }

    return {
      artifacts,
      componentName
    };
  }

  async processFigmaNode(node: any, constraints: any = {}) {
    console.log(`🤖 Agent: Parsing design for "${node.name}"...`);

    const dsl = figmaToDSL(node);
    const tokens = extractTokens(dsl);

    const defaultConstraints = {
      framework: "react",
      styles: "scss",
      naming: "BEM",
      semantic: true,
      ...constraints
    };

    const plan: ArchitecturePlan = await this.planner.createPlan(dsl, defaultConstraints);
    const reactCode = generateReactComponent(dsl, plan);
    const scssCode = generateScss(dsl, tokens);

    return {
      dsl,
      plan,
      reactCode,
      scssCode,
      tokens
    };
  }

  async getPostGenerationSuggestions(projectName: string): Promise<string[]> {
    const prompt = `Project "${projectName}" generation is complete. 
    As a Senior Architect, provide 3-4 professional suggestions for the next steps or improvements. 
    Focus on performance, accessibility (A11y), and interactive features.
    Keep suggestions concise and technical.
    Return as a JSON array of strings.`;

    try {
      const response = await this.aiService.generateJSON(prompt);
      return Array.isArray(response) ? response : ["Add responsive breakpoints", "Optimize images", "Add ARIA labels"];
    } catch {
      return ["Add responsive breakpoints", "Optimize images", "Add ARIA labels"];
    }
  }

  resolveFontDecision(decision: any) {
    if (this.fontDecisionResolver) {
      this.fontDecisionResolver(decision);
      this.fontDecisionResolver = null;
    }
  }

  private applyFontReplacements(node: DSLNode, replacements: Record<string, string>) {
    const traverse = (n: DSLNode) => {
      if (n.style?.fontName?.family && replacements[n.style.fontName.family]) {
        n.style.fontName.family = replacements[n.style.fontName.family];
      }
      n.children?.forEach(traverse);
    };
    traverse(node);
  }

  private detectFonts(node: DSLNode): string[] {
    const fonts = new Set<string>();
    const collect = (n: DSLNode) => {
      if (n.style?.fontName?.family) {
        fonts.add(n.style.fontName.family);
      }
      n.children?.forEach(collect);
    };
    collect(node);
    return Array.from(fonts);
  }

  private async analyzeFonts(fonts: string[]): Promise<{ family: string, isCommercial: boolean, suggestion?: string }[]> {
    if (fonts.length === 0) return [];

    const prompt = `
      Analyze the following list of font families from a Figma design. 
      Identify which ones are COMMERCIAL (paid/not web-safe/not in Google Fonts).
      For each commercial font, suggest the BEST matching free alternative from Google Fonts.
      
      FONTS:
      ${fonts.join(", ")}
      
      RETURN ONLY valid JSON array of objects in this format:
      [
        { "family": "Original Name", "isCommercial": true, "suggestion": "Suggested Google Font" },
        { "family": "Arial", "isCommercial": false }
      ]
    `;

    try {
      const response = await this.aiService.chat(prompt);
      const jsonText = response.replace(/```json|```/g, "").trim();
      return JSON.parse(jsonText);
    } catch (e) {
      console.error("AI Font Analysis failed:", e);
      return fonts.map(f => ({ family: f, isCommercial: false }));
    }
  }
}
