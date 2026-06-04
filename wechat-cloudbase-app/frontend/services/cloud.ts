import type { CloudResponse } from '../types/domain'
import { getMiniProgramEnvVersion } from '../config/env'

export const IMPROV_FUNCTION_NAME = 'improv-api'
const DEFAULT_TIMEOUT_MS = 8000

function createRequestId(action: string) {
  return `improv_${action.replace(/\./g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeError(error: WechatMiniprogram.GeneralCallbackResult | unknown, action: string, silent = false) {
  const message = error && typeof error === 'object' && 'errMsg' in error ? String(error.errMsg) : ''
  if (!silent) console.warn(`[improv-cloud] ${action} failed`, error)
  if (message.includes('timeout')) return '网络开小差，请稍后再试'
  if (message.includes('auth') || message.includes('permission') || message.includes('没有权限')) return '当前账号暂无操作权限'
  return '服务暂不可用，请稍后再试'
}

function callFunctionWithTimeout(options: WechatMiniprogram.Cloud.CallFunctionParam, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timer: number | null = null
  const request = wx.cloud.callFunction(options)
  request.catch(() => {})
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject({ errMsg: `cloud.callFunction timeout after ${timeoutMs}ms` })
    }, timeoutMs) as unknown as number
  })
  return Promise.race([request, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export async function callImprovAction<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options: { timeoutMs?: number; silent?: boolean } = {}
): Promise<CloudResponse<T>> {
  if (!wx.cloud || !wx.cloud.callFunction) {
    return { code: -1, message: '云开发未初始化' }
  }

  try {
    const response = await callFunctionWithTimeout({
      name: IMPROV_FUNCTION_NAME,
      data: {
        action,
        requestId: createRequestId(action),
        payload
      }
    }, options.timeoutMs)
    return response && response.result
      ? response.result as CloudResponse<T>
      : { code: -1, message: '服务返回为空' }
  } catch (error) {
    return {
      code: -1,
      message: normalizeError(error, action, options.silent)
    }
  }
}

export { getMiniProgramEnvVersion }
