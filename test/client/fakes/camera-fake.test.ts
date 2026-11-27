import { describe, expect, it } from 'vitest'
import { CameraViewMode } from '../../../src/shared/config/camera-view-mode'
import { createCameraFake, ON_FOOT_CONTEXT } from './camera-fake'

const IN_VEHICLE_CONTEXT = 1

describe('CameraPort fake', () => {
  it('starts on foot, in the near third-person view', () => {
    const camera = createCameraFake()
    expect(camera.context()).toBe(ON_FOOT_CONTEXT)
    expect(camera.read(ON_FOOT_CONTEXT)).toBe(CameraViewMode.ThirdPersonNear)
  })

  it('keeps one view per context and records each write', () => {
    const camera = createCameraFake()
    camera.setContext(IN_VEHICLE_CONTEXT)
    camera.setMode(ON_FOOT_CONTEXT, CameraViewMode.ThirdPersonFar)
    camera.write(IN_VEHICLE_CONTEXT, CameraViewMode.FirstPerson)
    expect(camera.context()).toBe(IN_VEHICLE_CONTEXT)
    expect(camera.read(IN_VEHICLE_CONTEXT)).toBe(CameraViewMode.FirstPerson)
    expect(camera.read(ON_FOOT_CONTEXT)).toBe(CameraViewMode.ThirdPersonFar)
    expect(camera.writes).toStrictEqual([{ context: IN_VEHICLE_CONTEXT, mode: CameraViewMode.FirstPerson }])
    expect(camera.calls.map((call) => call.args)).toStrictEqual([[IN_VEHICLE_CONTEXT, CameraViewMode.FirstPerson], [], [IN_VEHICLE_CONTEXT], [ON_FOOT_CONTEXT]])
  })
})
