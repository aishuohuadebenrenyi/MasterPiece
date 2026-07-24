import SwiftUI
import AuthenticationServices
import UIKit

struct RootTabView: View {
    @EnvironmentObject private var container: AppContainer
    @EnvironmentObject private var networkMonitor: NetworkMonitor
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @SceneStorage("improvtool.selectedTab") private var selectedTabRawValue = AppTab.discover.rawValue
    @StateObject private var tabBarVisibility = RootTabBarVisibility()

    var body: some View {
        let isPad = UIDevice.current.userInterfaceIdiom == .pad
        let layoutMode = AdaptiveLayoutMode.resolve(
            isPad: isPad,
            usesRegularWidth: horizontalSizeClass == .regular
        )

        adaptiveTabView(layoutMode: layoutMode, isPad: isPad)
            .environment(\.adaptiveLayoutMode, layoutMode)
            .rootTabBarVisibility(layoutMode == .compact && tabBarVisibility.isVisible ? .visible : .hidden)
            .onAppear(perform: selectUITestingTabIfNeeded)
    }

    @ViewBuilder
    private func adaptiveTabView(layoutMode: AdaptiveLayoutMode, isPad: Bool) -> some View {
        if #available(iOS 18.0, *), isPad {
            tabView(layoutMode: layoutMode)
                .tabViewStyle(.sidebarAdaptable)
        } else {
            tabView(layoutMode: layoutMode)
        }
    }

    private func tabView(layoutMode: AdaptiveLayoutMode) -> some View {
        TabView(selection: selectedTabBinding) {
            DiscoverView()
                .tabItem {
                    Label(AppTab.discover.rawValue, systemImage: AppTab.discover.iconName)
                        .accessibilityIdentifier("tab.discover")
                }
                .tag(AppTab.discover)

            RecordView()
                .tabItem {
                    Label(AppTab.record.rawValue, systemImage: AppTab.record.iconName)
                        .accessibilityIdentifier("tab.record")
                }
                .tag(AppTab.record)

            MineView(
                openDiscover: { selectedTabRawValue = AppTab.discover.rawValue },
                openRecord: { selectedTabRawValue = AppTab.record.rawValue }
            )
            .tabItem {
                Label(AppTab.mine.rawValue, systemImage: AppTab.mine.iconName)
                    .accessibilityIdentifier("tab.mine")
            }
            .tag(AppTab.mine)
        }
        .tint(container.theme.primary)
        .environment(\.appVisualTheme, container.theme)
        .preferredColorScheme(container.theme.preferredColorScheme)
        .environmentObject(tabBarVisibility)
        .onChange(of: selectedTabRawValue) { _, _ in
            tabBarVisibility.reset()
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if !networkMonitor.isReachable {
                Text("当前网络不可用，未保存的内容会保留在当前页面。")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(AppTheme.onPrimary)
                    .frame(maxWidth: .infinity, minHeight: 36)
                    .background(AppTheme.warning)
                    .accessibilityAddTraits(.isStaticText)
            }
        }
        .overlay {
            if container.launchBlocked {
                ReleaseConfigurationOverlay(message: container.authMessage)
            } else if !container.privacyAccepted {
                PrivacyConsentOverlay(
                    backendMode: container.backendModeLabel,
                    requiresSignIn: container.requiresSignIn,
                    authMessage: container.authMessage,
                    onAgree: container.acceptPrivacy
                )
            } else if container.requiresSignIn {
                SignInRequiredOverlay(
                    message: container.authMessage,
                    onSignIn: { authorization in
                        Task {
                            await container.signInWithApple(authorization: authorization)
                        }
                    }
                )
            }
        }
    }

    private var selectedTabBinding: Binding<AppTab> {
        Binding(
            get: { AppTab(rawValue: selectedTabRawValue) ?? .discover },
            set: { selectedTabRawValue = $0.rawValue }
        )
    }

    private func selectUITestingTabIfNeeded() {
        guard ProcessInfo.processInfo.arguments.contains("--ui-testing"),
              let argument = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--ui-tab=") }),
              let tab = AppTab(rawValue: String(argument.dropFirst("--ui-tab=".count))) else {
            return
        }
        selectedTabRawValue = tab.rawValue
    }
}

private struct ReleaseConfigurationOverlay: View {
    let message: String?

    var body: some View {
        ZStack {
            AppTheme.pageBackground.opacity(0.98)
                .ignoresSafeArea()

            AppCard {
                VStack(alignment: .leading, spacing: 16) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.title)
                        .foregroundStyle(AppTheme.warning)
                        .accessibilityHidden(true)
                    Text("服务暂不可用")
                        .font(.title2.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    Text(message ?? "应用服务尚未完成配置或未使用 HTTPS 端点，请稍后再试。")
                        .font(.body)
                        .foregroundStyle(AppTheme.textSecondary)
                    Text("此页面不会加载或展示本地预览数据。")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(AppTheme.textMuted)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("服务暂不可用。\(message ?? "应用服务尚未完成配置")")
            }
            .frame(maxWidth: 560)
            .padding(.horizontal, 28)
        }
    }
}

private struct PrivacyConsentOverlay: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let backendMode: String
    let requiresSignIn: Bool
    let authMessage: String?
    let onAgree: () -> Void
    @State private var policyVisible = false
    @State private var declined = false

    var body: some View {
        ZStack {
            AppTheme.pageBackground.opacity(0.96)
                .ignoresSafeArea()

            ScrollView {
                AppCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("用户隐私保护提示")
                            .font(.title2.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)

                        Text("请阅读并同意隐私政策后继续使用。即兴工具箱只保存你主动创建或提交的素材、灵感、练习、排练、反馈和个人资料。")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                            .lineSpacing(4)

                        VStack(alignment: .leading, spacing: 8) {
                            privacyLine("数据事实源", backendMode)
                            privacyLine("媒体权限", "仅在你选择照片、拍摄或录音时申请")
                            privacyLine("内容审核", "正式服务端保存前检查文本和媒体")
                            privacyLine("账号删除", "可在“我的 -> 设置”中发起")
                        }
                        if requiresSignIn {
                            Text(authMessage ?? "同意隐私政策后，需要使用 Apple 登录才能写入个人数据。")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }

                        Button("查看隐私政策") {
                            policyVisible = true
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.blue)
                        .frame(minHeight: 44)

                        PrimaryButton(title: "同意并继续") {
                            onAgree()
                        }

                        Button("不同意") {
                            declined = true
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 44)

                        if declined {
                            Text("需要同意隐私政策后才能使用应用。你仍可查看政策并重新选择。")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                }
                .frame(maxWidth: 640)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 28)
                .padding(.vertical, 24)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .sheet(isPresented: $policyVisible) {
            NavigationStack {
                PrivacyPolicyView()
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("完成") { policyVisible = false }
                        }
                    }
            }
            .interactiveDismissDisabled()
        }
    }

    private func privacyLine(_ title: String, _ desc: String) -> some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 4) {
                    privacyLineTitle(title)
                    privacyLineDescription(desc)
                }
            } else {
                HStack(alignment: .top, spacing: 8) {
                    privacyLineTitle(title)
                        .frame(width: 70, alignment: .leading)
                    privacyLineDescription(desc)
                }
            }
        }
    }

    private func privacyLineTitle(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.heavy))
            .foregroundStyle(AppTheme.blue)
    }

    private func privacyLineDescription(_ desc: String) -> some View {
        Text(desc)
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.textSecondary)
    }
}

private struct PrivacyPolicyView: View {
    var body: some View {
        List {
            Section("收集范围") {
                Text("仅处理你主动创建的素材、灵感、练习、排练、反馈和个人资料。")
                Text("相机、相册和麦克风仅在你主动选择相关功能时请求权限。")
            }
            Section("使用与存储") {
                Text("个人数据用于提供记录、复盘、同步和账号服务，不用于与核心功能无关的用途。")
                Text("正式服务端保存前会按服务要求检查文本与媒体内容。")
            }
            Section("你的权利") {
                Text("你可以在“我的 -> 设置”中提交反馈、查看说明或申请删除账号及私有数据。")
            }
        }
        .navigationTitle("隐私政策")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct SignInRequiredOverlay: View {
    let message: String?
    let onSignIn: (ASAuthorization) -> Void

    var body: some View {
        ZStack {
            AppTheme.pageBackground.opacity(0.96)
                .ignoresSafeArea()

            AppCard {
                VStack(alignment: .leading, spacing: 16) {
                    Text("登录后使用个人数据")
                        .font(.title2.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    Text("iOS 个人版使用 Apple 登录建立服务端身份，素材、灵感、练习、排练、反馈和账号删除都会写入 CloudBase。")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineSpacing(4)
                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.fullName]
                    } onCompletion: { result in
                        if case .success(let authorization) = result {
                            onSignIn(authorization)
                        }
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                    if let message {
                        Text(message)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                }
            }
            .frame(maxWidth: 560)
            .padding(.horizontal, 28)
        }
    }
}
