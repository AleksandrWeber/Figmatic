import { ArchitecturePlan } from "../ai/code-planner.ts";

export function generateTest(componentName: string): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ${componentName} from './${componentName}';

describe('${componentName}', () => {
  it('renders without crashing', () => {
    render(<${componentName} />);
    // Basic presence check - can be improved by Senior Architect based on purpose
    expect(screen.getByRole('generic') || screen.getByText(/./)).toBeDefined();
  });

  // Future refinement: AI could generate specific assertions based on the component's purpose
});
`;
}
