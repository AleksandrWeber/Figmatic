import { DSLNode } from "../dsl/dsl-parser.ts";
import { GeminiService } from "./gemini-service.ts";

export interface ComponentPlan {
  name: string;
  tag: string;
  purpose: string;
  children?: ComponentPlan[];
}

export interface ArchitecturePlan {
  rootComponent: string;
  components: ComponentPlan[];
  styleStrategy: string;
  styleOverrides?: Record<string, string>;
  files: { path: string; content: string | "GENERATED" }[];
}

export class CodePlanner {
  private ai: GeminiService;

  constructor(ai: GeminiService) {
    this.ai = ai;
  }

  async createPlan(dsl: DSLNode, constraints: any, userInstructions?: string): Promise<ArchitecturePlan> {
    const prompt = `
      You are an expert Frontend Architect.
      Analyze the following Figma Design DSL and create a implementation plan.

      CONSTRAINTS:
      ${JSON.stringify(constraints, null, 2)}

      ${userInstructions ? `IMPORTANT - USER REFINEMENT INSTRUCTIONS:
      ${userInstructions}
      ` : ""}

      DESIGN DSL:
      ${JSON.stringify(dsl, null, 2)}

      TASKS:
      1. Interpret the design: detect components, list semantic tags (nav, main, button, etc.).
      2. Plan the React component architecture.
      3. Define a style strategy. IMPORTANT: ${constraints.styleFramework === 'tailwind' ? 'Use TAILWIND CSS utility classes for ALL styles. DO NOT generate SCSS.' : 'Define variables and BEM mixins for SCSS.'}
      4. Note on Typography: Use the font-family names provided in CONSTRAINTS.fontReplacements if any.
      5. List the files to be created.

      RETURN ONLY JSON in this format:
      {
        "rootComponent": "string",
        "components": [
          { "name": "string", "tag": "string", "purpose": "string", "children": [] }
        ],
        "styleStrategy": "string",
        "styleOverrides": { "className": "color: red; font-size: 50px;" },
        "files": [
          { "path": "string", "content": "GENERATED" }
        ]
      }
    `;

    const responseText = await this.ai.chat(prompt);

    // Clean up JSON response
    const jsonText = responseText.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonText);
  }
}
