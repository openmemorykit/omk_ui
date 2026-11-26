export interface Failure { readonly check: string; readonly message: string }
export interface Box { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export interface SurveyText {
  readonly text: string
  readonly fontSize: number
  readonly role: string
  readonly color: string
  readonly backgrounds: readonly string[]
}
export interface SurveySurface {
  readonly surface: string
  readonly backgroundColor: string
  readonly opacityProduct: number
  readonly backdropFilter: string
  readonly filter: string
  readonly backgroundImage: string
}
export interface SurveyAnimation { readonly selector: string; readonly durationsMs: readonly number[]; readonly exempt: boolean }
export interface Survey {
  readonly viewport: { readonly width: number; readonly height: number }
  readonly scrollWidth: number
  readonly texts: readonly SurveyText[]
  readonly surfaces: readonly SurveySurface[]
  readonly radial: Box | null
  readonly column: { readonly dimmed: boolean; readonly opacityProduct: number; readonly veilColor: string } | null
  readonly animations: readonly SurveyAnimation[]
  readonly essentialAnimated: number
}
export interface ConsoleMessage { readonly type: string; readonly text: string }
export interface RGBA { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number }

export function parseColor(value: string): RGBA | null
export function contrastRatio(foreground: string, background: string): number
export function checkTextSize(survey: Survey): Failure[]
export function checkHorizontalOverflow(survey: Survey): Failure[]
export function checkRadialFits(survey: Survey): Failure[]
export function checkSurfaces(survey: Survey): Failure[]
export function checkColumnVeil(survey: Survey): Failure[]
export function checkContrast(survey: Survey, scene: string): Failure[]
export function checkDurations(survey: Survey): Failure[]
export function checkEssentialMotion(survey: Survey): Failure[]
export function checkConsole(messages: readonly ConsoleMessage[]): Failure[]
export function checkReady(ready: boolean): Failure[]
export function runChecks(input: { survey: Survey | null; scene: string; messages: readonly ConsoleMessage[]; ready: boolean; reducedMotion?: boolean }): Failure[]
