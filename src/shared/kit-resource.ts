export const KIT_RESOURCE_NAME = 'omk_ui'

export function startRefusalLine(foundName: string): string {
  return `${KIT_RESOURCE_NAME} refuses to start: its folder must be named ${KIT_RESOURCE_NAME}, found ${foundName}`
}
