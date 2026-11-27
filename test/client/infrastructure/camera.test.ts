import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FailureHandler } from '../../../src/shared/guarded-call'
import { createCameraPort } from '../../../src/client/infrastructure/camera'
import { CameraViewMode } from '../../../src/shared/config/camera-view-mode'

const VEHICLE_CONTEXT = 1
const UNKNOWN_MODE = 9

let natives: NativeRecorder

afterEach(() => natives.restore())

describe('camera port', () => {
  it('reads the active view mode context', () => {
    natives = installNatives({ GetCamActiveViewModeContext: () => VEHICLE_CONTEXT })
    expect(createCameraPort(vi.fn()).context()).toBe(VEHICLE_CONTEXT)
  })

  it('reads and writes the view mode of the given context', () => {
    natives = installNatives({ GetCamViewModeForContext: () => CameraViewMode.FirstPerson, SetCamViewModeForContext: () => undefined })
    const camera = createCameraPort(vi.fn())
    expect(camera.read(VEHICLE_CONTEXT)).toBe(CameraViewMode.FirstPerson)
    camera.write(VEHICLE_CONTEXT, CameraViewMode.ThirdPersonFar)
    expect(natives.callsOf('GetCamViewModeForContext')).toEqual([[VEHICLE_CONTEXT]])
    expect(natives.callsOf('SetCamViewModeForContext')).toEqual([[VEHICLE_CONTEXT, CameraViewMode.ThirdPersonFar]])
  })

  it('maps a view mode the kit does not know to the nearest third person view', () => {
    natives = installNatives({ GetCamViewModeForContext: () => UNKNOWN_MODE })
    expect(createCameraPort(vi.fn()).read(0)).toBe(CameraViewMode.ThirdPersonNear)
  })

  it('keeps native failures out of the caller and reports each one', () => {
    const failure = new Error('native failed')
    const throwing = (): never => { throw failure }
    natives = installNatives({ GetCamActiveViewModeContext: throwing, GetCamViewModeForContext: throwing, SetCamViewModeForContext: throwing })
    const onFailure = vi.fn<FailureHandler>()
    const camera = createCameraPort(onFailure)
    expect(camera.context()).toBe(0)
    expect(camera.read(0)).toBe(CameraViewMode.ThirdPersonNear)
    expect(() => camera.write(0, CameraViewMode.ThirdPersonMedium)).not.toThrow()
    expect(onFailure.mock.calls.map(([source]) => source)).toEqual(['camera.context', 'camera.read', 'camera.write'])
  })
})
