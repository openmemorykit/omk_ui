import { ContractVersion } from '@openmemorykit/ui/contract'
import { Modality } from '../../../protocol/intents'
import {
  ClientSnapshotField,
  FormField,
  KeyboardField,
  LastIntentField,
  PageSnapshotField,
  ResolutionField,
  SnapshotPanelField,
} from '../../../shared/report/snapshot-fields'
import type { ServerContext } from '../server-context'
import { UNKNOWN_VALUE, type LogKey } from '../server-log'
import type { SnapshotPayload } from '../snapshot-requests'
import { asSection, flagOf, listOf, numberOf, sectionOf, textOf, textsOf, type Section } from './snapshot-reading'

const MODALITY_KEYS = new Map<string, LogKey>([
  [Modality.KeyboardMouse, 'log.modality.keyboardMouse'],
  [Modality.Gamepad, 'log.modality.gamepad'],
])
const PANEL_SEPARATOR = ' → '
const SECTION_SEPARATOR = ' · '
const LIST_SEPARATOR = ', '
const SCALE_DIGITS = 2
const AGO_DIGITS = 1
const MILLISECONDS_PER_SECOND = 1000

interface Reading {
  readonly context: ServerContext
  readonly client: Section
  readonly page: Section
}

const shown = (value: string | number | null): string | number => value ?? UNKNOWN_VALUE

function yesOrNo({ context }: Reading, flag: boolean | null): string {
  if (flag === null) return UNKNOWN_VALUE
  return context.log.translate(flag ? 'log.word.yes' : 'log.word.no')
}

function decimal({ context }: Reading, value: number | null, digits: number): string {
  if (value === null) return UNKNOWN_VALUE
  return value.toFixed(digits).replace('.', context.log.translate('log.format.decimalSeparator'))
}

function listOrNone({ context }: Reading, values: readonly string[]): string {
  return values.length === 0 ? context.log.translate('log.word.none') : values.join(LIST_SEPARATOR)
}

function modalityName({ context }: Reading, modality: string | null): string {
  if (modality === null) return UNKNOWN_VALUE
  const key = MODALITY_KEYS.get(modality)
  return key === undefined ? modality : context.log.translate(key)
}

function headerLine(reading: Reading, player: number): string {
  const resolution = sectionOf(reading.client, ClientSnapshotField.Resolution)
  return reading.context.log.translate('log.debug.header', {
    player,
    kitVersion: reading.context.kitVersion,
    contractVersion: ContractVersion.V1,
    locale: shown(textOf(reading.client, ClientSnapshotField.Locale)),
    width: shown(numberOf(resolution, ResolutionField.Width)),
    height: shown(numberOf(resolution, ResolutionField.Height)),
    scale: decimal(reading, numberOf(reading.client, ClientSnapshotField.Scale), SCALE_DIGITS),
  })
}

function stateLine(reading: Reading): string {
  const { client } = reading
  return reading.context.log.translate('log.debug.state', {
    mode: shown(textOf(client, ClientSnapshotField.Mode)),
    paused: yesOrNo(reading, flagOf(client, ClientSnapshotField.Paused)),
    modality: modalityName(reading, textOf(client, ClientSnapshotField.Modality)),
    focus: yesOrNo(reading, flagOf(client, ClientSnapshotField.Focus)),
    cursor: yesOrNo(reading, flagOf(client, ClientSnapshotField.Cursor)),
    keepInput: yesOrNo(reading, flagOf(client, ClientSnapshotField.KeepInput)),
  })
}

function panelText(entry: unknown): string {
  const panel = asSection(entry)
  const focus = textOf(panel, SnapshotPanelField.Focus)
  const id = String(shown(textOf(panel, SnapshotPanelField.Id)))
  return focus === null ? id : `${id} [focus ${focus}]`
}

function keyboardText(reading: Reading): string[] {
  const keyboard = sectionOf(reading.page, PageSnapshotField.Keyboard)
  if (keyboard === null) return []
  return [
    reading.context.log.translate('log.debug.keyboardPanel', {
      name: shown(textOf(keyboard, KeyboardField.Name)),
      layer: shown(textOf(keyboard, KeyboardField.Layer)),
      length: shown(numberOf(keyboard, KeyboardField.Length)),
      max: shown(numberOf(keyboard, KeyboardField.Max)),
    }),
  ]
}

function stackLine(reading: Reading): string {
  const panels = (listOf(reading.page, PageSnapshotField.Panels) ?? []).map(panelText)
  const stack = [panels.length === 0 ? reading.context.log.translate('log.word.none') : panels.join(PANEL_SEPARATOR), ...keyboardText(reading)]
  return reading.context.log.translate('log.debug.stack', {
    depth: panels.length,
    commandSeq: shown(numberOf(reading.page, PageSnapshotField.AppliedCommandSeq)),
    panels: stack.join(SECTION_SEPARATOR),
  })
}

function formLines(reading: Reading): string[] {
  const form = sectionOf(reading.page, PageSnapshotField.Form)
  if (form === null) return []
  return [
    reading.context.log.translate('log.debug.form', {
      panel: shown(textOf(form, FormField.Panel)),
      state: shown(textOf(form, FormField.State)),
      submission: shown(numberOf(form, FormField.Submission)),
      errors: shown(numberOf(form, FormField.Errors)),
    }),
  ]
}

function radialLine(reading: Reading): string {
  const entries = textsOf(reading.client, ClientSnapshotField.RadialEntries) ?? []
  return reading.context.log.translate('log.debug.radial', {
    count: entries.length,
    entries: entries.join(LIST_SEPARATOR),
    position: shown(numberOf(reading.client, ClientSnapshotField.RadialPosition)),
  })
}

function promptLine(reading: Reading): string {
  const { client, context } = reading
  return context.log.translate('log.debug.prompt', {
    prompt: textOf(client, ClientSnapshotField.Prompt) ?? context.log.translate('log.word.none'),
    visible: shown(numberOf(client, ClientSnapshotField.NotificationsVisible)),
    queued: shown(numberOf(client, ClientSnapshotField.NotificationsQueued)),
  })
}

function bindingsLine(reading: Reading): string {
  const { client, context } = reading
  return context.log.translate('log.debug.bindings', {
    radialKey: shown(textOf(client, ClientSnapshotField.RadialKey)),
    interactKey: shown(textOf(client, ClientSnapshotField.InteractKey)),
    glyphSet: shown(textOf(client, ClientSnapshotField.GlyphSet)),
  })
}

function intentsLine(reading: Reading): string {
  const { client, context } = reading
  const held = listOrNone(reading, textsOf(client, ClientSnapshotField.HeldIntents) ?? [])
  const ack = shown(numberOf(client, ClientSnapshotField.AckSeq))
  const last = sectionOf(client, ClientSnapshotField.LastIntent)
  if (last === null) return context.log.translate('log.debug.intentsNone', { held, ack })
  const agoMs = numberOf(last, LastIntentField.AgoMs)
  return context.log.translate('log.debug.intents', {
    held,
    ack,
    intent: `${shown(textOf(last, LastIntentField.Intent))}/${shown(textOf(last, LastIntentField.Source))}`,
    seq: shown(numberOf(last, LastIntentField.Seq)),
    ago: decimal(reading, agoMs === null ? null : agoMs / MILLISECONDS_PER_SECOND, AGO_DIGITS),
  })
}

export function debugLines(context: ServerContext, player: number, snapshot: SnapshotPayload): readonly string[] {
  const reading: Reading = { context, client: asSection(snapshot.client), page: asSection(snapshot.page) }
  const pageLines = reading.page === null ? [context.log.translate('log.debug.pageMissing')] : [stackLine(reading), ...formLines(reading)]
  return [
    headerLine(reading, player),
    stateLine(reading),
    ...pageLines,
    radialLine(reading),
    promptLine(reading),
    bindingsLine(reading),
    intentsLine(reading),
  ]
}
