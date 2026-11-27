const EXPECTED_RESOURCE_NAME = 'omk_ui'

function start(): void {
  const resourceName = GetCurrentResourceName()
  if (resourceName !== EXPECTED_RESOURCE_NAME) {
    console.error(`${EXPECTED_RESOURCE_NAME} refuses to start: its folder must be named ${EXPECTED_RESOURCE_NAME}, found ${resourceName}`)
  }
}

start()
