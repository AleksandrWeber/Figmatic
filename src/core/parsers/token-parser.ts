import { DSLNode } from "../dsl/dsl-parser.ts";
import { figmaColorToCss } from "../generators/scss-generator.ts";

export interface DesignTokens {
  colors: Record<string, string>; // hex/rgba -> variable name
  typography: Record<string, string>; // signature -> mixin/var name
}

export function extractTokens(node: DSLNode, tokens: DesignTokens = { colors: {}, typography: {} }): DesignTokens {
  // Extract Colors
  if (node.style?.fills) {
    node.style.fills.forEach((fill: any) => {
      if (fill.type === "SOLID") {
        const cssColor = figmaColorToCss(fill.color);
        if (!tokens.colors[cssColor]) {
          const index = Object.keys(tokens.colors).length + 1;
          tokens.colors[cssColor] = `$color-global-${index}`;
        }
      }
    });
  }

  // Extract Typography (Simple version)
  if (node.type === "Text" && node.style?.fontSize) {
    const signature = `fs-${node.style.fontSize}-fw-${node.style.fontWeight}`;
    if (!tokens.typography[signature]) {
      tokens.typography[signature] = `$font-size-${node.style.fontSize}`;
    }
  }

  // Recursive
  if (node.children) {
    node.children.forEach(child => extractTokens(child, tokens));
  }

  return tokens;
}

export function generateTokenScss(tokens: DesignTokens): string {
  let scss = "// Global Design Tokens\n\n";

  scss += "// Colors\n";
  for (const [value, name] of Object.entries(tokens.colors)) {
    scss += `${name}: ${value};\n`;
  }

  scss += "\n// Typography (Basic)\n";
  for (const [sig, name] of Object.entries(tokens.typography)) {
    const fontSize = sig.split("-")[1];
    scss += `${name}: ${fontSize}px;\n`;
  }

  return scss;
}
