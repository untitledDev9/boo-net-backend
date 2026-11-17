/**
 * Field-spec DSL. One definition per content type drives: the Mongoose schema, the zod validators,
 * the public API, and the form/table definitions the admin UI renders (served from /api/admin/meta).
 */

export type Role = 'superadmin' | 'admin' | 'editor' | 'support';
export const ALL_ROLES: Role[] = ['superadmin', 'admin', 'editor', 'support'];

export type FieldType =
  | 'string'
  | 'text'
  | 'markdown'
  | 'number'
  | 'money' // stored as integer cents; the admin UI edits dollars
  | 'boolean'
  | 'date'
  | 'select'
  | 'media'
  | 'mediaList'
  | 'stringList'
  | 'ref'
  | 'objectList'
  | 'json';

export interface FieldSpec {
  name: string;
  type: FieldType;
  label: string;
  required?: boolean;
  help?: string;
  options?: readonly string[]; // select
  ref?: string; // resource key (ref)
  fields?: FieldSpec[]; // objectList item fields
  default?: string | number | boolean;
  max?: number;
  /** Show as a column in the admin table. */
  list?: boolean;
  /** Allow ?name=value filtering on the public + admin list endpoints. */
  filter?: boolean;
  /** Visitors may set this field when creating a record through the public submit endpoint. */
  submit?: boolean;
  /** Form section heading in the admin UI. */
  group?: string;
  /** Never editable through the API (set by the server). */
  readOnly?: boolean;
}

export interface ResourceSpec {
  /** Collection/model key and admin API path segment, e.g. "videos" uses key "video". */
  key: string;
  /** URL segment under /api/public and /api/admin. */
  path: string;
  label: string;
  singular: string;
  /** Admin sidebar module this belongs to. */
  module: string;
  fields: FieldSpec[];
  /** Field shown as the record title in tables and relation pickers. */
  titleField: string;
  searchFields: string[];
  /** Adds status (draft/published/archived), publishAt and sortOrder. */
  publishable: boolean;
  orderable?: boolean;
  /** Generate a unique slug from this field when none is supplied. */
  slugFrom?: string;
  /** Exactly one document; edited, never created or deleted. */
  singleton?: boolean;
  /** Public GET endpoints exist for this resource. */
  publicRead: boolean;
  /** Visitors can POST a new record (inbox-style). Only fields with submit:true are accepted. */
  publicSubmit?: { rateLimitPerHour: number; defaults?: Record<string, unknown> };
  /** Extra filter always applied to public reads (e.g. hide hidden comments). */
  publicFilter?: Record<string, unknown>;
  /** Roles that may create/update/delete. */
  writeRoles: Role[];
  /** Roles that may list/read in the admin (defaults to writeRoles + support for inboxes). */
  readRoles?: Role[];
  /** Only superadmin may hard-delete; others archive (publishable) or delete (non-publishable). */
  defaultSort?: string;
  /** Plain-language description shown in the admin UI. */
  description?: string;
}
