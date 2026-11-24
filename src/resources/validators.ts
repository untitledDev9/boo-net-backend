import { z, type ZodTypeAny } from 'zod';
import type { FieldSpec, ResourceSpec } from './types.js';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

function base(f: FieldSpec): ZodTypeAny {
  switch (f.type) {
    case 'string':
      return z.string().trim().max(f.max ?? 500);
    case 'text':
      return z.string().max(f.max ?? 20000);
    case 'markdown':
      return z.string().max(f.max ?? 400000);
    case 'number':
      return z.number().finite();
    case 'money':
      return z.number().int().min(0).max(100_000_000);
    case 'boolean':
      return z.boolean();
    case 'date':
      return z.coerce.date();
    case 'select':
      return z.enum([...(f.options ?? [])] as [string, ...string[]]);
    case 'media':
    case 'ref':
      return objectId;
    case 'mediaList':
      return z.array(objectId).max(50);
    case 'stringList':
      return z.array(z.string().trim().max(300)).max(200);
    case 'objectList':
      return z.array(z.object(shape(f.fields ?? [], false))).max(300);
    case 'json':
      return z.record(z.string(), z.unknown());
  }
}

function field(f: FieldSpec, requireIt: boolean): ZodTypeAny {
  const schema = base(f);
  const textual = f.type === 'string' || f.type === 'text' || f.type === 'markdown';
  if (requireIt && f.required) {
    // Required strings must be non-empty.
    return textual ? (schema as z.ZodString).min(1, `${f.label} is required`) : schema;
  }
  // On update a required text field may be left out, but if it is sent it cannot be blanked.
  if (f.required && textual) return (schema as z.ZodString).min(1, `${f.label} is required`).optional();
  // Optional fields accept null (clearing a value) and empty strings.
  const emptyOk = f.type === 'string' || f.type === 'text' || f.type === 'markdown' ? z.union([schema, z.literal('')]) : schema;
  return emptyOk.nullable().optional();
}

function shape(fields: FieldSpec[], requireRequired: boolean): Record<string, ZodTypeAny> {
  const out: Record<string, ZodTypeAny> = {};
  for (const f of fields) if (!f.readOnly) out[f.name] = field(f, requireRequired);
  return out;
}

const publishFields = {
  status: z.enum(['draft', 'published', 'archived']).optional(),
  publishAt: z.coerce.date().nullable().optional(),
  sortOrder: z.number().int().min(-100000).max(100000).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers and dashes')
    .max(120)
    .optional(),
};

/** Validators generated from a resource spec. Unknown keys are stripped (no mass assignment). */
export function validatorsFor(spec: ResourceSpec) {
  const extra = {
    ...(spec.publishable ? { status: publishFields.status, publishAt: publishFields.publishAt, sortOrder: publishFields.sortOrder } : {}),
    ...(spec.slugFrom ? { slug: publishFields.slug } : {}),
  };
  const create = z.object({ ...shape(spec.fields, true), ...extra });
  const update = z.object({ ...shape(spec.fields, false), ...extra });
  // Public submissions: only submit:true fields, with required ones enforced.
  const submitFields = spec.fields.filter((f) => f.submit);
  const submit = z.object(shape(submitFields, true));
  return { create, update, submit };
}
