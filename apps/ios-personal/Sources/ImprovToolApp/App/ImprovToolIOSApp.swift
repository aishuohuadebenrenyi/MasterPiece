import SwiftUI
import AuthenticationServices

@main
struct ImprovToolIOSApp: App {
    @StateObject private var container = AppContainer()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environmentObject(container)
                .environmentObject(container.networkMonitor)
                .environmentObject(container.authController)
        }
    }
}

@MainActor
final class AppContainer: ObservableObject {
    @Published var theme: AppVisualTheme {
        didSet {
            UserDefaults.standard.set(theme.rawValue, forKey: Self.themeStorageKey)
        }
    }
    @Published var privacyAccepted: Bool {
        didSet {
            UserDefaults.standard.set(privacyAccepted, forKey: Self.privacyStorageKey)
        }
    }
    @Published var materialSourcePreference: MaterialSourcePreference {
        didSet {
            UserDefaults.standard.set(materialSourcePreference.rawValue, forKey: Self.materialSourceStorageKey)
        }
    }
    @Published private(set) var backendModeLabel: String
    @Published private(set) var authMessage: String?
    @Published private(set) var requiresSignIn = false
    @Published private(set) var launchBlocked = false

    private(set) var repository: any AppRepository
    private(set) var mediaRepository: any MediaUploadRepository
    private(set) var mediaPlaybackRepository: any MediaPlaybackResourceRepository
    let sessionStore = TaskSessionStore()
    let environment: AppEnvironment
    let networkMonitor = NetworkMonitor()
    let authController: AuthSessionController

    private static let themeStorageKey = "improvtool.visualTheme"
    private static let privacyStorageKey = "improvtool.privacyAccepted"
    private static let materialSourceStorageKey = "improvtool.materialSourcePreference"

    init() {
        let savedTheme = UserDefaults.standard.string(forKey: Self.themeStorageKey)
        theme = AppVisualTheme(rawValue: savedTheme ?? "") ?? .inspiration
        #if DEBUG
        let isUITesting = ProcessInfo.processInfo.arguments.contains("--ui-testing")
        privacyAccepted = isUITesting || UserDefaults.standard.bool(forKey: Self.privacyStorageKey)
        #else
        privacyAccepted = UserDefaults.standard.bool(forKey: Self.privacyStorageKey)
        #endif
        let savedMaterialSource = UserDefaults.standard.string(forKey: Self.materialSourceStorageKey)
        materialSourcePreference = MaterialSourcePreference(rawValue: savedMaterialSource ?? "") ?? .all
        environment = AppEnvironment.resolve()
        let credentialStore = KeychainCredentialStore()
        let authController = AuthSessionController(environment: environment, credentialStore: credentialStore)
        self.authController = authController
        backendModeLabel = environment.backendLabel

        if environment.blocksLaunch {
            let mock = MockAppRepository()
            repository = mock
            mediaRepository = mock
            mediaPlaybackRepository = mock
            launchBlocked = true
            authMessage = "正式构建未配置 CloudBase HTTPS endpoint，无法提供数据服务。请联系应用提供方。"
            return
        }

        switch authController.state {
        case .signedIn(let session):
            if let endpoint = environment.endpoint {
                let configuration = CloudBaseConfiguration(endpoint: endpoint, session: session)
                let remote = CloudBaseRemoteRepository(configuration: configuration)
                repository = remote
                mediaRepository = remote
                mediaPlaybackRepository = remote
                requiresSignIn = false
            } else {
                let mock = MockAppRepository()
                repository = mock
                mediaRepository = mock
                mediaPlaybackRepository = mock
                requiresSignIn = true
            }
            authMessage = authController.statusMessage
        case .signedOut, .signingIn, .failed:
            if environment.mode == .mock || environment.allowMockFallback {
                let mock = MockAppRepository()
                repository = mock
                mediaRepository = mock
                mediaPlaybackRepository = mock
                requiresSignIn = false
            } else {
                let mock = MockAppRepository()
                repository = mock
                mediaRepository = mock
                mediaPlaybackRepository = mock
                requiresSignIn = authController.requiresSignIn
            }
            authMessage = authController.statusMessage
        case .localPreview:
            let mock = MockAppRepository()
            repository = mock
            mediaRepository = mock
            mediaPlaybackRepository = mock
            requiresSignIn = false
            authMessage = nil
        }
    }

    func acceptPrivacy() {
        privacyAccepted = true
    }

    func signInWithApple(authorization: ASAuthorization) async {
        await authController.signIn(with: authorization)
        syncRepositoriesWithAuthState()
    }

    func signOut() {
        authController.signOut()
        syncRepositoriesWithAuthState()
    }

    func accountWasDeleted() {
        sessionStore.finishMaterialSession()
        sessionStore.finishRehearsal()
        signOut()
    }

    private func syncRepositoriesWithAuthState() {
        guard !environment.blocksLaunch else { return }
        switch authController.state {
        case .signedIn(let session):
            guard let endpoint = environment.endpoint else { return }
            let configuration = CloudBaseConfiguration(endpoint: endpoint, session: session)
            let remote = CloudBaseRemoteRepository(configuration: configuration)
            repository = remote
            mediaRepository = remote
            mediaPlaybackRepository = remote
            backendModeLabel = environment.backendLabel
            requiresSignIn = false
        case .localPreview:
            let mock = MockAppRepository()
            repository = mock
            mediaRepository = mock
            mediaPlaybackRepository = mock
            backendModeLabel = environment.backendLabel
            requiresSignIn = false
        case .signedOut, .signingIn, .failed:
            let mock = MockAppRepository()
            repository = mock
            mediaRepository = mock
            mediaPlaybackRepository = mock
            backendModeLabel = environment.backendLabel
            requiresSignIn = authController.requiresSignIn
        }
        authMessage = authController.statusMessage
    }

    func makeDiscoverViewModel() -> DiscoverViewModel {
        DiscoverViewModel(materialRepository: repository, practiceRepository: repository, sessionStore: sessionStore)
    }

    func makeRecordViewModel() -> RecordViewModel {
        RecordViewModel(
            inspirationRepository: repository,
            materialRepository: repository,
            practiceRepository: repository,
            rehearsalRepository: repository,
            methodCardRepository: repository,
            mediaRepository: mediaRepository,
            sessionStore: sessionStore
        )
    }

    func makePracticeFeedbackViewModel() -> PracticeFeedbackViewModel {
        PracticeFeedbackViewModel(
            practiceRepository: repository,
            methodCardRepository: repository,
            rehearsalRepository: repository,
            mediaRepository: mediaRepository,
            sessionStore: sessionStore
        )
    }

    func makeRehearsalViewModel() -> RehearsalViewModel {
        RehearsalViewModel(
            rehearsalRepository: repository,
            materialRepository: repository,
            inspirationRepository: repository,
            methodCardRepository: repository,
            sessionStore: sessionStore
        )
    }

    func makeMineViewModel() -> MineViewModel {
        MineViewModel(
            inspirationRepository: repository,
            practiceRepository: repository,
            rehearsalRepository: repository,
            methodCardRepository: repository,
            materialRepository: repository,
            profileRepository: repository,
            feedbackRepository: repository,
            accountRepository: repository,
            mediaRepository: mediaRepository
        )
    }
}
