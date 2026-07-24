const test = require('node:test')
const assert = require('node:assert/strict')
const {
  isSessionRevoked,
  isOwnedExternalMedia,
  mediaSignaturePayload
} = require('./ios-release-policy')

test('exact session revocation rejects only the matching token', () => {
  const revocations = [{ sessionId: 'session-a' }]

  assert.equal(isSessionRevoked(revocations, { jti: 'session-a', iat: 100 }), true)
  assert.equal(isSessionRevoked(revocations, { jti: 'session-b', iat: 100 }), false)
})

test('account-wide revocation rejects old sessions and permits a later login', () => {
  const revocations = [{ sessionId: '*', revokedBefore: 150000 }]

  assert.equal(isSessionRevoked(revocations, { jti: 'old', iat: 100 }), true)
  assert.equal(isSessionRevoked(revocations, { jti: 'new', iat: 151 }), false)
})

test('external media ownership cannot cross account namespaces', () => {
  const fileID = 'improv/ios/ios:user-a/practice.attachment/file.mov'

  assert.equal(isOwnedExternalMedia(fileID, 'ios:user-a'), true)
  assert.equal(isOwnedExternalMedia(fileID, 'ios:user-b'), false)
  assert.equal(isOwnedExternalMedia('https://example.com/file.mov', 'ios:user-a'), false)
})

test('media signature binds method, object, owner and expiration', () => {
  assert.equal(
    mediaSignaturePayload('GET', 'improv/ios/ios:user/file.mov', 'ios:user', 123),
    'GET\nimprov/ios/ios:user/file.mov\nios:user\n123'
  )
  assert.notEqual(
    mediaSignaturePayload('GET', 'improv/ios/ios:user/file.mov', 'ios:user', 123),
    mediaSignaturePayload('DELETE', 'improv/ios/ios:user/file.mov', 'ios:user', 123)
  )
})
