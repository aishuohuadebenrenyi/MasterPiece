const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')
const {
  isSessionRevoked,
  isOwnedExternalMedia,
  mediaSignaturePayload
} = require('./ios-release-policy')
const {
  MATERIAL_TYPES,
  MATERIAL_ABILITIES,
  MATERIAL_SCENES,
  MATERIAL_STATUSES,
  matchesMaterialFilters,
  buildMaterialFacets,
  buildMaterialTypeCounts
} = require('./material-policy')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 数据库集合名称
const COLLECTIONS = {
  materials: 'improv_materials',
  userMaterialStates: 'improv_user_material_states',
  profiles: 'improv_profiles',
  inspirations: 'improv_inspirations',
  rehearsals: 'improv_rehearsals',
  practiceRecords: 'improv_practice_records',
  methodCards: 'improv_method_cards',
  feedback: 'improv_feedback',
  iosSessionRevocations: 'improv_ios_session_revocations'
}

// 分页常量
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const MAX_MATERIAL_SCAN = 500
const TODAY_LIMIT = 20
const RECOMMEND_POOL_SIZE = 5
const CONTENT_SECURITY_SCENE = 2
const TEXT_SECURITY_MAX_CHUNK = 1800
const IMAGE_CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
}
let requestClientContext = null

const IOS_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys'
let appleKeysCache = { fetchedAt: 0, keys: [] }

// 各集合允许写入的字段白名单
const FIELD_WHITELISTS = {
  [COLLECTIONS.inspirations]: ['id', 'title', 'desc', 'meta', 'linkedMaterialId', 'linkedMaterialTitle', 'linkedRehearsalId', 'linkedRehearsalTitle', 'sourceType', 'sourceId', 'sourceTitle', 'attachments'],
  [COLLECTIONS.methodCards]: ['id', 'type', 'title', 'desc', 'meta', 'sourceType', 'sourceId', 'sourceTitle'],
  [COLLECTIONS.rehearsals]: ['id', 'title', 'desc', 'teamName', 'duration', 'goals', 'source', 'status', 'plan', 'reviewKeep', 'reviewTry', 'reviewReminder', 'meta'],
  [COLLECTIONS.practiceRecords]: ['id', 'materialId', 'materialTitle', 'rehearsalId', 'rehearsalTitle', 'title', 'desc', 'score', 'note', 'attachments', 'comparisonNotes', 'reminder', 'duration', 'meta'],
  [COLLECTIONS.profiles]: ['id', 'displayName', 'avatarUrl', 'troupeName']
}

// 各集合允许更新的字段白名单
const UPDATE_WHITELISTS = {
  [COLLECTIONS.inspirations]: ['title', 'desc', 'meta', 'linkedMaterialId', 'linkedMaterialTitle', 'linkedRehearsalId', 'linkedRehearsalTitle', 'sourceType', 'sourceId', 'sourceTitle', 'attachments'],
  [COLLECTIONS.methodCards]: ['type', 'title', 'desc', 'meta', 'sourceType', 'sourceId', 'sourceTitle'],
  [COLLECTIONS.rehearsals]: ['title', 'desc', 'teamName', 'duration', 'goals', 'source', 'status', 'plan', 'reviewKeep', 'reviewTry', 'reviewReminder', 'meta'],
  [COLLECTIONS.practiceRecords]: ['materialId', 'materialTitle', 'rehearsalId', 'rehearsalTitle', 'title', 'desc', 'score', 'note', 'attachments', 'comparisonNotes', 'reminder', 'duration', 'meta']
}

function ok(data = {}, requestId = '') {
  return { code: 0, message: 'ok', data, requestId }
}

function fail(message, requestId = '', code = -1) {
  return { code, message, data: null, requestId }
}

function now() {
  return db.serverDate()
}

function getOpenId() {
  if (requestClientContext && requestClientContext.platform === 'ios' && requestClientContext.userId) {
    return `ios:${requestClientContext.userId}`
  }
  return cloud.getWXContext().OPENID
}

function ownerWhere(extra = {}) {
  return Object.assign({
    ownerOpenId: getOpenId(),
    deletedAt: null
  }, extra)
}

function normalizeSecurityError(error) {
  const errCode = Number(error && (error.errCode || error.errcode || error.code))
  if (errCode === 87014) return '内容含有不适合公开展示的信息，请修改后再保存'
  return '内容安全检查暂不可用，请稍后再试'
}

function isRiskySecurityResult(result) {
  if (!result) return false
  const errCode = Number(result.errCode || result.errcode)
  if (errCode === 87014) return true
  const suggest = result.result && result.result.suggest
  return suggest === 'risky'
}

async function validateClientContext(client, requestId) {
  requestClientContext = null
  if (!client || client.platform !== 'ios') return null
  const userId = typeof client.userId === 'string' ? client.userId.trim() : ''
  if (!userId || userId.length > 96 || !/^[a-zA-Z0-9:_-]+$/.test(userId)) {
    return fail('iOS 用户身份无效', requestId, 401)
  }
  const sessionToken = typeof client.sessionToken === 'string' ? client.sessionToken.trim() : ''
  const sessionPayload = sessionToken && verifyIOSSessionToken(sessionToken, userId)
  if (sessionPayload) {
    try {
      const revoked = await db.collection(COLLECTIONS.iosSessionRevocations)
        .where({ ownerOpenId: `ios:${userId}`, sessionId: _.in([sessionPayload.jti, '*']) })
        .limit(2)
        .get()
      const isRevoked = isSessionRevoked(revoked.data, sessionPayload)
      if (!isRevoked) {
        requestClientContext = { platform: 'ios', userId, sessionId: sessionPayload.jti, issuedAt: sessionPayload.iat }
        return null
      }
      return fail('登录已失效，请重新登录', requestId, 401)
    } catch (error) {
      console.warn('[improv-api] iOS session revocation check failed', error)
      return fail('登录校验暂不可用，请稍后重试', requestId, 503)
    }
  }
  const expectedSecret = process.env.IMPROV_IOS_API_SECRET || ''
  const allowDebugSecret = process.env.IMPROV_IOS_ALLOW_API_SECRET === 'true'
  if (!allowDebugSecret || !expectedSecret || client.apiSecret !== expectedSecret) {
    return fail('iOS API 未授权', requestId, 401)
  }
    requestClientContext = { platform: 'ios', userId }
  return null
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlJSON(value) {
  return base64UrlEncode(JSON.stringify(value))
}

function getIOSSessionSecret() {
  return process.env.IMPROV_IOS_SESSION_SECRET || process.env.IMPROV_IOS_API_SECRET || ''
}

function signIOSSessionPayload(payloadText) {
  const secret = getIOSSessionSecret()
  if (!secret) return ''
  return crypto.createHmac('sha256', secret).update(payloadText).digest('base64url')
}

function createIOSSessionToken(userId) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + IOS_SESSION_TTL_SECONDS
  const payload = base64UrlJSON({ userId, jti: crypto.randomUUID(), iat: issuedAt, exp: expiresAt })
  const signature = signIOSSessionPayload(payload)
  if (!signature) return null
  return { token: `${payload}.${signature}`, expiresAt }
}

function verifyIOSSessionToken(token, expectedUserId) {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payloadText, signature] = parts
  const expectedSignature = signIOSSessionPayload(payloadText)
  if (!expectedSignature) return false
  try {
    const expectedBuffer = Buffer.from(expectedSignature)
    const actualBuffer = Buffer.from(signature)
    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) return false
    const payload = JSON.parse(Buffer.from(payloadText, 'base64url').toString('utf8'))
    const nowSeconds = Math.floor(Date.now() / 1000)
    return payload.userId === expectedUserId && typeof payload.jti === 'string' && payload.jti.length > 0 && Number(payload.exp) > nowSeconds
      ? payload
      : null
  } catch (_error) {
    return null
  }
}

function parseJWTPart(token, index) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[index], 'base64url').toString('utf8'))
  } catch (_error) {
    return null
  }
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        body += chunk
      })
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

async function getApplePublicKeys() {
  const nowMs = Date.now()
  if (appleKeysCache.keys.length && nowMs - appleKeysCache.fetchedAt < 60 * 60 * 1000) {
    return appleKeysCache.keys
  }
  const body = await fetchJSON(APPLE_KEYS_URL)
  appleKeysCache = {
    fetchedAt: nowMs,
    keys: Array.isArray(body.keys) ? body.keys : []
  }
  return appleKeysCache.keys
}

async function verifyAppleIdentityToken(identityToken, appleUserId) {
  const header = parseJWTPart(identityToken, 0)
  const payload = parseJWTPart(identityToken, 1)
  if (!header || !payload || payload.sub !== appleUserId) return null
  if (header.alg !== 'RS256') return null
  const expectedBundleId = process.env.IMPROV_IOS_BUNDLE_ID || ''
  if (expectedBundleId && payload.aud !== expectedBundleId) return null
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Number(payload.exp) <= nowSeconds) return null
  if (payload.iss !== 'https://appleid.apple.com') return null

  const keys = await getApplePublicKeys()
  const jwk = keys.find(key => key.kid === header.kid && key.alg === 'RS256')
  if (!jwk) return null
  const [encodedHeader, encodedPayload, encodedSignature] = identityToken.split('.')
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(`${encodedHeader}.${encodedPayload}`)
  verifier.end()
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' })
  const signature = Buffer.from(encodedSignature, 'base64url')
  return verifier.verify(publicKey, signature) ? payload : null
}

async function authApple(payload, requestId) {
  const invalid = validateFields(payload, ['appleUserId', 'identityToken', 'fullName'], requestId)
  if (invalid) return invalid
  const appleUserId = typeof payload.appleUserId === 'string' ? payload.appleUserId.trim() : ''
  const identityToken = typeof payload.identityToken === 'string' ? payload.identityToken.trim() : ''
  if (!appleUserId || appleUserId.length > 96 || !/^[a-zA-Z0-9._:-]+$/.test(appleUserId)) {
    return fail('Apple 用户身份无效', requestId, 400)
  }
  let applePayload = null
  try {
    applePayload = await verifyAppleIdentityToken(identityToken, appleUserId)
  } catch (error) {
    console.warn('[improv-api] Apple identity token verification failed', error)
    return fail('Apple 登录凭证校验暂不可用，请稍后再试', requestId, 503)
  }
  if (!applePayload) {
    return fail('Apple 登录凭证无效', requestId, 401)
  }
  const session = createIOSSessionToken(appleUserId)
  if (!session) return fail('iOS 会话密钥未配置', requestId, 500)
  return ok({
    userId: appleUserId,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    ownerNamespace: `ios:${appleUserId}`
  }, requestId)
}

function collectTextValues(value, items = []) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) items.push(trimmed)
    return items
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectTextValues(item, items))
    return items
  }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach(key => collectTextValues(value[key], items))
  }
  return items
}

function chunkTextValues(values) {
  const chunks = []
  let current = ''
  const uniqueValues = Array.from(new Set(values.filter(Boolean)))
  for (const value of uniqueValues) {
    if (value.length > TEXT_SECURITY_MAX_CHUNK) {
      if (current) {
        chunks.push(current)
        current = ''
      }
      for (let index = 0; index < value.length; index += TEXT_SECURITY_MAX_CHUNK) {
        chunks.push(value.slice(index, index + TEXT_SECURITY_MAX_CHUNK))
      }
      continue
    }
    const next = current ? `${current}\n${value}` : value
    if (next.length > TEXT_SECURITY_MAX_CHUNK) {
      chunks.push(current)
      current = value
    } else {
      current = next
    }
  }
  if (current) chunks.push(current)
  return chunks
}

async function checkTextSecurity(values, requestId) {
  const chunks = chunkTextValues(collectTextValues(values))
  if (!chunks.length) return null
  if (!cloud.openapi || !cloud.openapi.security || !cloud.openapi.security.msgSecCheck) {
    return fail('内容安全检查暂不可用，请稍后再试', requestId, 503)
  }
  const openid = getOpenId()
  try {
    for (const content of chunks) {
      const result = await cloud.openapi.security.msgSecCheck({
        content,
        version: 2,
        scene: CONTENT_SECURITY_SCENE,
        openid
      })
      if (isRiskySecurityResult(result)) {
        return fail('内容含有不适合公开展示的信息，请修改后再保存', requestId, 400)
      }
    }
  } catch (error) {
    console.warn('[improv-api] text security check failed', error)
    return fail(normalizeSecurityError(error), requestId, Number(error && (error.errCode || error.errcode)) === 87014 ? 400 : 503)
  }
  return null
}

function inferImageContentType(fileID) {
  const matched = String(fileID || '').toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)
  const ext = matched ? matched[1] : ''
  return IMAGE_CONTENT_TYPES[ext] || 'image/jpeg'
}

async function checkImageSecurity(fileID, requestId) {
  if (!fileID || typeof fileID !== 'string' || !fileID.startsWith('cloud://')) return null
  if (!cloud.openapi || !cloud.openapi.security || !cloud.openapi.security.imgSecCheck) {
    return fail('图片安全检查暂不可用，请稍后再试', requestId, 503)
  }
  try {
    const downloaded = await cloud.downloadFile({ fileID })
    const result = await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: inferImageContentType(fileID),
        value: downloaded.fileContent
      }
    })
    if (isRiskySecurityResult(result)) {
      await cloud.deleteFile({ fileList: [fileID] }).catch(error => {
        console.warn('[improv-api] delete unsafe image failed', error)
      })
      return fail('图片内容未通过安全检查，请更换后再试', requestId, 400)
    }
  } catch (error) {
    console.warn('[improv-api] image security check failed', error)
    const isRisky = Number(error && (error.errCode || error.errcode)) === 87014
    if (isRisky) {
      await cloud.deleteFile({ fileList: [fileID] }).catch(deleteError => {
        console.warn('[improv-api] delete unsafe image failed', deleteError)
      })
    }
    return fail(isRisky ? '图片内容未通过安全检查，请更换后再试' : '图片安全检查暂不可用，请稍后再试', requestId, isRisky ? 400 : 503)
  }
  return null
}

async function checkTextSecurityAction(payload, requestId) {
  const invalid = validateFields(payload, ['values', 'scene'], requestId)
  if (invalid) return invalid
  const unsafeContent = await checkTextSecurity(payload.values || [], requestId)
  if (unsafeContent) return unsafeContent
  return ok({ passed: true }, requestId)
}

async function checkMediaSecurityAction(payload, requestId) {
  const invalid = validateFields(payload, ['fileID', 'type', 'scene'], requestId)
  if (invalid) return invalid
  const type = typeof payload.type === 'string' ? payload.type : ''
  const fileID = typeof payload.fileID === 'string' ? payload.fileID.trim() : ''
  if (!fileID) return fail('缺少文件 ID', requestId, 400)
  if (type === 'image') {
    const unsafeContent = await checkImageSecurity(fileID, requestId)
    if (unsafeContent) return unsafeContent
    return ok({ passed: true }, requestId)
  }
  return ok({
    passed: true,
    manualReviewRequired: type === 'video' || type === 'audio'
  }, requestId)
}

async function prepareMediaUpload(payload, requestId) {
  const invalid = validateFields(payload, ['fileName', 'type', 'scope'], requestId)
  if (invalid) return invalid
  const type = typeof payload.type === 'string' ? payload.type : ''
  if (!['image', 'video', 'audio'].includes(type)) return fail('附件类型无效', requestId, 400)
  const fileName = typeof payload.fileName === 'string' ? payload.fileName.trim() : ''
  if (!fileName || fileName.length > 160 || /[\\/]/.test(fileName)) return fail('文件名无效', requestId, 400)
  const scope = typeof payload.scope === 'string' ? payload.scope.trim() : 'attachment'
  if (scope.length > 80 || !/^[a-zA-Z0-9._:-]+$/.test(scope)) return fail('上传场景无效', requestId, 400)
  const uploadBaseUrl = process.env.IMPROV_MEDIA_UPLOAD_BASE_URL || ''
  const uploadSecret = process.env.IMPROV_MEDIA_UPLOAD_SECRET || ''
  if (uploadBaseUrl && uploadSecret) {
    const ownerOpenId = getOpenId()
    const fileId = `improv/ios/${ownerOpenId}/${scope}/${Date.now()}-${crypto.randomUUID()}-${fileName}`
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60
    const uploadUrl = signedMediaURL(uploadBaseUrl, 'PUT', fileId, ownerOpenId, expiresAt)
    return ok({
      uploadSupported: true,
      method: 'PUT',
      uploadUrl,
      headers: {
        'Content-Type': inferAttachmentContentType(fileName, type),
        'X-Improv-Owner': ownerOpenId
      },
      fileID: fileId,
      expiresAt
    }, requestId)
  }
  return ok({
    uploadSupported: false,
    message: 'iOS 云存储直传需要配置 CloudBase HTTP 上传签名或独立对象存储签名'
  }, requestId)
}

function inferAttachmentContentType(fileName, type) {
  const extension = fileName.split('.').pop().toLowerCase()
  if (type === 'image') return IMAGE_CONTENT_TYPES[extension] || 'image/jpeg'
  if (type === 'video') return extension === 'mov' ? 'video/quicktime' : 'video/mp4'
  if (type === 'audio') return extension === 'wav' ? 'audio/wav' : 'audio/mp4'
  return 'application/octet-stream'
}

function signedMediaURL(baseUrl, method, fileID, ownerOpenId, expiresAt) {
  const secret = process.env.IMPROV_MEDIA_UPLOAD_SECRET || ''
  if (!baseUrl || !secret) return ''
  const signaturePayload = mediaSignaturePayload(method, fileID, ownerOpenId, expiresAt)
  const signature = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex')
  return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(fileID)}?expires=${expiresAt}&signature=${signature}`
}

function requestMediaDeletion(fileID, ownerOpenId) {
  const baseUrl = process.env.IMPROV_MEDIA_DELETE_BASE_URL || process.env.IMPROV_MEDIA_ACCESS_BASE_URL || ''
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60
  const url = signedMediaURL(baseUrl, 'DELETE', fileID, ownerOpenId, expiresAt)
  if (!url) return Promise.reject(new Error('external media deletion is not configured'))
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'DELETE',
      headers: { 'X-Improv-Owner': ownerOpenId }
    }, response => {
      response.resume()
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve()
        else reject(new Error(`media deletion HTTP ${response.statusCode}`))
      })
    })
    request.on('error', reject)
    request.end()
  })
}

// 从 payload 中只提取白名单中的字段
function pickFields(payload, whitelist) {
  const result = {}
  for (const key of whitelist) {
    if (payload[key] !== undefined) {
      result[key] = payload[key]
    }
  }
  return result
}

function findUnknownFields(payload, whitelist) {
  return Object.keys(payload || {}).filter(key => !whitelist.includes(key))
}

function validateFields(payload, whitelist, requestId) {
  const unknown = findUnknownFields(payload, whitelist)
  if (unknown.length) return fail(`包含未定义字段: ${unknown.join(', ')}`, requestId, 400)
  return null
}

function validateStringField(payload, field, requestId, maxLength, required = false) {
  const value = payload[field]
  if (value === undefined || value === null) {
    return required ? fail(`缺少合法 ${field}`, requestId, 400) : null
  }
  if (typeof value !== 'string') return fail(`${field} 必须为字符串`, requestId, 400)
  if (required && !value.trim()) return fail(`缺少合法 ${field}`, requestId, 400)
  if (value.length > maxLength) return fail(`${field} 不能超过 ${maxLength} 字`, requestId, 400)
  return null
}

function validateStringArrayField(payload, field, requestId, maxItems = 20, maxItemLength = 40) {
  const value = payload[field]
  if (value === undefined || value === null) return null
  if (!Array.isArray(value)) return fail(`${field} 必须为数组`, requestId, 400)
  if (value.length > maxItems) return fail(`${field} 不能超过 ${maxItems} 项`, requestId, 400)
  if (value.some(item => typeof item !== 'string' || item.length > maxItemLength)) {
    return fail(`${field} 包含非法内容`, requestId, 400)
  }
  return null
}

function validatePracticeAttachmentMarkers(item, requestId) {
  const markers = item.markers
  if (markers === undefined || markers === null) return null
  if (!Array.isArray(markers)) return fail('附件 markers 必须为数组', requestId, 400)
  if (markers.length > 20) return fail('单个附件 markers 不能超过 20 项', requestId, 400)
  const kinds = ['good', 'issue', 'reminder', 'neutral']
  const duration = Number(item.duration)
  for (const marker of markers) {
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return fail('markers 包含非法项', requestId, 400)
    const unknown = findUnknownFields(marker, ['id', 'time', 'kind', 'note', 'createdAt'])
    if (unknown.length) return fail(`markers 包含未定义字段: ${unknown.join(', ')}`, requestId, 400)
    if (typeof marker.id !== 'string' || !marker.id.trim() || marker.id.length > 100) return fail('marker 缺少合法 id', requestId, 400)
    if (!Number.isFinite(Number(marker.time)) || Number(marker.time) < 0) return fail('marker time 无效', requestId, 400)
    if (Number.isFinite(duration) && duration > 0 && Number(marker.time) > duration) return fail('marker time 超出附件时长', requestId, 400)
    if (marker.kind !== undefined && !kinds.includes(marker.kind)) return fail('marker kind 无效', requestId, 400)
    if (typeof marker.note !== 'string' || !marker.note.trim() || marker.note.length > 300) return fail('marker note 必须为 1–300 字', requestId, 400)
  }
  return null
}

function validatePracticeComparisonNotes(payload, requestId) {
  const notes = payload.comparisonNotes
  if (notes === undefined || notes === null) return null
  if (!Array.isArray(notes)) return fail('comparisonNotes 必须为数组', requestId, 400)
  if (notes.length > 20) return fail('comparisonNotes 不能超过 20 项', requestId, 400)
  for (const note of notes) {
    if (!note || typeof note !== 'object' || Array.isArray(note)) return fail('comparisonNotes 包含非法项', requestId, 400)
    const unknown = findUnknownFields(note, ['id', 'comparedRecordIds', 'improvement', 'issue', 'nextFocus', 'createdAt'])
    if (unknown.length) return fail(`comparisonNotes 包含未定义字段: ${unknown.join(', ')}`, requestId, 400)
    if (typeof note.id !== 'string' || !note.id.trim() || note.id.length > 100) return fail('comparisonNote 缺少合法 id', requestId, 400)
    if (!Array.isArray(note.comparedRecordIds) || note.comparedRecordIds.length !== 2) return fail('comparisonNote 必须关联 2 条记录', requestId, 400)
    if (note.comparedRecordIds.some(id => typeof id !== 'string' || !id.trim() || id.length > 100)) return fail('comparisonNote 关联记录无效', requestId, 400)
    if (note.improvement !== undefined && (typeof note.improvement !== 'string' || note.improvement.length > 500)) return fail('comparisonNote.improvement 不能超过 500 字', requestId, 400)
    if (note.issue !== undefined && (typeof note.issue !== 'string' || note.issue.length > 500)) return fail('comparisonNote.issue 不能超过 500 字', requestId, 400)
    if (note.nextFocus !== undefined && (typeof note.nextFocus !== 'string' || note.nextFocus.length > 500)) return fail('comparisonNote.nextFocus 不能超过 500 字', requestId, 400)
  }
  return null
}

function validatePracticeAttachments(payload, requestId) {
  const attachments = payload.attachments
  if (attachments === undefined || attachments === null) return null
  if (!Array.isArray(attachments)) return fail('attachments 必须为数组', requestId, 400)
  if (attachments.length > 9) return fail('attachments 不能超过 9 项', requestId, 400)
  const allowedTypes = ['image', 'video', 'audio']
  for (const item of attachments) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return fail('attachments 包含非法附件', requestId, 400)
    const unknown = findUnknownFields(item, ['id', 'type', 'fileID', 'thumbFileID', 'duration', 'size', 'markers', 'createdAt'])
    if (unknown.length) return fail(`attachments 包含未定义字段: ${unknown.join(', ')}`, requestId, 400)
    if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 100) return fail('附件缺少合法 id', requestId, 400)
    if (!allowedTypes.includes(item.type)) return fail('附件类型无效', requestId, 400)
    if (typeof item.fileID !== 'string' || !item.fileID.trim() || item.fileID.length > 500) return fail('附件缺少合法 fileID', requestId, 400)
    if (item.thumbFileID !== undefined && (typeof item.thumbFileID !== 'string' || item.thumbFileID.length > 500)) return fail('附件 thumbFileID 无效', requestId, 400)
    if (item.duration !== undefined && (!Number.isFinite(Number(item.duration)) || Number(item.duration) < 0 || Number(item.duration) > 3600)) return fail('附件 duration 无效', requestId, 400)
    if (item.size !== undefined && (!Number.isFinite(Number(item.size)) || Number(item.size) < 0 || Number(item.size) > 200 * 1024 * 1024)) return fail('附件 size 无效', requestId, 400)
    if (item.type === 'audio' && item.markers !== undefined && item.markers !== null && (!Array.isArray(item.markers) || item.markers.length)) return fail('音频附件不支持关键时刻', requestId, 400)
    if (item.type !== 'audio') {
      const invalidMarkers = validatePracticeAttachmentMarkers(item, requestId)
      if (invalidMarkers) return invalidMarkers
    }
  }
  return null
}

async function checkPracticeAttachmentSecurity(payload, requestId) {
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : []
  for (const item of attachments) {
    if (item.type === 'image') {
      const unsafeImage = await checkImageSecurity(item.fileID, requestId)
      if (unsafeImage) return unsafeImage
    }
  }
  return null
}

function validateRehearsalPlan(plan, requestId) {
  if (plan === undefined || plan === null) return null
  if (!Array.isArray(plan)) return fail('plan 必须为数组', requestId, 400)
  if (plan.length > 50) return fail('plan 不能超过 50 项', requestId, 400)
  const statuses = ['未开始', '进行中', '暂停中', '已完成']
  for (const item of plan) {
    if (!item || typeof item !== 'object') return fail('plan 包含非法素材项', requestId, 400)
    if (typeof item.materialId !== 'string' || !item.materialId.trim() || item.materialId.length > 100) return fail('plan 缺少合法 materialId', requestId, 400)
    if (item.status !== undefined && !statuses.includes(item.status)) return fail('plan 包含非法状态', requestId, 400)
    if (item.keep !== undefined && (typeof item.keep !== 'string' || item.keep.length > 1000)) return fail('plan.keep 不能超过 1000 字', requestId, 400)
    if (item.try !== undefined && (typeof item.try !== 'string' || item.try.length > 1000)) return fail('plan.try 不能超过 1000 字', requestId, 400)
  }
  return null
}

function validateOwnedSchema(collectionName, payload, requestId, isUpdate = false) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('请求数据无效', requestId, 400)
  const checks = []
  if (!isUpdate) checks.push(validateStringField(payload, 'id', requestId, 100, true))
  if (!isUpdate) checks.push(validateStringField(payload, 'title', requestId, 80, true))

  if (collectionName === COLLECTIONS.inspirations) {
    checks.push(
      validateStringField(payload, 'title', requestId, 80, !isUpdate),
      validateStringField(payload, 'desc', requestId, 2000),
      validateStringArrayField(payload, 'meta', requestId, 20, 40),
      validateStringField(payload, 'linkedMaterialId', requestId, 100),
      validateStringField(payload, 'linkedMaterialTitle', requestId, 80),
      validateStringField(payload, 'linkedRehearsalId', requestId, 100),
      validateStringField(payload, 'linkedRehearsalTitle', requestId, 80),
      validateStringField(payload, 'sourceType', requestId, 40),
      validateStringField(payload, 'sourceId', requestId, 100),
      validateStringField(payload, 'sourceTitle', requestId, 80),
      validatePracticeAttachments(payload, requestId)
    )
  }
  if (collectionName === COLLECTIONS.methodCards) {
    checks.push(
      validateStringField(payload, 'type', requestId, 40),
      validateStringField(payload, 'title', requestId, 80, !isUpdate),
      validateStringField(payload, 'desc', requestId, 2000),
      validateStringArrayField(payload, 'meta', requestId, 20, 40),
      validateStringField(payload, 'sourceType', requestId, 40),
      validateStringField(payload, 'sourceId', requestId, 100),
      validateStringField(payload, 'sourceTitle', requestId, 80)
    )
  }
  if (collectionName === COLLECTIONS.rehearsals) {
    const statuses = ['未开始', '进行中', '暂停中', '已完成']
    checks.push(
      validateStringField(payload, 'title', requestId, 80, !isUpdate),
      validateStringField(payload, 'desc', requestId, 1000),
      validateStringField(payload, 'teamName', requestId, 80),
      validateStringField(payload, 'duration', requestId, 40),
      validateStringArrayField(payload, 'goals', requestId, 20, 40),
      validateStringField(payload, 'source', requestId, 40),
      validateRehearsalPlan(payload.plan, requestId),
      validateStringField(payload, 'reviewKeep', requestId, 1000),
      validateStringField(payload, 'reviewTry', requestId, 1000),
      validateStringField(payload, 'reviewReminder', requestId, 500)
    )
    if (payload.status !== undefined && !statuses.includes(payload.status)) checks.push(fail('排练状态无效', requestId, 400))
  }
  if (collectionName === COLLECTIONS.practiceRecords) {
    checks.push(
      validateStringField(payload, 'materialId', requestId, 100, !isUpdate),
      validateStringField(payload, 'materialTitle', requestId, 80),
      validateStringField(payload, 'rehearsalId', requestId, 100),
      validateStringField(payload, 'rehearsalTitle', requestId, 80),
      validateStringField(payload, 'title', requestId, 80, !isUpdate),
      validateStringField(payload, 'desc', requestId, 1000),
      validateStringField(payload, 'note', requestId, 2000),
      validatePracticeAttachments(payload, requestId),
      validatePracticeComparisonNotes(payload, requestId),
      validateStringField(payload, 'reminder', requestId, 500),
      validateStringArrayField(payload, 'meta', requestId, 20, 40)
    )
    if (payload.score !== undefined && (!Number.isInteger(Number(payload.score)) || Number(payload.score) < 1 || Number(payload.score) > 10)) {
      checks.push(fail('score 必须为 1–10 分', requestId, 400))
    }
    if (payload.duration !== undefined && (!Number.isFinite(Number(payload.duration)) || Number(payload.duration) < 0 || Number(payload.duration) > 86400)) {
      checks.push(fail('duration 必须为 0–86400 秒', requestId, 400))
    }
  }
  return checks.find(Boolean) || null
}

function validateOwnedPayload(collectionName, payload, requestId, isUpdate = false) {
  const whitelist = isUpdate ? UPDATE_WHITELISTS[collectionName] : FIELD_WHITELISTS[collectionName]
  const invalid = validateFields(payload, whitelist, requestId)
  if (invalid) return invalid
  const invalidSchema = validateOwnedSchema(collectionName, payload, requestId, isUpdate)
  if (invalidSchema) return invalidSchema
  if (!isUpdate && (!payload.id || typeof payload.id !== 'string')) return fail('缺少合法 id', requestId, 400)
  if (!isUpdate && (!payload.title || typeof payload.title !== 'string')) return fail('缺少合法 title', requestId, 400)
  if (!isUpdate && collectionName === COLLECTIONS.practiceRecords && (!payload.materialId || typeof payload.materialId !== 'string')) {
    return fail('缺少合法 materialId', requestId, 400)
  }
  return null
}

async function createFeedback(payload, requestId) {
  const whitelist = ['category', 'content', 'contact', 'sourcePage', 'appVersion']
  const invalid = validateFields(payload, whitelist, requestId)
  if (invalid) return invalid

  const categories = ['bug', 'suggestion', 'content', 'other']
  const category = typeof payload.category === 'string' ? payload.category.trim() : ''
  const content = typeof payload.content === 'string' ? payload.content.trim() : ''
  const contact = typeof payload.contact === 'string' ? payload.contact.trim() : ''
  const sourcePage = typeof payload.sourcePage === 'string' ? payload.sourcePage.trim() : ''
  const appVersion = typeof payload.appVersion === 'string' ? payload.appVersion.trim() : ''

  if (!categories.includes(category)) return fail('请选择反馈类型', requestId, 400)
  if (content.length < 10 || content.length > 500) return fail('反馈内容需为 10–500 字', requestId, 400)
  if (contact.length > 100) return fail('联系方式不能超过 100 字', requestId, 400)
  if (sourcePage.length > 200) return fail('来源页面过长', requestId, 400)
  if (appVersion.length > 40) return fail('版本信息过长', requestId, 400)
  const unsafeContent = await checkTextSecurity({ content, contact }, requestId)
  if (unsafeContent) return unsafeContent

  const feedback = {
    id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    content,
    contact,
    sourcePage,
    appVersion,
    status: 'new',
    ownerOpenId: getOpenId(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null
  }
  const result = await db.collection(COLLECTIONS.feedback).add({ data: feedback })
  return ok({ item: { id: feedback.id, _id: result._id } }, requestId)
}

async function getAllByWhere(collectionName, where, orderField, maxItems = MAX_MATERIAL_SCAN) {
  const items = []
  for (let offset = 0; offset < maxItems; offset += MAX_LIMIT) {
    const result = await db.collection(collectionName)
      .where(where)
      .orderBy(orderField, 'asc')
      .skip(offset)
      .limit(Math.min(MAX_LIMIT, maxItems - offset))
      .get()
    items.push(...result.data)
    if (result.data.length < MAX_LIMIT) break
  }
  return items
}

function normalizeMaterialPayload(payload, ownerOpenId) {
  const type = payload.type
  return {
    id: payload.id || `custom-${Date.now()}`,
    title: payload.title,
    desc: payload.desc || '',
    type,
    tags: Array.isArray(payload.tags) ? payload.tags : ['自定义'],
    abilities: Array.isArray(payload.abilities) ? payload.abilities : [],
    scenes: Array.isArray(payload.scenes) ? payload.scenes : [],
    meta: Array.isArray(payload.meta) ? payload.meta : [],
    steps: Array.isArray(payload.steps) ? payload.steps : [],
    tips: payload.tips || '',
    variant: payload.variant || '',
    issue: payload.issue || '',
    relatedMaterialId: payload.relatedMaterialId || '',
    referenceOnly: typeof payload.referenceOnly === 'boolean' ? payload.referenceOnly : type === '路径',
    stripeTone: payload.stripeTone || 'orange',
    sortOrder: Number(payload.sortOrder) || 999,
    ownerOpenId,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null
  }
}

function validateMaterialPayload(payload, requestId) {
  if (!MATERIAL_TYPES.includes(payload.type)) return fail('请选择合法素材类型', requestId, 400)
  if (payload.tags !== undefined && !Array.isArray(payload.tags)) return fail('tags 必须为数组', requestId, 400)
  if (payload.abilities !== undefined && !Array.isArray(payload.abilities)) return fail('abilities 必须为数组', requestId, 400)
  if (payload.scenes !== undefined && !Array.isArray(payload.scenes)) return fail('scenes 必须为数组', requestId, 400)
  if (Array.isArray(payload.tags) && payload.tags.some(item => typeof item !== 'string' || !item.trim())) return fail('包含非法标签', requestId, 400)
  if (Array.isArray(payload.abilities) && payload.abilities.some(item => !MATERIAL_ABILITIES.includes(item))) return fail('包含非法训练能力', requestId, 400)
  if (Array.isArray(payload.scenes) && payload.scenes.some(item => !MATERIAL_SCENES.includes(item))) {
    return fail('包含非法使用场景', requestId, 400)
  }
  return null
}

function getMaterialSecurityPayload(payload) {
  return {
    title: payload.title,
    desc: payload.desc,
    tags: payload.tags,
    meta: payload.meta,
    steps: payload.steps,
    tips: payload.tips,
    variant: payload.variant,
    issue: payload.issue
  }
}

async function listMaterials(payload, requestId) {
  const invalid = validateFields(payload, ['query', 'type', 'ability', 'scene', 'status', 'source', 'limit', 'offset'], requestId)
  if (invalid) return invalid
  const ownerOpenId = getOpenId()
  const limit = Math.min(Number(payload.limit) || DEFAULT_LIMIT, MAX_LIMIT)
  const offset = Math.max(Number(payload.offset) || 0, 0)
  const type = typeof payload.type === 'string' ? payload.type.trim() : ''
  const query = typeof payload.query === 'string' ? payload.query.trim().toLowerCase() : ''
  const ability = typeof payload.ability === 'string' ? payload.ability.trim() : ''
  const scene = typeof payload.scene === 'string' ? payload.scene.trim() : ''
  const status = typeof payload.status === 'string' ? payload.status.trim() : ''
  const source = typeof payload.source === 'string' ? payload.source.trim() : 'all'
  if (type && type !== 'all' && !MATERIAL_TYPES.includes(type)) return fail('素材类型筛选无效', requestId, 400)
  if (ability && ability !== 'all' && !MATERIAL_ABILITIES.includes(ability)) return fail('训练能力筛选无效', requestId, 400)
  if (scene && scene !== 'all' && !MATERIAL_SCENES.includes(scene)) return fail('使用场景筛选无效', requestId, 400)
  if (status && status !== 'all' && !MATERIAL_STATUSES.includes(status)) return fail('素材状态筛选无效', requestId, 400)
  if (!['all', 'owned'].includes(source)) return fail('素材来源筛选无效', requestId, 400)
  const visibleOwners = ownerOpenId ? ['system', ownerOpenId] : ['system']
  const materialWhere = source === 'owned'
    ? { deletedAt: null, ownerOpenId: ownerOpenId || '__no_owner__' }
    : { deletedAt: null, ownerOpenId: _.in(visibleOwners) }
  const scannedMaterials = await getAllByWhere(COLLECTIONS.materials, materialWhere, 'sortOrder', MAX_MATERIAL_SCAN + 1)
  const scanLimitReached = scannedMaterials.length > MAX_MATERIAL_SCAN
  const materials = scannedMaterials.slice(0, MAX_MATERIAL_SCAN)
    .filter(material => MATERIAL_TYPES.includes(material.type))

  // 无 OPENID 时（如云控制台测试）跳过用户状态合并
  const statesResult = ownerOpenId
    ? { data: await getAllByWhere(COLLECTIONS.userMaterialStates, { ownerOpenId }, 'createdAt') }
    : { data: [] }

  const states = statesResult.data.reduce((map, item) => {
    map[item.materialId] = item
    return map
  }, {})
  const filters = { type, query, ability, scene, status }
  const visibleItems = materials.map((material) => {
    const state = states[material.id] || {}
    return Object.assign({}, material, {
      saved: !!state.saved,
      played: !!state.playedCount,
      playedCount: state.playedCount || 0,
      isOwnedByCurrentUser: !!ownerOpenId && material.ownerOpenId === ownerOpenId,
      lastPlayedAt: state.lastPlayedAt || null,
      lastRehearsalAt: state.lastRehearsalAt || null
    })
  })
  const filteredItems = visibleItems.filter(material => matchesMaterialFilters(material, filters))
  const facets = buildMaterialFacets(visibleItems, filters)
  const categoryCounts = buildMaterialTypeCounts(visibleItems)
  const items = filteredItems.slice(offset, offset + limit)
  const nextOffset = offset + items.length
  return ok({
    items,
    total: filteredItems.length,
    availableTotal: visibleItems.length,
    categoryCounts,
    facets,
    capacity: {
      scanLimit: MAX_MATERIAL_SCAN,
      scanLimitReached
    },
    hasMore: nextOffset < filteredItems.length,
    nextOffset: nextOffset < filteredItems.length ? nextOffset : null
  }, requestId)
}

async function randomMaterial(payload, requestId) {
  const invalid = validateFields(payload, ['query', 'type', 'ability', 'scene', 'status', 'source', 'excludeId'], requestId)
  if (invalid) return invalid
  const listed = await listMaterials(Object.assign({}, payload, { limit: MAX_LIMIT, offset: 0 }), requestId)
  if (!listed || listed.code !== 0) return listed
  const excluded = typeof payload.excludeId === 'string' ? payload.excludeId : ''
  const candidates = (listed.data.items || []).filter(item => !item.referenceOnly && item.id !== excluded)
  if (!candidates.length && excluded) {
    const fallback = (listed.data.items || []).filter(item => !item.referenceOnly)
    if (fallback.length) return ok({ item: fallback[Math.floor(Math.random() * fallback.length)] }, requestId)
  }
  if (!candidates.length) return ok({ item: null }, requestId)
  return ok({ item: candidates[Math.floor(Math.random() * candidates.length)] }, requestId)
}

async function resolveMedia(payload, requestId) {
  const invalid = validateFields(payload, ['fileID'], requestId)
  if (invalid) return invalid
  const fileID = typeof payload.fileID === 'string' ? payload.fileID.trim() : ''
  if (!fileID) return fail('缺少媒体文件 ID', requestId, 400)
  if (/^https?:\/\//.test(fileID)) return ok({ url: fileID, expiresAt: null }, requestId)
  if (isOwnedExternalMedia(fileID, getOpenId())) {
    const expiresAt = Math.floor(Date.now() / 1000) + 50 * 60
    const accessBaseUrl = process.env.IMPROV_MEDIA_ACCESS_BASE_URL || ''
    const url = signedMediaURL(accessBaseUrl, 'GET', fileID, getOpenId(), expiresAt)
    if (!url) return fail('媒体访问网关未配置', requestId, 503)
    return ok({ url, expiresAt: expiresAt * 1000 }, requestId)
  }
  if (!fileID.startsWith('cloud://')) return fail('媒体文件 ID 无效或不属于当前用户', requestId, 400)
  try {
    const result = await cloud.getTempFileURL({ fileList: [fileID] })
    const item = result.fileList && result.fileList[0]
    if (!item || item.status !== 0 || !item.tempFileURL) return fail('媒体地址暂不可用', requestId, 404)
    return ok({ url: item.tempFileURL, expiresAt: Date.now() + 50 * 60 * 1000 }, requestId)
  } catch (error) {
    console.error('[improv-api] resolve media failed', { requestId, message: error && error.message })
    return fail('媒体地址获取失败', requestId, 503)
  }
}

async function getMaterial(payload, requestId) {
  const invalid = validateFields(payload, ['id'], requestId)
  if (invalid) return invalid
  const id = typeof payload.id === 'string' ? payload.id.trim() : ''
  if (!id) return fail('缺少素材 ID', requestId, 400)

  const ownerOpenId = getOpenId()
  const visibleOwners = ownerOpenId ? ['system', ownerOpenId] : ['system']
  const result = await db.collection(COLLECTIONS.materials)
    .where({ id, deletedAt: null, ownerOpenId: _.in(visibleOwners) })
    .limit(1)
    .get()
  const material = result.data[0]
  if (!material || !MATERIAL_TYPES.includes(material.type)) return fail('没有找到这条素材', requestId, 404)

  const stateResult = ownerOpenId
    ? await db.collection(COLLECTIONS.userMaterialStates).where({ ownerOpenId, materialId: id }).limit(1).get()
    : { data: [] }
  const state = stateResult.data[0] || {}
  return ok({
    item: Object.assign({}, material, {
      saved: !!state.saved,
      played: !!state.playedCount,
      playedCount: state.playedCount || 0,
      isOwnedByCurrentUser: !!ownerOpenId && material.ownerOpenId === ownerOpenId,
      lastPlayedAt: state.lastPlayedAt || null,
      lastRehearsalAt: state.lastRehearsalAt || null
    })
  }, requestId)
}

async function createMaterial(payload, requestId) {
  const invalid = validateFields(payload, ['id', 'title', 'desc', 'type', 'tags', 'abilities', 'scenes', 'meta', 'steps', 'tips', 'variant', 'issue', 'relatedMaterialId', 'referenceOnly', 'stripeTone', 'sortOrder'], requestId)
  if (invalid) return invalid
  if (!payload.title) return fail('缺少素材名称', requestId, 400)
  const invalidMaterial = validateMaterialPayload(payload, requestId)
  if (invalidMaterial) return invalidMaterial
  const unsafeContent = await checkTextSecurity(getMaterialSecurityPayload(payload), requestId)
  if (unsafeContent) return unsafeContent
  const ownerOpenId = getOpenId()
  const existing = await db.collection(COLLECTIONS.materials).where({ id: payload.id, ownerOpenId, deletedAt: null }).limit(1).get()
  if (existing.data.length) return ok({ item: existing.data[0] }, requestId)
  const doc = normalizeMaterialPayload(payload, ownerOpenId)
  const result = await db.collection(COLLECTIONS.materials).add({ data: doc })
  return ok({ item: Object.assign({ _id: result._id }, doc, { isOwnedByCurrentUser: true }) }, requestId)
}

async function updateMaterial(payload, requestId) {
  const invalid = validateFields(payload, ['id', 'title', 'desc', 'type', 'tags', 'abilities', 'scenes', 'meta', 'steps', 'tips', 'variant', 'issue', 'relatedMaterialId', 'referenceOnly', 'stripeTone', 'sortOrder'], requestId)
  if (invalid) return invalid
  if (!payload.id) return fail('缺少素材 ID', requestId, 400)
  if (!payload.title) return fail('缺少素材名称', requestId, 400)
  const invalidMaterial = validateMaterialPayload(payload, requestId)
  if (invalidMaterial) return invalidMaterial
  const unsafeContent = await checkTextSecurity(getMaterialSecurityPayload(payload), requestId)
  if (unsafeContent) return unsafeContent
  const ownerOpenId = getOpenId()

  const collection = db.collection(COLLECTIONS.materials)
  const existing = await collection.where({ id: payload.id, ownerOpenId, deletedAt: null }).limit(1).get()
  if (!existing.data.length) return fail('素材不存在或无权限修改', requestId, 404)

  const doc = normalizeMaterialPayload(payload, ownerOpenId)
  delete doc.id
  delete doc.createdAt
  doc.updatedAt = now()

  await collection.doc(existing.data[0]._id).update({ data: doc })
  return ok({ item: Object.assign({}, existing.data[0], doc, { id: payload.id, isOwnedByCurrentUser: true }) }, requestId)
}

async function deleteMaterial(payload, requestId) {
  if (!payload.id) return fail('缺少素材 ID', requestId, 400)
  const ownerOpenId = getOpenId()

  const collection = db.collection(COLLECTIONS.materials)
  const existing = await collection.where({ id: payload.id, ownerOpenId, deletedAt: null }).limit(1).get()
  if (!existing.data.length) return fail('素材不存在或无权限删除', requestId, 404)

  await collection.doc(existing.data[0]._id).update({ data: { deletedAt: now() } })
  return ok({ materialId: payload.id }, requestId)
}

async function updateMaterialState(payload, requestId) {
  const invalid = validateFields(payload, ['materialId', 'saved', 'played', 'lastRehearsalAt'], requestId)
  if (invalid) return invalid
  const ownerOpenId = getOpenId()
  const materialId = payload.materialId
  if (!materialId) return fail('缺少 materialId', requestId, 400)
  const collection = db.collection(COLLECTIONS.userMaterialStates)
  const existing = await collection.where({ ownerOpenId, materialId }).limit(1).get()
  const patch = { updatedAt: now() }
  if (typeof payload.saved === 'boolean') patch.saved = payload.saved
  if (payload.played === true) {
    patch.playedCount = _.inc(1)
    patch.lastPlayedAt = now()
  }
  if (payload.played === false) {
    patch.playedCount = 0
    patch.lastPlayedAt = null
  }
  if (payload.lastRehearsalAt) patch.lastRehearsalAt = now()

  if (existing.data.length) {
    await collection.doc(existing.data[0]._id).update({ data: patch })
    return ok({ materialId }, requestId)
  }

  await collection.add({
    data: Object.assign({
      ownerOpenId,
      materialId,
      saved: !!payload.saved,
      playedCount: payload.played ? 1 : 0,
      lastPlayedAt: payload.played ? now() : null,
      lastRehearsalAt: payload.lastRehearsalAt ? now() : null,
      createdAt: now()
    }, patch)
  })
  return ok({ materialId }, requestId)
}

async function listOwned(collectionName, payload, requestId) {
  const limit = Math.min(Number(payload.limit) || DEFAULT_LIMIT, MAX_LIMIT)
  const offset = Math.max(Number(payload.offset) || 0, 0)
  const where = ownerWhere()
  if (collectionName === COLLECTIONS.practiceRecords) {
    if (payload.materialId && typeof payload.materialId === 'string' && payload.materialId !== 'all') {
      where.materialId = payload.materialId
    }
  }
  const result = await db.collection(collectionName)
    .where(where)
    .orderBy('updatedAt', 'desc')
    .skip(offset)
    .limit(limit)
    .get()
  let items = result.data
  if (collectionName === COLLECTIONS.practiceRecords) {
    const minScore = Number(payload.minScore)
    const maxScore = Number(payload.maxScore)
    if (Number.isFinite(minScore)) items = items.filter(item => Number(item.score) >= Math.max(1, minScore))
    if (Number.isFinite(maxScore)) items = items.filter(item => Number(item.score) <= Math.min(10, maxScore))
    if (payload.attachmentType && payload.attachmentType !== 'all') {
      const attachmentType = payload.attachmentType
      items = items.filter(item => Array.isArray(item.attachments) && item.attachments.some(attachment => attachment.type === attachmentType))
    }
  }
  return ok({ items, nextOffset: offset + items.length, hasMore: result.data.length >= limit }, requestId)
}

async function createOwned(collectionName, payload, requestId) {
  const whitelist = FIELD_WHITELISTS[collectionName]
  const invalid = validateOwnedPayload(collectionName, payload, requestId)
  if (invalid) return invalid
  const safeData = pickFields(payload, whitelist)
  const unsafeContent = await checkTextSecurity(safeData, requestId)
  if (unsafeContent) return unsafeContent
  if (collectionName === COLLECTIONS.practiceRecords || collectionName === COLLECTIONS.inspirations) {
    const unsafeAttachment = await checkPracticeAttachmentSecurity(safeData, requestId)
    if (unsafeAttachment) return unsafeAttachment
  }
  const collection = db.collection(collectionName)
  const existing = await collection.where(ownerWhere({ id: safeData.id })).limit(1).get()
  if (existing.data.length) return ok({ item: existing.data[0] }, requestId)
  const doc = Object.assign({}, safeData, {
    ownerOpenId: getOpenId(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null
  })
  const result = await collection.add({ data: doc })
  return ok({ item: Object.assign({ _id: result._id }, doc) }, requestId)
}

async function deleteOwned(collectionName, payload, requestId) {
  if (!payload.id) return fail('缺少 id', requestId, 400)
  const collection = db.collection(collectionName)
  const result = await collection.where(ownerWhere({ id: payload.id })).limit(1).get()
  if (!result.data.length) return fail('未找到记录', requestId, 404)
  await collection.doc(result.data[0]._id).update({ data: { deletedAt: now() } })
  return ok({ id: payload.id }, requestId)
}

async function updateOwned(collectionName, payload, requestId) {
  if (!payload.id) return fail('缺少 id', requestId, 400)
  const collection = db.collection(collectionName)
  const result = await collection.where(ownerWhere({ id: payload.id })).limit(1).get()
  if (!result.data.length) return fail('未找到记录', requestId, 404)
  const whitelist = UPDATE_WHITELISTS[collectionName]
  const rawPatch = payload.patch || {}
  const invalid = validateOwnedPayload(collectionName, rawPatch, requestId, true)
  if (invalid) return invalid
  if (!Object.keys(rawPatch).length) return fail('没有可更新字段', requestId, 400)
  const safePatch = pickFields(rawPatch, whitelist)
  const unsafeContent = await checkTextSecurity(safePatch, requestId)
  if (unsafeContent) return unsafeContent
  if ((collectionName === COLLECTIONS.practiceRecords || collectionName === COLLECTIONS.inspirations) && safePatch.attachments !== undefined) {
    const unsafeAttachment = await checkPracticeAttachmentSecurity(safePatch, requestId)
    if (unsafeAttachment) return unsafeAttachment
  }
  const patch = Object.assign({}, safePatch, { updatedAt: now() })
  await collection.doc(result.data[0]._id).update({ data: patch })
  return ok({ item: Object.assign({}, result.data[0], safePatch) }, requestId)
}

async function getProfile(requestId) {
  const result = await db.collection(COLLECTIONS.profiles)
    .where(ownerWhere())
    .limit(1)
    .get()
  return ok({ item: result.data[0] || null }, requestId)
}

async function updateProfile(payload, requestId) {
  const invalid = validateFields(payload, ['displayName', 'avatarUrl', 'troupeName'], requestId)
  if (invalid) return invalid
  const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : ''
  const avatarUrl = typeof payload.avatarUrl === 'string' ? payload.avatarUrl.trim() : ''
  const troupeName = typeof payload.troupeName === 'string' ? payload.troupeName.trim() : ''
  if (!displayName) return fail('缺少 displayName', requestId, 400)
  if (displayName.length > 40) return fail('昵称不能超过 40 字', requestId, 400)
  if (troupeName.length > 80) return fail('剧团名不能超过 80 字', requestId, 400)
  if (avatarUrl.length > 500) return fail('头像地址过长', requestId, 400)
  if (avatarUrl && !avatarUrl.startsWith('cloud://') && !avatarUrl.startsWith('wxfile://') && !avatarUrl.startsWith('http')) {
    return fail('头像地址无效', requestId, 400)
  }

  const collection = db.collection(COLLECTIONS.profiles)
  const existing = await collection.where(ownerWhere()).limit(1).get()
  const unsafeContent = await checkTextSecurity({ displayName, troupeName }, requestId)
  if (unsafeContent) return unsafeContent
  const currentAvatarUrl = existing.data[0] && existing.data[0].avatarUrl
  if (avatarUrl && avatarUrl.startsWith('cloud://') && avatarUrl !== currentAvatarUrl) {
    const unsafeImage = await checkImageSecurity(avatarUrl, requestId)
    if (unsafeImage) return unsafeImage
  }
  const patch = {
    displayName,
    avatarUrl,
    troupeName,
    updatedAt: now()
  }

  if (existing.data.length) {
    await collection.doc(existing.data[0]._id).update({ data: patch })
    return ok({ item: Object.assign({}, existing.data[0], patch) }, requestId)
  }

  const profile = Object.assign({}, patch, {
    id: `profile-${Date.now()}`,
    ownerOpenId: getOpenId(),
    createdAt: now(),
    deletedAt: null
  })
  const result = await collection.add({ data: profile })
  return ok({ item: Object.assign({ _id: result._id }, profile) }, requestId)
}

async function updateRehearsalMaterialStatus(payload, requestId) {
  const materialId = payload.materialId
  if (!payload.rehearsalId || !materialId) return fail('缺少 rehearsalId 或 materialId', requestId, 400)
  const collection = db.collection(COLLECTIONS.rehearsals)
  const result = await collection.where(ownerWhere({ id: payload.rehearsalId })).limit(1).get()
  if (!result.data.length) return fail('未找到排练记录', requestId, 404)
  const rehearsal = result.data[0]
  const currentPlan = Array.isArray(rehearsal.plan) ? rehearsal.plan : []
  const plan = currentPlan.map((item) => item.materialId === materialId
    ? Object.assign({}, item, {
        materialId,
        status: payload.status || item.status,
        keep: typeof payload.keep === 'string' ? payload.keep : item.keep || '',
        try: typeof payload.try === 'string' ? payload.try : item.try || ''
      })
    : item)
  const unsafeContent = await checkTextSecurity({ keep: payload.keep, try: payload.try }, requestId)
  if (unsafeContent) return unsafeContent
  await collection.doc(rehearsal._id).update({
    data: {
      plan,
      status: payload.rehearsalStatus || rehearsal.status || '进行中',
      updatedAt: now()
    }
  })
  return ok({ item: Object.assign({}, rehearsal, { plan, status: payload.rehearsalStatus || rehearsal.status || '进行中' }) }, requestId)
}

async function todaySummary(requestId) {
  const ownerOpenId = getOpenId()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const [inspirations, rehearsals, unplayedMaterials] = await Promise.all([
    db.collection(COLLECTIONS.inspirations).where({
      ownerOpenId,
      deletedAt: null,
      createdAt: _.gte(start)
    }).orderBy('createdAt', 'desc').limit(TODAY_LIMIT).get(),
    db.collection(COLLECTIONS.rehearsals).where({
      ownerOpenId,
      deletedAt: null,
      createdAt: _.gte(start)
    }).orderBy('createdAt', 'desc').limit(TODAY_LIMIT).get(),
    ownerOpenId
      ? db.collection(COLLECTIONS.materials).where({
          deletedAt: null,
          ownerOpenId: 'system',
          referenceOnly: _.neq(true)
        }).orderBy('sortOrder', 'asc').limit(TODAY_LIMIT).get()
      : { data: [] }
  ])

  let recommendMaterialId = ''
  if (ownerOpenId && unplayedMaterials.data.length) {
    const statesResult = await db.collection(COLLECTIONS.userMaterialStates)
      .where({ ownerOpenId })
      .limit(MAX_LIMIT)
      .get()
    const playedIds = new Set(statesResult.data.filter(s => s.playedCount > 0).map(s => s.materialId))
    const unplayed = unplayedMaterials.data.filter(m => !playedIds.has(m.id))
    if (unplayed.length) {
      const idx = Math.floor(Math.random() * Math.min(unplayed.length, RECOMMEND_POOL_SIZE))
      recommendMaterialId = unplayed[idx].id
    }
  }
  if (!recommendMaterialId && unplayedMaterials.data.length) {
    recommendMaterialId = unplayedMaterials.data[0].id
  }

  return ok({
    inspirations: inspirations.data,
    rehearsals: rehearsals.data,
    recommendMaterialId
  }, requestId)
}

async function completePractice(payload, requestId) {
  const rootInvalid = validateFields(payload, ['practiceRecord', 'rehearsalPatch', 'methodCard'], requestId)
  if (rootInvalid) return rootInvalid
  const recordPayload = payload.practiceRecord || {}
  const recordInvalid = validateOwnedPayload(COLLECTIONS.practiceRecords, recordPayload, requestId)
  if (recordInvalid) return recordInvalid
  const rehearsalPatch = payload.rehearsalPatch || null
  const methodCardPayload = payload.methodCard || null
  if (rehearsalPatch) {
    const invalid = validateFields(rehearsalPatch, ['rehearsalId', 'materialId', 'status', 'keep', 'try'], requestId)
    if (invalid) return invalid
  }
  if (methodCardPayload) {
    const invalid = validateOwnedPayload(COLLECTIONS.methodCards, methodCardPayload, requestId)
    if (invalid) return invalid
  }
  const unsafeContent = await checkTextSecurity({
    practiceRecord: pickFields(recordPayload, FIELD_WHITELISTS[COLLECTIONS.practiceRecords]),
    rehearsalPatch,
    methodCard: methodCardPayload ? pickFields(methodCardPayload, FIELD_WHITELISTS[COLLECTIONS.methodCards]) : null
  }, requestId)
  if (unsafeContent) return unsafeContent
  const unsafeAttachment = await checkPracticeAttachmentSecurity(recordPayload, requestId)
  if (unsafeAttachment) return unsafeAttachment

  const ownerOpenId = getOpenId()
  const result = await db.runTransaction(async transaction => {
    const practiceCollection = transaction.collection(COLLECTIONS.practiceRecords)
    const existingRecord = await practiceCollection.where({ ownerOpenId, id: recordPayload.id, deletedAt: null }).limit(1).get()
    let practiceRecord = existingRecord.data[0]
    if (practiceRecord) {
      let existingRehearsal = null
      let existingMethodCard = null
      if (rehearsalPatch) {
        const foundRehearsal = await transaction.collection(COLLECTIONS.rehearsals)
          .where({ ownerOpenId, id: rehearsalPatch.rehearsalId, deletedAt: null }).limit(1).get()
        existingRehearsal = foundRehearsal.data[0] || null
      }
      if (methodCardPayload) {
        const foundMethod = await transaction.collection(COLLECTIONS.methodCards)
          .where({ ownerOpenId, id: methodCardPayload.id, deletedAt: null }).limit(1).get()
        existingMethodCard = foundMethod.data[0] || null
      }
      return { practiceRecord, rehearsal: existingRehearsal, methodCard: existingMethodCard }
    }
    if (!practiceRecord) {
      practiceRecord = Object.assign({}, pickFields(recordPayload, FIELD_WHITELISTS[COLLECTIONS.practiceRecords]), {
        ownerOpenId,
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null
      })
      const added = await practiceCollection.add({ data: practiceRecord })
      practiceRecord = Object.assign({ _id: added._id }, practiceRecord)
    }

    let rehearsal = null
    if (rehearsalPatch) {
      const rehearsalCollection = transaction.collection(COLLECTIONS.rehearsals)
      const rehearsalResult = await rehearsalCollection.where({ ownerOpenId, id: rehearsalPatch.rehearsalId, deletedAt: null }).limit(1).get()
      if (!rehearsalResult.data.length) throw new Error('关联排练不存在')
      rehearsal = rehearsalResult.data[0]
      const currentPlan = Array.isArray(rehearsal.plan) ? rehearsal.plan : []
      const plan = currentPlan.map(item => item.materialId === rehearsalPatch.materialId
        ? Object.assign({}, item, {
            status: rehearsalPatch.status || item.status,
            keep: typeof rehearsalPatch.keep === 'string' ? rehearsalPatch.keep : item.keep || '',
            try: typeof rehearsalPatch.try === 'string' ? rehearsalPatch.try : item.try || ''
          })
        : item)
      await rehearsalCollection.doc(rehearsal._id).update({ data: { plan, updatedAt: now() } })
      rehearsal = Object.assign({}, rehearsal, { plan })
    }

    let methodCard = null
    if (methodCardPayload) {
      const methodCollection = transaction.collection(COLLECTIONS.methodCards)
      const existingMethod = await methodCollection.where({ ownerOpenId, id: methodCardPayload.id, deletedAt: null }).limit(1).get()
      methodCard = existingMethod.data[0]
      if (!methodCard) {
        methodCard = Object.assign({}, pickFields(methodCardPayload, FIELD_WHITELISTS[COLLECTIONS.methodCards]), {
          ownerOpenId,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null
        })
        const added = await methodCollection.add({ data: methodCard })
        methodCard = Object.assign({ _id: added._id }, methodCard)
      }
    }

    const materialStateCollection = transaction.collection(COLLECTIONS.userMaterialStates)
    const materialStateResult = await materialStateCollection.where({ ownerOpenId, materialId: recordPayload.materialId }).limit(1).get()
    if (materialStateResult.data.length) {
      await materialStateCollection.doc(materialStateResult.data[0]._id).update({
        data: { playedCount: _.inc(1), lastPlayedAt: now(), updatedAt: now() }
      })
    } else {
      await materialStateCollection.add({ data: {
        ownerOpenId,
        materialId: recordPayload.materialId,
        saved: false,
        playedCount: 1,
        lastPlayedAt: now(),
        lastRehearsalAt: null,
        createdAt: now(),
        updatedAt: now()
      } })
    }
    return { practiceRecord, rehearsal, methodCard }
  })
  return ok(result, requestId)
}

async function completeRehearsal(payload, requestId) {
  const rootInvalid = validateFields(payload, ['id', 'patch', 'methodCard'], requestId)
  if (rootInvalid) return rootInvalid
  if (!payload.id) return fail('缺少排练 id', requestId, 400)
  const patch = payload.patch || {}
  const invalidPatch = validateOwnedPayload(COLLECTIONS.rehearsals, patch, requestId, true)
  if (invalidPatch) return invalidPatch
  const methodCardPayload = payload.methodCard || null
  if (methodCardPayload) {
    const invalid = validateOwnedPayload(COLLECTIONS.methodCards, methodCardPayload, requestId)
    if (invalid) return invalid
  }
  const unsafeContent = await checkTextSecurity({
    patch: pickFields(patch, UPDATE_WHITELISTS[COLLECTIONS.rehearsals]),
    methodCard: methodCardPayload ? pickFields(methodCardPayload, FIELD_WHITELISTS[COLLECTIONS.methodCards]) : null
  }, requestId)
  if (unsafeContent) return unsafeContent
  const ownerOpenId = getOpenId()
  const result = await db.runTransaction(async transaction => {
    const rehearsalCollection = transaction.collection(COLLECTIONS.rehearsals)
    const found = await rehearsalCollection.where({ ownerOpenId, id: payload.id, deletedAt: null }).limit(1).get()
    if (!found.data.length) throw new Error('排练记录不存在')
    const rehearsalPatch = Object.assign({}, pickFields(patch, UPDATE_WHITELISTS[COLLECTIONS.rehearsals]), {
      status: '已完成',
      updatedAt: now()
    })
    await rehearsalCollection.doc(found.data[0]._id).update({ data: rehearsalPatch })
    const rehearsal = Object.assign({}, found.data[0], rehearsalPatch)
    let methodCard = null
    if (methodCardPayload) {
      const methodCollection = transaction.collection(COLLECTIONS.methodCards)
      const existing = await methodCollection.where({ ownerOpenId, id: methodCardPayload.id, deletedAt: null }).limit(1).get()
      methodCard = existing.data[0]
      if (!methodCard) {
        methodCard = Object.assign({}, pickFields(methodCardPayload, FIELD_WHITELISTS[COLLECTIONS.methodCards]), {
          ownerOpenId,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null
        })
        const added = await methodCollection.add({ data: methodCard })
        methodCard = Object.assign({ _id: added._id }, methodCard)
      }
    }
    return { rehearsal, methodCard }
  })
  return ok(result, requestId)
}

async function deleteAccount(requestId) {
  const ownerOpenId = getOpenId()
  const [profiles, inspirations, practiceRecords] = await Promise.all([
    getAllByWhere(COLLECTIONS.profiles, { ownerOpenId }, 'createdAt', 10000),
    getAllByWhere(COLLECTIONS.inspirations, { ownerOpenId }, 'createdAt', 10000),
    getAllByWhere(COLLECTIONS.practiceRecords, { ownerOpenId }, 'createdAt', 10000)
  ])
  const mediaFileIDs = new Set()
  for (const profile of profiles) {
    if (typeof profile.avatarUrl === 'string') mediaFileIDs.add(profile.avatarUrl)
  }
  for (const record of inspirations.concat(practiceRecords)) {
    for (const attachment of Array.isArray(record.attachments) ? record.attachments : []) {
      if (typeof attachment.fileID === 'string') mediaFileIDs.add(attachment.fileID)
      if (typeof attachment.thumbFileID === 'string' && attachment.thumbFileID) mediaFileIDs.add(attachment.thumbFileID)
    }
  }
  const privateCollections = [
    COLLECTIONS.profiles,
    COLLECTIONS.inspirations,
    COLLECTIONS.rehearsals,
    COLLECTIONS.practiceRecords,
    COLLECTIONS.methodCards,
    COLLECTIONS.feedback,
    COLLECTIONS.materials
  ]
  const results = []
  if (requestClientContext && requestClientContext.sessionId) {
    try {
      await db.collection(COLLECTIONS.iosSessionRevocations).add({ data: {
        ownerOpenId,
        sessionId: '*',
        revokedBefore: Date.now(),
        revokedAt: now(),
        createdAt: now()
      } })
      results.push({ target: COLLECTIONS.iosSessionRevocations, ok: true })
    } catch (error) {
      console.warn('[improv-api] revoke iOS session failed', error)
      results.push({ target: COLLECTIONS.iosSessionRevocations, ok: false, message: error.message || 'session revoke failed' })
    }
  }
  for (const collectionName of privateCollections) {
    try {
      const result = await db.collection(collectionName)
        .where({ ownerOpenId, deletedAt: null })
        .update({ data: { deletedAt: now(), updatedAt: now() } })
      results.push({ target: collectionName, ok: true, updated: result.updated || 0 })
    } catch (error) {
      console.warn('[improv-api] delete account collection failed', collectionName, error)
      results.push({ target: collectionName, ok: false, message: error.message || 'collection delete failed' })
    }
  }
  try {
    const stateResult = await db.collection(COLLECTIONS.userMaterialStates).where({ ownerOpenId }).remove()
    results.push({ target: COLLECTIONS.userMaterialStates, ok: true, deleted: stateResult.deleted || 0 })
  } catch (error) {
    console.warn('[improv-api] delete account material states failed', error)
    results.push({ target: COLLECTIONS.userMaterialStates, ok: false, message: error.message || 'material states delete failed' })
  }
  const cloudFileIDs = Array.from(mediaFileIDs).filter(fileID => fileID.startsWith('cloud://'))
  for (let index = 0; index < cloudFileIDs.length; index += 50) {
    const fileList = cloudFileIDs.slice(index, index + 50)
    try {
      await cloud.deleteFile({ fileList })
      results.push({ target: 'cloudMediaFiles', ok: true, deleted: fileList.length })
    } catch (error) {
      console.warn('[improv-api] delete cloud media failed', error)
      results.push({ target: 'cloudMediaFiles', ok: false, message: error.message || 'cloud media delete failed' })
    }
  }
  const externalFileIDs = Array.from(mediaFileIDs).filter(fileID => isOwnedExternalMedia(fileID, ownerOpenId))
  for (const fileID of externalFileIDs) {
    try {
      await requestMediaDeletion(fileID, ownerOpenId)
      results.push({ target: 'externalMediaFile', fileID, ok: true })
    } catch (error) {
      console.warn('[improv-api] delete external media failed', error)
      results.push({ target: 'externalMediaFile', fileID, ok: false, message: error.message || 'external media delete failed' })
    }
  }
  const failed = results.filter(item => !item.ok)
  if (failed.length) {
    return { code: 207, message: '部分数据删除未完成，请稍后重试', data: { deleted: false, retryable: true, results }, requestId }
  }
  const updatedByTarget = Object.fromEntries(results.map(item => [item.target, item.updated || 0]))
  return ok({
    deleted: true,
    deletedInspirations: updatedByTarget[COLLECTIONS.inspirations] || 0,
    deletedPracticeRecords: updatedByTarget[COLLECTIONS.practiceRecords] || 0,
    deletedRehearsals: updatedByTarget[COLLECTIONS.rehearsals] || 0,
    deletedMethodCards: updatedByTarget[COLLECTIONS.methodCards] || 0,
    results
  }, requestId)
}

// 路由表
const routes = {
  'auth.apple': (payload, requestId) => authApple(payload, requestId),
  'material.list': (payload, requestId) => listMaterials(payload, requestId),
  'material.random': (payload, requestId) => randomMaterial(payload, requestId),
  'material.get': (payload, requestId) => getMaterial(payload, requestId),
  'material.create': (payload, requestId) => createMaterial(payload, requestId),
  'material.update': (payload, requestId) => updateMaterial(payload, requestId),
  'material.delete': (payload, requestId) => deleteMaterial(payload, requestId),
  'material.updateState': (payload, requestId) => updateMaterialState(payload, requestId),
  'profile.get': (_payload, requestId) => getProfile(requestId),
  'profile.update': (payload, requestId) => updateProfile(payload, requestId),
  'today.summary': (_payload, requestId) => todaySummary(requestId),
  'inspiration.list': (payload, requestId) => listOwned(COLLECTIONS.inspirations, payload, requestId),
  'inspiration.create': (payload, requestId) => createOwned(COLLECTIONS.inspirations, payload, requestId),
  'inspiration.update': (payload, requestId) => updateOwned(COLLECTIONS.inspirations, payload, requestId),
  'inspiration.delete': (payload, requestId) => deleteOwned(COLLECTIONS.inspirations, payload, requestId),
  'methodCard.list': (payload, requestId) => listOwned(COLLECTIONS.methodCards, payload, requestId),
  'methodCard.create': (payload, requestId) => createOwned(COLLECTIONS.methodCards, payload, requestId),
  'methodCard.update': (payload, requestId) => updateOwned(COLLECTIONS.methodCards, payload, requestId),
  'methodCard.delete': (payload, requestId) => deleteOwned(COLLECTIONS.methodCards, payload, requestId),
  'rehearsal.list': (payload, requestId) => listOwned(COLLECTIONS.rehearsals, payload, requestId),
  'rehearsal.create': (payload, requestId) => createOwned(COLLECTIONS.rehearsals, payload, requestId),
  'rehearsal.update': (payload, requestId) => updateOwned(COLLECTIONS.rehearsals, payload, requestId),
  'rehearsal.delete': (payload, requestId) => deleteOwned(COLLECTIONS.rehearsals, payload, requestId),
  'rehearsal.updateMaterialStatus': (payload, requestId) => updateRehearsalMaterialStatus(payload, requestId),
  'practiceRecord.list': (payload, requestId) => listOwned(COLLECTIONS.practiceRecords, payload, requestId),
  'practiceRecord.create': (payload, requestId) => createOwned(COLLECTIONS.practiceRecords, payload, requestId),
  'practiceRecord.update': (payload, requestId) => updateOwned(COLLECTIONS.practiceRecords, payload, requestId),
  'practiceRecord.delete': (payload, requestId) => deleteOwned(COLLECTIONS.practiceRecords, payload, requestId),
  'practice.complete': (payload, requestId) => completePractice(payload, requestId),
  'rehearsal.complete': (payload, requestId) => completeRehearsal(payload, requestId),
  'feedback.create': (payload, requestId) => createFeedback(payload, requestId),
  'account.delete': (_payload, requestId) => deleteAccount(requestId),
  'security.checkText': (payload, requestId) => checkTextSecurityAction(payload, requestId),
  'security.checkMedia': (payload, requestId) => checkMediaSecurityAction(payload, requestId),
  'media.prepareUpload': (payload, requestId) => prepareMediaUpload(payload, requestId),
  'media.resolve': (payload, requestId) => resolveMedia(payload, requestId)
}

exports.main = async (event) => {
  const action = event.action
  const payload = event.payload || {}
  const requestId = event.requestId || ''
  if (action !== 'auth.apple') {
    const invalidClient = await validateClientContext(event.client, requestId)
    if (invalidClient) return invalidClient
  }

  const handler = routes[action]
  if (!handler) {
    return fail(`未知 action: ${action}`, requestId, 404)
  }

  try {
    return await handler(payload, requestId)
  } catch (error) {
    console.error('[improv-api:error]', action, error)
    const message = error && error.errCode
      ? `云开发错误: ${error.errCode}`
      : '服务暂不可用，请稍后再试'
    return fail(message, requestId, 500)
  } finally {
    requestClientContext = null
  }
}
