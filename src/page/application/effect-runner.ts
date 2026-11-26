import { FromPage } from '../../protocol/from-page'
import { ReportKind } from '../../shared/report/report-kind'
import { PageCommandType } from '../domain/page-commands'
import { UiEffectType, type UiEffect } from '../domain/ui-effects'
import { announcementKey, announcementUrgency } from './announcements'
import type { Dispatch, UiPorts } from './ports'

export type EffectRunner = (effects: readonly UiEffect[], receivedAt: number) => void

function runEffect(ports: UiPorts, dispatch: Dispatch, effect: UiEffect, receivedAt: number): void {
  switch (effect.type) {
    case UiEffectType.SendToHost:
      ports.host.send(effect.message)
      return
    case UiEffectType.Schedule: {
      const { timer } = effect
      ports.scheduler.schedule(timer, effect.delayMs, () => dispatch({ type: PageCommandType.TimerFired, timer }))
      return
    }
    case UiEffectType.CancelSchedule:
      ports.scheduler.cancel(effect.timer)
      return
    case UiEffectType.Announce:
      ports.announcer.announce(ports.translator.translate(announcementKey(effect.announcement), effect.params), announcementUrgency(effect.announcement))
      return
    case UiEffectType.FocusTextInput:
      ports.textFocus.focus(effect.itemId)
      return
    case UiEffectType.MeasurePaint: {
      const { panelId } = effect
      ports.paint.afterPaint((paintedAt) =>
        ports.host.send({ type: FromPage.Trace, kind: ReportKind.PanelPainted, data: { panelId, durationMs: paintedAt - receivedAt } }),
      )
      return
    }
  }
}

export function createEffectRunner(ports: UiPorts, dispatch: Dispatch): EffectRunner {
  return (effects, receivedAt) => {
    for (const effect of effects) {
      try {
        runEffect(ports, dispatch, effect, receivedAt)
      } catch {
        continue
      }
    }
  }
}
