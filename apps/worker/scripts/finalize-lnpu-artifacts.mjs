import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '../..');
const cap = JSON.parse(
  readFileSync(resolve(root, 'data/captures/lnpu/wizard-step-1.json'), 'utf-8'),
);
const schema = JSON.parse(
  readFileSync(resolve(root, 'data/university-schemas/lnpu.json'), 'utf-8'),
);

const names = new Set(cap.fields.map((f) => f.name).filter(Boolean));
const missing = [];

for (const field of schema.fields) {
  if (field.type === 'file') continue;
  const match = field.selector.match(/name="([^"]+)/);
  if (match && !names.has(match[1])) {
    missing.push({ selector: field.selector, name: match[1] });
  }
}

console.log('missing names in capture:', missing);

const interesting = cap.fields.filter(
  (f) =>
    /email|mobile|tel|mother|tongue|highest|occupation|religion|notice|native/i.test(
      `${f.name || ''} ${f.label || ''}`,
    ),
);
console.log(
  'email-ish',
  interesting.map((f) => ({ name: f.name, label: f.label })),
);

const step2 = JSON.parse(
  readFileSync(resolve(root, 'data/captures/lnpu/wizard-step-2.json'), 'utf-8'),
);
step2.fileInputs = [
  { label: 'Personal Photos', selector: '#fileupload_0', required: true },
  {
    label: 'Passport & Passport Blank Page',
    selector: '#fileupload_1',
    required: true,
  },
  { label: 'High School Transcript', selector: '#fileupload_2', required: true },
  { label: 'High School Certificate', selector: '#fileupload_3', required: true },
  {
    label: "Notarized Bachelor's Degree Certificate",
    selector: '#fileupload_4',
    required: true,
  },
  {
    label: 'Bachelors Degree Transcript',
    selector: '#fileupload_5',
    required: true,
  },
  {
    label: 'Two letters of recommendation',
    selector: '#fileupload_6',
    required: true,
  },
];
step2.wizardStepTitle = 'Upload Materials';
writeFileSync(
  resolve(root, 'data/captures/lnpu/wizard-step-2.json'),
  JSON.stringify(step2, null, 2),
);

mkdirSync(resolve(process.cwd(), 'browser-sessions'), { recursive: true });
copyFileSync(
  resolve(root, 'data/captures/lnpu/session.json'),
  resolve(process.cwd(), 'browser-sessions/lnpu.json'),
);
const b64 = Buffer.from(
  readFileSync(resolve(root, 'data/captures/lnpu/session.json')),
).toString('base64');
writeFileSync(resolve(process.cwd(), 'browser-sessions/lnpu.json.b64'), b64);
writeFileSync(resolve(root, 'data/captures/lnpu/session.json.b64'), b64);
console.log('b64 length', b64.length);
