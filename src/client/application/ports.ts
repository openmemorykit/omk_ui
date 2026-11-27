import type { ConvarSource } from '@openmemorykit/core/shared'
import type { Reply } from '@openmemorykit/ui/contract'
import type { ToPage, ToPageMessage, ToPageMessageOf } from '../../protocol/to-page'
import type { GlyphSet } from '../../protocol/page-vocabulary'
import type { CameraViewMode } from '../../shared/config/camera-view-mode'
import type { Clock, ConfigSource, LocaleSource } from '../../shared/ports'
import type { ReportEnvelope } from '../../shared/report/report-envelope'
import type { ControlGroup } from '../domain/focus-policy'
import type { PadReading } from '../domain/pad-snapshot'

export interface NuiPort {
  send(message: ToPageMessage): void
  sendBoot(message: ToPageMessageOf<typeof ToPage.Boot>, sessionToken: string): void
  setFocus(focus: boolean, cursor: boolean): void
  setKeepInput(keep: boolean): void
  isKeepingInput(): boolean
}

export interface ControlsPort {
  readPad(): PadReading
  isUsingKeyboard(): boolean
  isJustPressed(control: number): boolean
  isDisabledPressed(control: number): boolean
  disableAll(): void
  disable(group: ControlGroup, control: number): void
  enable(group: ControlGroup, control: number): void
  suppressPauseMenu(): void
  bindingLabel(command: string): string
  pushToTalkLabel(): string
}

export interface CameraPort {
  context(): number
  read(context: number): CameraViewMode
  write(context: number, mode: CameraViewMode): void
}

export interface ScreenSize {
  readonly width: number
  readonly height: number
}

export interface GameStatePort {
  isPauseMenuActive(): boolean
  isScreenFaded(): boolean
  isNuiFocused(): boolean
  drivenVehicleSpeed(): number | null
  gameBuild(): number
  resolution(): ScreenSize
}

export interface OwnerReplyPort { deliver(owner: string, reply: Reply): boolean }

export interface LoopPort {
  start(): void
  stop(): void
  isRunning(): boolean
}

export interface GlyphStore {
  read(): GlyphSet | null
  write(set: GlyphSet): void
}

export interface ConsolePort { print(line: string): void }

export interface ServerChannel { report(envelope: ReportEnvelope): void }

export interface LocalEvents { emitReady(): void }

export interface RandomSource { next(): number }

export interface ClientPorts {
  readonly nui: NuiPort
  readonly controls: ControlsPort
  readonly camera: CameraPort
  readonly game: GameStatePort
  readonly replies: OwnerReplyPort
  readonly pump: LoopPort
  readonly idle: LoopPort
  readonly glyphs: GlyphStore
  readonly config: ConfigSource
  readonly locales: LocaleSource
  readonly convars: ConvarSource
  readonly console: ConsolePort
  readonly server: ServerChannel
  readonly events: LocalEvents
  readonly clock: Clock
  readonly random: RandomSource
}
