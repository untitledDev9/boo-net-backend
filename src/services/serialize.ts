import type { PopulateOptions } from 'mongoose';
import { RESOURCE_BY_KEY } from '../resources/registry.js';
import type { FieldSpec, ResourceSpec } from '../resources/types.js';

const MEDIA_FIELDS = 'url secureUrl alt width height';

/** Mongoose populate options so media and relation fields come back resolved. */
export function populateFor(spec: ResourceSpec): PopulateOptions[] {
  const out: PopulateOptions[] = [];
  for (const f of spec.fields) {
    if (f.type === 'media' || f.type === 'mediaList') out.push({ path: f.name, model: 'mediaAsset', select: MEDIA_FIELDS });
    if (f.type === 'ref' && f.ref) {
      const target = RESOURCE_BY_KEY.get(f.ref);
      if (target) out.push({ path: f.name, model: target.key, select: `${target.titleField} ${target.slugFrom ? 'slug' : ''}` });
    }
  }
  return out;
}

export interface MediaRef {
  id: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

type AnyDoc = Record<string, any>;

function mediaOf(v: AnyDoc | null | undefined): MediaRef | null {
  if (!v || typeof v !== 'object' || !('url' in v)) return null;
  return { id: String(v._id), url: v.secureUrl || v.url, alt: v.alt ?? '', width: v.width, height: v.height };
}

function valueOf(f: FieldSpec, v: any): unknown {
  if (v === undefined || v === null) return f.type === 'stringList' || f.type === 'mediaList' || f.type === 'objectList' ? [] : null;
  switch (f.type) {
    case 'media':
      return mediaOf(v);
    case 'mediaList':
      return (v as AnyDoc[]).map(mediaOf).filter(Boolean);
    case 'ref': {
      if (typeof v === 'object' && v._id) {
        const target = f.ref ? RESOURCE_BY_KEY.get(f.ref) : undefined;
        return { id: String(v._id), title: target ? v[target.titleField] : undefined, slug: v.slug };
      }
      return { id: String(v) };
    }
    case 'date':
      return v instanceof Date ? v.toISOString() : v;
    case 'objectList':
      return (v as AnyDoc[]).map((item) => {
        const o: AnyDoc = {};
        for (const sub of f.fields ?? []) o[sub.name] = valueOf(sub, item?.[sub.name]);
        return o;
      });
    default:
      return v;
  }
}

/** Turn a lean, populated document into the JSON the API returns. */
export function serialize(spec: ResourceSpec, doc: AnyDoc): AnyDoc {
  const out: AnyDoc = { id: String(doc._id) };
  for (const f of spec.fields) out[f.name] = valueOf(f, doc[f.name]);
  if (spec.slugFrom) out.slug = doc.slug ?? null;
  if (spec.publishable) {
    out.status = doc.status;
    out.publishAt = doc.publishAt ? new Date(doc.publishAt).toISOString() : null;
    out.sortOrder = doc.sortOrder ?? 0;
  }
  out.createdAt = doc.createdAt ? new Date(doc.createdAt).toISOString() : null;
  out.updatedAt = doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null;
  return out;
}
