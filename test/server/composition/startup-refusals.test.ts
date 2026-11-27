import { describe, expect, it } from 'vitest'
import english from '../../../omk_ui/locales/en.json'
import french from '../../../omk_ui/locales/fr.json'
import { startRefusalLine } from '../../../src/shared/kit-resource'

const FOUND_NAME = 'omk_ui_copy'
const START_FAILURE = /omk_ui refuses to start/
const ANY_ACCENT = '.{1,2}'

const REFUSALS_THE_DEPLOY_CHECK_READS: readonly (readonly [string, RegExp, RegExp])[] = [
  ['log.wrongResourceName', /The kit must run as omk_ui, not/, /Le kit doit tourner sous le nom omk_ui, pas/],
  ['log.config.warning.invalid', /Setting .* is invalid, default value kept/, new RegExp(`R${ANY_ACCENT}glage .* invalide, valeur par d${ANY_ACCENT}faut gard${ANY_ACCENT}e`)],
  ['log.config.warning.unknown', /Setting .* is unknown, ignored/, new RegExp(`R${ANY_ACCENT}glage .* inconnu, ignor${ANY_ACCENT}`)],
  ['log.config.warning.truncated', /Settings truncated after/, new RegExp(`R${ANY_ACCENT}glages tronqu${ANY_ACCENT}s apr${ANY_ACCENT}s`)],
  ['log.artifact.tooOld', /Artifact .* is below the required minimum/, new RegExp(`Artifact .* sous le minimum exig${ANY_ACCENT}`)],
  ['log.artifact.unreadable', /Artifact number unreadable in the version convar/, new RegExp(`Num${ANY_ACCENT}ro d.artifact illisible dans la convar version`)],
]

function message(messages: Readonly<Record<string, string>>, key: string): string {
  return messages[key] ?? ''
}

describe('startup refusal sentences read by the deploy check (check-logs.sh of omk-ui-build)', () => {
  it('starts the wrong folder name refusal with "omk_ui refuses to start"', () => {
    expect(startRefusalLine(FOUND_NAME)).toMatch(START_FAILURE)
    expect(startRefusalLine(FOUND_NAME)).toContain(FOUND_NAME)
  })

  it.each(REFUSALS_THE_DEPLOY_CHECK_READS)('keeps the sentence of %s in English and French', (key, englishPattern, frenchPattern) => {
    expect(message(english, key)).toMatch(englishPattern)
    expect(message(french, key)).toMatch(frenchPattern)
  })
})
