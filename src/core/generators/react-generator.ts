import { DSLNode } from "../dsl/dsl-parser.ts";
import { ArchitecturePlan, ComponentPlan } from "../ai/code-planner.ts";

export function generateReactComponent(node: DSLNode, plan: ArchitecturePlan, constraints: any = {}): string {
  const componentName = plan.rootComponent || node.name.replace(/\s+/g, "");
  const isTailwind = constraints.styleFramework === 'tailwind';

  const childrenCode = node.children?.map(child => generateNodeJSX(child, plan.components)).join("\n") || "";

  return `import React from 'react';
${isTailwind ? '' : `import './${componentName.toLowerCase()}.scss';`}

export const ${componentName}: React.FC = () => {
  return (
    <div className="${node.className}">
${childrenCode.split('\n').map(line => '      ' + line).join('\n')}
    </div>
  );
};
`;
}

function generateNodeJSX(node: DSLNode, components?: ComponentPlan[]): string {
  // Find if AI planned a specific tag for this node
  const plan = components?.find(c => c.name === node.name);
  let tag = "div";

  if (plan && plan.tag) {
    // Strip < > if present
    tag = plan.tag.replace(/[<>]/g, "");
  } else if (node.type === "Text") {
    tag = node.props.fontSize > 24 ? "h1" : "p";
  }

  const childrenCode = node.children?.map(child => generateNodeJSX(child, components)).join("\n") || "";

  if (node.type === "Text") {
    return `<${tag} className="${node.className}">${node.props.text}</${tag}>`;
  }

  if (node.type === "Image") {
    const src = `../assets/${node.className}.png`;
    return `<img className="${node.className}" src="${src}" alt="${node.name}" />`;
  }

  if (node.type === "Vector") {
    const src = `../assets/icons/${node.className}.svg`;
    return `<img className="${node.className}" src="${src}" alt="${node.name}" />`;
  }

  return `<${tag} className="${node.className}">
${childrenCode.split('\n').map(line => '  ' + line).join('\n')}
</${tag}>`;
}

export function generateRootComponent(sections: { name: string, fileName: string }[], constraints: any = {}): string {
  const imports = sections
    .map(s => `import { ${s.name} } from './components/${s.name}';`)
    .join('\n');

  const renders = sections
    .map(s => `      <${s.name} />`)
    .join('\n');

  const isTailwind = constraints.styleFramework === 'tailwind';

  return `import React from 'react';
${imports}
${isTailwind ? "" : "import './App.scss';"}

export const App: React.FC = () => {
  return (
    <div className="app-container">
${renders}
    </div>
  );
};

export default App;
`;
}
