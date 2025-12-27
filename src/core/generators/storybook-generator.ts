import { DSLNode } from "../dsl/dsl-parser.ts";
import { ArchitecturePlan, ComponentPlan } from "../ai/code-planner.ts";

export function generateStory(node: DSLNode, plan: ArchitecturePlan, componentName: string): string {
  return `import type { Meta, StoryObj } from '@storybook/react';
import ${componentName} from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ${componentName}>;

export const Default: Story = {
  args: {},
};
`;
}
