import { FIELD_MAX_LENGTH_MAX, ItemKind, RuleKind, type FieldValue, type Item, type Rule, type TextFormat } from '@openmemorykit/ui/contract'
import { matchesFormat, normalizeFormatted } from './text-format'

export type FieldItem = Extract<Item, { readonly kind: typeof ItemKind.Cycle | typeof ItemKind.Toggle | typeof ItemKind.Text }>
type TextItem = Extract<Item, { readonly kind: typeof ItemKind.Text }>

export interface FieldError {
  readonly rule: RuleKind | null
  readonly format: TextFormat | null
  readonly message: string | null
}

const FIELD_KINDS: ReadonlySet<ItemKind> = new Set([ItemKind.Cycle, ItemKind.Toggle, ItemKind.Text])
const NO_RULES: readonly Rule[] = []
const EMPTY_TEXT = ''
const HIGH_SURROGATE_FIRST = 0xd800
const HIGH_SURROGATE_LAST = 0xdbff
const LAST_UNIT_OFFSET = 1

export function isFieldItem(item: Item): item is FieldItem {
  return FIELD_KINDS.has(item.kind)
}

function isTextItem(item: Item): item is TextItem {
  return item.kind === ItemKind.Text
}

function isHighSurrogate(unit: number): boolean {
  return unit >= HIGH_SURROGATE_FIRST && unit <= HIGH_SURROGATE_LAST
}

export function boundedText(item: TextItem, value: string): string {
  const limit = Math.min(item.maxLength, FIELD_MAX_LENGTH_MAX)
  if (value.length <= limit) return value
  const splitsPair = isHighSurrogate(value.charCodeAt(limit - LAST_UNIT_OFFSET))
  return value.slice(0, splitsPair ? limit - LAST_UNIT_OFFSET : limit)
}

function textOf(item: TextItem, value: FieldValue): string {
  return typeof value === typeof EMPTY_TEXT ? boundedText(item, value as string) : EMPTY_TEXT
}

function isBlank(text: string): boolean {
  return text.trim().length === EMPTY_TEXT.length
}

function errorOf(rule: Rule, format: TextFormat | null): FieldError {
  return { rule: rule.kind, format, message: rule.message ?? null }
}

function violation(rule: Rule, text: string): FieldError | null {
  switch (rule.kind) {
    case RuleKind.Required:
      return isBlank(text) ? errorOf(rule, null) : null
    case RuleKind.MinLength:
      return text.length < rule.min ? errorOf(rule, null) : null
    case RuleKind.Format:
      return matchesFormat(rule.format, text) ? null : errorOf(rule, rule.format)
  }
}

export function validateField(item: Item, value: FieldValue): FieldError | null {
  if (!isTextItem(item)) return null
  const rules = item.rules ?? NO_RULES
  const text = textOf(item, value)
  if (isBlank(text)) {
    const required = rules.find((rule) => rule.kind === RuleKind.Required)
    return required === undefined ? null : errorOf(required, null)
  }
  for (const rule of rules) {
    const error = violation(rule, text)
    if (error !== null) return error
  }
  return null
}

export function sentValue(item: Item, value: FieldValue): FieldValue {
  if (!isTextItem(item)) return value
  const text = textOf(item, value)
  if (isBlank(text)) return EMPTY_TEXT
  return (item.rules ?? NO_RULES).reduce(
    (current, rule) => (rule.kind === RuleKind.Format && matchesFormat(rule.format, current) ? normalizeFormatted(rule.format, current) : current),
    text,
  )
}
