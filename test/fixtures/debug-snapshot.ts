import { ClientSnapshotField, FormField, KeyboardField, LastIntentField, PageSnapshotField, ResolutionField, SnapshotPanelField } from '../../src/shared/report/snapshot-fields'
import { deepFrozen } from './frozen'

export const SECTION_7_4_CLIENT = deepFrozen({
  [ClientSnapshotField.Locale]: 'fr',
  [ClientSnapshotField.Resolution]: { [ResolutionField.Width]: 1920, [ResolutionField.Height]: 1080 },
  [ClientSnapshotField.Scale]: 1,
  [ClientSnapshotField.Mode]: 'panels',
  [ClientSnapshotField.Paused]: false,
  [ClientSnapshotField.Modality]: 'gamepad',
  [ClientSnapshotField.Focus]: true,
  [ClientSnapshotField.Cursor]: false,
  [ClientSnapshotField.KeepInput]: false,
  [ClientSnapshotField.RadialEntries]: ['garage/main', 'whitelist/main'],
  [ClientSnapshotField.RadialPosition]: 0,
  [ClientSnapshotField.Prompt]: null,
  [ClientSnapshotField.NotificationsVisible]: 1,
  [ClientSnapshotField.NotificationsQueued]: 0,
  [ClientSnapshotField.RadialKey]: 'b_170 (F1)',
  [ClientSnapshotField.InteractKey]: 't_E',
  [ClientSnapshotField.GlyphSet]: 'xbox',
  [ClientSnapshotField.HeldIntents]: [],
  [ClientSnapshotField.LastIntent]: { [LastIntentField.Intent]: 'down', [LastIntentField.Source]: 'pad', [LastIntentField.Seq]: 212, [LastIntentField.AgoMs]: 1200 },
  [ClientSnapshotField.AckSeq]: 212,
})

export const SECTION_7_4_PAGE = deepFrozen({
  [PageSnapshotField.AppliedCommandSeq]: 14,
  [PageSnapshotField.Panels]: [
    { [SnapshotPanelField.Id]: 'whitelist/list', [SnapshotPanelField.Focus]: 'enabled' },
    { [SnapshotPanelField.Id]: 'whitelist/add', [SnapshotPanelField.Focus]: 'identifier' },
  ],
  [PageSnapshotField.Keyboard]: { [KeyboardField.Name]: 'keyboard', [KeyboardField.Layer]: 'abc', [KeyboardField.Length]: 12, [KeyboardField.Max]: 64 },
  [PageSnapshotField.Form]: { [FormField.Panel]: 'whitelist/add', [FormField.State]: 'editing', [FormField.Submission]: 3, [FormField.Errors]: 0 },
})

export const SECTION_7_4_LINES: readonly string[] = Object.freeze([
  '[omk_ui] joueur 2 · kit 1.0.0 · contrat 1 · fr · 1920×1080 · échelle 1,00',
  'mode panels · pause non · modalité manette · focus NUI oui · curseur non · keepInput non',
  'pile (2, commande 14 appliquée) : whitelist/list [focus enabled] → whitelist/add [focus identifier] · sous-panneau keyboard (abc, 12/64)',
  'formulaire whitelist/add : editing · soumission 3 · erreurs 0',
  'radial : 2 entrées (garage/main, whitelist/main) · dernière position 0',
  'invite : aucune · notifications : 1 visible, 0 en attente',
  'touches liées : radial b_170 (F1) + View · interaction t_E + croix droite · glyphes xbox',
  'intentions maintenues : aucune · dernière intention down/pad #212 il y a 1,2 s · accusé #212',
])
