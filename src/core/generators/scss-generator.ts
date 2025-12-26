import { DSLNode } from "../dsl/dsl-parser.ts";
import { DesignTokens } from "../parsers/token-parser.ts";
import { ArchitecturePlan } from "../ai/code-planner.ts";

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function figmaColorToCss(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a ?? 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function generateScss(dsl: DSLNode, tokens?: DesignTokens, plan?: ArchitecturePlan): string {
  let scss = "// Generated Styles\n";
  if (tokens) {
    scss += "@import '../variables';\n\n";
  } else {
    scss += "\n";
  }
  const styles: string[] = [];

  processNode(dsl, styles, tokens, plan);

  return scss + styles.join("\n");
}

function processNode(node: DSLNode, styles: string[], tokens?: DesignTokens, plan?: ArchitecturePlan) {
  const className = node.className;

  let nodeStyle = `.${className} {\n`;
  let hasStyle = false;

  // Background/Fills
  if (node.style?.fills && node.style.fills.length > 0) {
    const fill = node.style.fills[0];
    if (fill.type === "SOLID") {
      const color = figmaColorToCss(fill.color);
      const tokenName = tokens?.colors[color];

      if (tokenName) {
        nodeStyle += `  background-color: ${tokenName};\n`;
      } else {
        nodeStyle += `  background-color: ${color};\n`;
      }
      hasStyle = true;
    }
  }

  // Layout & Sizing
  if (node.layout) {
    if (node.layout.mode && node.layout.mode !== "NONE") {
      nodeStyle += `  display: flex;\n`;
      nodeStyle += `  flex-direction: ${node.layout.mode === "HORIZONTAL" ? "row" : "column"};\n`;
      nodeStyle += `  gap: ${node.layout.spacing}px;\n`;

      // Alignment
      if (node.layout.align) {
        const alignMap: Record<string, string> = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", STRETCH: "stretch" };
        nodeStyle += `  align-items: ${alignMap[node.layout.align] || "flex-start"};\n`;
      }
      if (node.layout.distribute) {
        const distMap: Record<string, string> = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", SPACE_BETWEEN: "space-between" };
        nodeStyle += `  justify-content: ${distMap[node.layout.distribute] || "flex-start"};\n`;
      }
      hasStyle = true;
    }

    // Horizontal Sizing
    if (node.layout.horizontal === "FILL") {
      nodeStyle += `  align-self: stretch;\n`;
      nodeStyle += `  width: 100%;\n`;
    } else if (node.layout.horizontal === "HUG") {
      nodeStyle += `  width: fit-content;\n`;
    } else if (node.layout.horizontal === "FIXED" && node.layout.width) {
      nodeStyle += `  width: ${node.layout.width}px;\n`;
    }

    // Vertical Sizing
    if (node.layout.vertical === "FILL") {
      nodeStyle += `  height: 100%;\n`;
    } else if (node.layout.vertical === "HUG") {
      nodeStyle += `  height: fit-content;\n`;
    } else if (node.layout.vertical === "FIXED" && node.layout.height) {
      nodeStyle += `  height: ${node.layout.height}px;\n`;
    }

    if (node.layout.padding) {
      const p = node.layout.padding;
      nodeStyle += `  padding: ${p.top}px ${p.right}px ${p.bottom}px ${p.left}px;\n`;
      hasStyle = true;
    }
  }

  // Text specific
  if (node.type === "Text" && node.style) {
    if (node.style.fontSize) {
      const sig = `fs-${node.style.fontSize}-fw-${node.style.fontWeight}`;
      const tokenName = tokens?.typography[sig];

      if (tokenName) {
        nodeStyle += `  font-size: ${tokenName};\n`;
      } else {
        nodeStyle += `  font-size: ${node.style.fontSize}px;\n`;
      }
    }
    if (node.style.fontWeight) nodeStyle += `  font-weight: ${node.style.fontWeight};\n`;
    if (node.style.textAlign) nodeStyle += `  text-align: ${node.style.textAlign.toLowerCase()};\n`;
    hasStyle = true;
  }

  // AI Style Overrides
  if (plan?.styleOverrides && plan.styleOverrides[className]) {
    nodeStyle += `  /* AI Overrides */\n`;
    nodeStyle += `  ${plan.styleOverrides[className].split(';').map(s => s.trim()).filter(s => s).join(';\n  ')};\n`;
    hasStyle = true;
  }

  nodeStyle += `}\n`;
  if (hasStyle) styles.push(nodeStyle);

  if (node.children) {
    node.children.forEach((child: DSLNode) => processNode(child, styles, tokens, plan));
  }
}
