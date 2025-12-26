export interface DSLNode {
  id: string;
  figmaId: string;
  name: string;
  type: "Container" | "Text" | "Image" | "Vector";
  className: string;
  layout?: {
    mode?: "NONE" | "HORIZONTAL" | "VERTICAL";
    spacing?: number;
    padding?: { top: number; right: number; bottom: number; left: number };
    align?: "MIN" | "CENTER" | "MAX" | "STRETCH";
    distribute?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
    horizontal?: "FIXED" | "HUG" | "FILL";
    vertical?: "FIXED" | "HUG" | "FILL";
    width?: number;
    height?: number;
  };
  style?: {
    fills?: any[];
    strokes?: any[];
    effects?: any[];
    fontSize?: number;
    fontWeight?: number;
    fontName?: any;
    textAlign?: string;
  };
  props: {
    text?: string;
    [key: string]: any;
  };
  children?: DSLNode[];
}

export function figmaToDSL(node: any): DSLNode {
  const className = node.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const dslNode: DSLNode = {
    id: className, // Unique CSS-safe ID
    figmaId: node.id,
    name: node.name,
    type: "Container",
    className: className,
    props: {},
    children: []
  };

  // Type identification
  if (node.type === "TEXT") {
    dslNode.type = "Text";
  } else if (node.type === "RECTANGLE" && node.fills?.[0]?.type === "IMAGE") {
    dslNode.type = "Image";
  } else if (["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "REGULAR_POLYGON"].includes(node.type) || node.name.toLowerCase().includes("icon")) {
    dslNode.type = "Vector";
  }

  // Layout & Sizing parsing
  if (node.type === "FRAME" || node.type === "GROUP") {
    dslNode.layout = {
      mode: node.layoutMode || "VERTICAL", // Default to vertical for sections
      spacing: node.itemSpacing || 0,
      padding: {
        top: node.paddingTop || 0,
        right: node.paddingRight || 0,
        bottom: node.paddingBottom || 0,
        left: node.paddingLeft || 0
      },
      align: node.counterAxisAlignItems || "STRETCH",
      distribute: node.primaryAxisAlignItems || "MIN",
      horizontal: node.layoutSizingHorizontal || (node.layoutAlign === "STRETCH" ? "FILL" : "FILL"), // Default to FILL for responsiveness
      vertical: node.layoutSizingVertical || "HUG",
      width: node.absoluteBoundingBox?.width || node.width,
      height: node.absoluteBoundingBox?.height || node.height
    };
  } else if (node.type === "RECTANGLE" || node.type === "IMAGE" || node.type === "VECTOR") {
    // For fixed elements that are not auto-layout containers
    dslNode.layout = {
      width: node.absoluteBoundingBox?.width || node.width,
      height: node.absoluteBoundingBox?.height || node.height
    };
  }

  // Style parsing
  dslNode.style = {
    fills: node.fills,
    strokes: node.strokes,
    effects: node.effects
  };

  if (node.type === "TEXT") {
    dslNode.props.text = node.characters;
    if (node.style) {
      dslNode.style.fontSize = node.style.fontSize;
      dslNode.style.fontWeight = node.style.fontWeight;
      dslNode.style.fontName = node.style.fontName;
      dslNode.style.textAlign = node.style.textAlignHorizontal;
    }
  }

  if (node.children) {
    dslNode.children = node.children
      .filter((child: any) => child.visible !== false)
      .map((child: any) => figmaToDSL(child));
  }

  return dslNode;
}
