import type { FieldSpec, FieldType } from './types.js';

type Opts = Partial<Omit<FieldSpec, 'name' | 'type' | 'label'>>;

const make =
  (type: FieldType) =>
  (name: string, label: string, opts: Opts = {}): FieldSpec => ({ name, type, label, ...opts });

export const str = make('string');
export const text = make('text');
export const md = make('markdown');
export const num = make('number');
export const money = make('money');
export const bool = make('boolean');
export const date = make('date');
export const media = make('media');
export const mediaList = make('mediaList');
export const strList = make('stringList');
export const json = make('json');

export const sel = (name: string, label: string, options: readonly string[], opts: Opts = {}): FieldSpec => ({
  name,
  type: 'select',
  label,
  options,
  default: options[0],
  ...opts,
});

export const ref = (name: string, label: string, target: string, opts: Opts = {}): FieldSpec => ({
  name,
  type: 'ref',
  label,
  ref: target,
  ...opts,
});

export const objList = (name: string, label: string, fields: FieldSpec[], opts: Opts = {}): FieldSpec => ({
  name,
  type: 'objectList',
  label,
  fields,
  ...opts,
});
