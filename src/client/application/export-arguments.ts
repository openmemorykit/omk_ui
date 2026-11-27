import { ContractErrorCode, ERROR_PATH_MAX_LENGTH, type CallResult, type ContractError } from '@openmemorykit/ui/contract'
import { validateContract, ValidationStatus } from '@openmemorykit/ui/validation'
import type * as v from 'valibot'
import { refuseCall, traceUnknownFields, type ContractCall } from './call-refusals'
import type { UseCaseContext } from './use-case-context'

export interface ExportParameter<Schema extends v.GenericSchema = v.GenericSchema> {
  readonly name: string
  readonly schema: Schema
}

export type ArgumentValues<Parameters extends readonly ExportParameter[]> = { readonly [Index in keyof Parameters]: v.InferOutput<Parameters[Index]['schema']> }

export type ExportHandler = (context: UseCaseContext, call: ContractCall, args: readonly unknown[]) => CallResult

interface ArgumentReading {
  readonly value: unknown
  readonly errors: readonly ContractError[]
  readonly unknownFields: readonly string[]
}

const ROOT_PATH = ''
const PATH_SEPARATOR = '.'
const SINGLE_PARAMETER = 1

function prefixed(prefix: string, path: string): string {
  if (prefix === ROOT_PATH) return path
  return (path === ROOT_PATH ? prefix : `${prefix}${PATH_SEPARATOR}${path}`).slice(0, ERROR_PATH_MAX_LENGTH)
}

function readArgument(parameter: ExportParameter, value: unknown, prefix: string): ArgumentReading {
  if (value === undefined || value === null) return { value, errors: [{ path: prefixed(prefix, ROOT_PATH), code: ContractErrorCode.Missing }], unknownFields: [] }
  const checked = validateContract(parameter.schema, value)
  if (checked.status === ValidationStatus.Refused) return { value, errors: checked.errors.map((error) => ({ ...error, path: prefixed(prefix, error.path) })), unknownFields: [] }
  return { value: checked.value, errors: [], unknownFields: checked.unknownFields.map((path) => prefixed(prefix, path)) }
}

export function withArguments<const Parameters extends readonly ExportParameter[]>(
  parameters: Parameters,
  apply: (context: UseCaseContext, call: ContractCall, values: ArgumentValues<Parameters>) => CallResult,
): ExportHandler {
  return (context, call, args) => {
    const prefixOf = (parameter: ExportParameter): string => (parameters.length > SINGLE_PARAMETER ? parameter.name : ROOT_PATH)
    const readings = parameters.map((parameter, index) => readArgument(parameter, args[index], prefixOf(parameter)))
    const errors = readings.flatMap((reading) => reading.errors)
    if (errors.length > 0) return refuseCall(context, call, errors)
    traceUnknownFields(context, call, readings.flatMap((reading) => reading.unknownFields))
    return apply(context, call, readings.map((reading) => reading.value) as unknown as ArgumentValues<Parameters>)
  }
}
