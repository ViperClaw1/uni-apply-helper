import type { AgentContext, AgentObservation } from '@uni-apply/shared';

export function buildPlannerPrompt(
  observation: AgentObservation,
  context: AgentContext,
): string {
  const pendingFields = context.pendingFields
    .map((field) => {
      const base = `- ${field.label} (${field.type}, mapsTo=${field.mapsTo ?? 'n/a'}, required=${field.required}) => ${field.value}`;
      return field.selector ? `${base} [selector=${field.selector}]` : base;
    })
    .join('\n');

  const previousActions = context.previousActions
    .slice(-8)
    .map((action) => `- ${action.type}: ${action.reason ?? JSON.stringify(action.target)}`)
    .join('\n');

  return [
    'You are a browser automation agent filling a university application form.',
    `Goal: ${context.goal}`,
    `University: ${context.universityName}`,
    '',
    'Return ONE JSON object only, no markdown:',
    '{',
    '  "action": {',
    '    "type": "fill|click|select|check|upload|wait|done|fail",',
    '    "target": { "role": "...", "name": "...", "label": "...", "placeholder": "...", "selector": "..." },',
    '    "value": "...",',
    '    "filePath": "optional URL/path for upload",',
    '    "reason": "short explanation"',
    '  },',
    '  "confidence": 0.0,',
    '  "useVision": false',
    '}',
    '',
    'Rules:',
    '- Prefer role/label/placeholder targets over raw CSS selectors.',
    '- Use accessibility tree fields: required, options=[...], hint, near=surrounding text when choosing fill/select.',
    '- For select: pick an option label that exists in options=[...] from the tree.',
    '- For file/document fields use type=upload with value/filePath set to the pending field URL.',
    '- Use type=done when the goal is reached (confirmation/submitted/summary page).',
    '- Use type=fail only if the page is blocked and cannot continue.',
    '- For wizard forms, click "Save and Next" after filling visible fields on the step.',
    '- Do not invent values — only use pending field values provided below.',
    '- If a previous action is marked FAILED, try a different target/strategy.',
    '',
    'Pending fields:',
    pendingFields || '- none',
    '',
    'Previous actions:',
    previousActions || '- none',
    '',
    `Current URL: ${observation.url}`,
    `Page title: ${observation.title}`,
    '',
    'Visible text:',
    observation.visibleText,
    '',
    'Accessibility tree:',
    observation.accessibilityTree || '(empty)',
  ].join('\n');
}

export function buildFieldMappingPrompt(
  observation: AgentObservation,
  field: {
    label: string;
    type: string;
    value: string;
    selector?: string;
    labelHint?: string;
  },
): string {
  return [
    'Find the best Playwright locator strategy for one form field.',
    'Return JSON only:',
    '{ "target": { "role": "...", "name": "...", "label": "...", "placeholder": "...", "selector": "..." }, "confidence": 0.0 }',
    '',
    'Use accessibility tree: required flags, select options=[...], hint, near=surrounding.',
    '',
    `Field label: ${field.label}`,
    `Field type: ${field.type}`,
    `Value to fill: ${field.value}`,
    field.selector ? `CSS hint: ${field.selector}` : '',
    field.labelHint ? `Label hint: ${field.labelHint}` : '',
    '',
    `URL: ${observation.url}`,
    '',
    'Accessibility tree:',
    observation.accessibilityTree || '(empty)',
  ]
    .filter(Boolean)
    .join('\n');
}
