function isSessionRevoked(revocations, sessionPayload) {
  return revocations.some(item => item.sessionId === sessionPayload.jti || (
    item.sessionId === '*' && Number(item.revokedBefore || 0) >= Number(sessionPayload.iat || 0) * 1000
  ))
}

function ownedExternalMediaPrefix(ownerOpenId) {
  return `improv/ios/${ownerOpenId}/`
}

function isOwnedExternalMedia(fileID, ownerOpenId) {
  return typeof fileID === 'string' && fileID.startsWith(ownedExternalMediaPrefix(ownerOpenId))
}

function mediaSignaturePayload(method, fileID, ownerOpenId, expiresAt) {
  return `${method}\n${fileID}\n${ownerOpenId}\n${expiresAt}`
}

module.exports = {
  isSessionRevoked,
  isOwnedExternalMedia,
  mediaSignaturePayload,
  ownedExternalMediaPrefix
}
