import { figmaToDSL, DSLNode } from "./dsl/dsl-parser.ts";
import { GeminiService } from "./ai/gemini-service.ts";
import { CodePlanner, ArchitecturePlan } from "./ai/code-planner.ts";
import { generateReactComponent, generateRootComponent } from "./generators/react-generator.ts";
import { generateScss } from "./generators/scss-generator.ts";
import { extractTokens, DesignTokens, generateTokenScss } from "./parsers/token-parser.ts";
import { getFigmaImages, downloadAsset } from "./figma/figma-api.ts";
import * as path from "path";
import * as fs from "fs";

export class Agent {
  private aiService: GeminiService;
  private planner: CodePlanner;

  constructor() {
    this.aiService = new GeminiService("You are Figmatic - an expert Frontend Architect AI Agent.");
    this.planner = new CodePlanner(this.aiService);
  }

  async processFullPage(rootNode: any, fileKey: string, constraints: any = {}, userInstructions?: string) {
    console.log(`🤖 Agent: Processing full page design "${rootNode.name}"...`);

    // 1. Parse Full Page to DSL
    const fullDsl = figmaToDSL(rootNode);

    // 2. Asset Management
    await this.handleAssets(fullDsl, fileKey);

    // 3. Extract Global Tokens
    const tokens = extractTokens(fullDsl);
    const tokenScss = generateTokenScss(tokens);

    // 4. Process each section ...
    const sections = fullDsl.children || [];
    const sectionMetadata: { name: string, fileName: string }[] = [];
    const artifacts: any[] = [
      { path: "_variables.scss", content: tokenScss },
      {
        path: "_reset.scss",
        content: `* { margin: 0; padding: 0; box-sizing: border-box; }\nhtml, body { height: 100%; }\nimg, picture, video, canvas, svg { display: block; max-width: 100%; }\ninput, button, textarea, select { font: inherit; }\np, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }\n`
      },
      {
        path: "_base.scss",
        content: `@import 'reset';\n@import 'variables';\n\nbody {\n  font-family: 'Inter', sans-serif;\n  -webkit-font-smoothing: antialiased;\n  background-color: white;\n}\n`
      }
    ];

    for (const section of sections) {
      const { artifacts: sectionArts, componentName } = await this.processSection(section, tokens, constraints, userInstructions);
      artifacts.push(...sectionArts);
      sectionMetadata.push({ name: componentName, fileName: componentName });
    }

    // 5. Generate Root Orchestrator
    console.log("🤖 Agent: Generating Root Orchestrator (App.tsx)...");
    const rootCode = generateRootComponent(sectionMetadata);
    artifacts.push({ path: "App.tsx", content: rootCode });
    artifacts.push({ path: "App.scss", content: "@import 'base';\n\n.app-container {\n  display: flex;\n  flex-direction: column;\n  min-height: 100vh;\n}\n" });

    return artifacts;
  }

  private async handleAssets(dsl: DSLNode, fileKey: string) {
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
      const imageUrls = await getFigmaImages(fileKey, imageIds, "png");
      for (const [id, url] of Object.entries(imageUrls)) {
        if (url) {
          const node = this.findNodeByFigmaId(dsl, id);
          if (node) {
            const dest = path.resolve(`output/assets/${node.className}.png`);
            await downloadAsset(url, dest);
          }
        }
      }
    }

    if (vectorIds.length > 0) {
      console.log(`🤖 Agent: Exporting ${vectorIds.length} vectors/icons...`);
      const vectorUrls = await getFigmaImages(fileKey, vectorIds, "svg");
      for (const [id, url] of Object.entries(vectorUrls)) {
        if (url) {
          const node = this.findNodeByFigmaId(dsl, id);
          if (node) {
            const dest = path.resolve(`output/assets/icons/${node.className}.svg`);
            await downloadAsset(url, dest);
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
    const reactCode = generateReactComponent(node, plan);
    const scssCode = generateScss(node, tokens, plan);

    return {
      artifacts: [
        { path: `components/${componentName}.tsx`, content: reactCode },
        { path: `components/${componentName.toLowerCase()}.scss`, content: scssCode }
      ],
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
}
