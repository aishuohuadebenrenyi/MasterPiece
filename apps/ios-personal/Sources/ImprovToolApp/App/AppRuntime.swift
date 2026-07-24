import Foundation
import AuthenticationServices
import Network
import Security
import Combine

@MainActor
final class AuthSessionController: ObservableObject {
    enum AuthState: Equatable {
        case localPreview
        case signedOut
        case signingIn
        case signedIn(CloudBaseSession)
        case failed(String)
    }

    @Published private(set) var state: AuthState
    @Published private(set) var statusMessage: String?

    let environment: AppEnvironment
    let credentialStore: any CredentialStore

    init(environment: AppEnvironment, credentialStore: any CredentialStore) {
        self.environment = environment
        self.credentialStore = credentialStore
        if let session = try? credentialStore.readSession(), !session.isExpired {
            state = .signedIn(session)
        } else if let session = try? credentialStore.readSession(), session.isExpired {
            try? credentialStore.clearSession()
            state = environment.requiresAuthentication ? .signedOut : .localPreview
            statusMessage = "登录已过期，请重新登录"
        } else if environment.requiresAuthentication {
            state = .signedOut
        } else {
            state = .localPreview
        }
    }

    var currentSession: CloudBaseSession? {
        if case .signedIn(let session) = state {
            return session
        }
        return nil
    }

    var requiresSignIn: Bool {
        switch state {
        case .signedOut, .signingIn, .failed:
            return environment.requiresAuthentication
        case .localPreview, .signedIn:
            return false
        }
    }

    func signIn(with authorization: ASAuthorization) async {
        guard let endpoint = environment.endpoint else {
            statusMessage = "未配置 CloudBase HTTPS endpoint，当前只能本地预览"
            state = .failed(statusMessage ?? "登录失败")
            return
        }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8)
        else {
            statusMessage = "Apple 登录凭证无效"
            state = .failed(statusMessage ?? "登录失败")
            return
        }
        state = .signingIn
        let fullName = credential.fullName
            .map { PersonNameComponentsFormatter().string(from: $0) }
            .flatMap { $0.isEmpty ? nil : $0 }
        do {
            let session = try await CloudBaseSessionClient(endpoint: endpoint)
                .exchangeAppleIdentity(userId: credential.user, identityToken: identityToken, fullName: fullName)
            try credentialStore.saveSession(session)
            state = .signedIn(session)
            statusMessage = "已登录"
        } catch {
            let message = error.localizedDescription
            state = .failed(message)
            statusMessage = message
        }
    }

    func signOut() {
        do {
            try credentialStore.clearSession()
        } catch {
            statusMessage = error.localizedDescription
        }
        state = environment.requiresAuthentication ? .signedOut : .localPreview
        statusMessage = "已退出登录"
    }
}

enum RuntimeMode: String, Sendable {
    case mock
    case staging
    case production
}

struct AppEnvironment: Sendable {
    let mode: RuntimeMode
    let endpoint: URL?
    let backendLabel: String
    let allowMockFallback: Bool

    var blocksLaunch: Bool {
        mode == .production && !CloudBaseConfiguration.isSecureEndpoint(endpoint)
    }

    var requiresAuthentication: Bool {
        CloudBaseConfiguration.isSecureEndpoint(endpoint) && mode != .mock
    }

    static func resolve(
        processInfo: ProcessInfo = .processInfo,
        bundle: Bundle = .main
    ) -> AppEnvironment {
        let environment = processInfo.environment
        let configuredMode = environment["IMPROV_RUNTIME_MODE"]
            ?? bundle.object(forInfoDictionaryKey: "IMPROV_RUNTIME_MODE") as? String
        let normalizedMode = configuredMode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let endpoint = CloudBaseConfiguration.loadEndpoint(environment: environment)
        let configuredMockFallback = (environment["IMPROV_ALLOW_MOCK_FALLBACK"]
            ?? bundle.object(forInfoDictionaryKey: "IMPROV_ALLOW_MOCK_FALLBACK") as? String
            ?? "0") == "1"
        #if DEBUG
        let allowMockFallback = configuredMockFallback
        #else
        let allowMockFallback = false
        #endif

        let mode: RuntimeMode
        #if DEBUG
        switch normalizedMode {
        case "production": mode = .production
        case "staging": mode = endpoint == nil ? .mock : .staging
        case "mock", "preview": mode = .mock
        default:
            mode = endpoint == nil ? .mock : .staging
        }
        #else
        switch normalizedMode {
        case "staging" where endpoint != nil: mode = .staging
        default: mode = .production
        }
        #endif

        let label: String
        switch mode {
        case .mock:
            label = endpoint == nil ? "本地预览" : "CloudBase 预演"
        case .staging:
            label = "CloudBase 预发布"
        case .production:
            label = endpoint == nil ? "CloudBase 正式环境未配置" : "CloudBase 正式环境"
        }
        return AppEnvironment(mode: mode, endpoint: endpoint, backendLabel: label, allowMockFallback: allowMockFallback)
    }
}

protocol CredentialStore: Sendable {
    func readSession() throws -> CloudBaseSession?
    func saveSession(_ session: CloudBaseSession) throws
    func clearSession() throws
}

struct KeychainCredentialStore: CredentialStore {
    private let service = "improvtool.ios.auth"
    private let account = "cloudbase.session"

    func readSession() throws -> CloudBaseSession? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status != errSecItemNotFound else { return nil }
        guard status == errSecSuccess, let data = item as? Data else {
            throw CredentialStoreError.readFailed(status)
        }
        return try JSONDecoder().decode(CloudBaseSession.self, from: data)
    }

    func saveSession(_ session: CloudBaseSession) throws {
        let data = try JSONEncoder().encode(session)
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account
        ]
        let attributes: [CFString: Any] = [
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var addAttributes = query
            attributes.forEach { addAttributes[$0.key] = $0.value }
            let addStatus = SecItemAdd(addAttributes as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw CredentialStoreError.writeFailed(addStatus)
            }
        } else if updateStatus != errSecSuccess {
            throw CredentialStoreError.writeFailed(updateStatus)
        }
    }

    func clearSession() throws {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw CredentialStoreError.deleteFailed(status)
        }
    }
}

enum CredentialStoreError: LocalizedError {
    case readFailed(OSStatus)
    case writeFailed(OSStatus)
    case deleteFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .readFailed: return "读取登录状态失败"
        case .writeFailed: return "保存登录状态失败"
        case .deleteFailed: return "清理登录状态失败"
        }
    }
}

@MainActor
final class NetworkMonitor: ObservableObject {
    @Published private(set) var isReachable = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "improvtool.network.monitor")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isReachable = path.status == .satisfied
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
