import SwiftUI
import AVFAudio
import AVKit
import PhotosUI
import UniformTypeIdentifiers
import UIKit
import ImageIO

enum AppTheme {
    static let pageHorizontalPadding: CGFloat = 20
    static let pageMaxContentWidth: CGFloat = 720
    static let bottomBarHeight: CGFloat = 0

    // Compatibility aliases keep existing screens theme-aware while visual roles
    // migrate to the injected AppVisualTheme one by one.
    static var pageBackground: Color { AppVisualTheme.current.pageBackground }
    static var cardBackground: Color { AppVisualTheme.current.cardBackground }
    static var elevatedCardBackground: Color { AppVisualTheme.current.elevatedCardBackground }
    static var inputBackground: Color { AppVisualTheme.current.inputBackground }
    static var inputBorder: Color { AppVisualTheme.current.inputBorder }
    static var textPrimary: Color { AppVisualTheme.current.textPrimary }
    static var textSecondary: Color { AppVisualTheme.current.textSecondary }
    static var textMuted: Color { AppVisualTheme.current.textMuted }
    static var orange: Color { AppVisualTheme.current.primary }
    static var orangeSoft: Color { AppVisualTheme.current.primarySoft }
    static var blue: Color { AppVisualTheme.current.info }
    static var blueSoft: Color { AppVisualTheme.current.infoSoft }
    static var teal: Color { AppVisualTheme.current.success }
    static var divider: Color { AppVisualTheme.current.divider }
    static var warning: Color { AppVisualTheme.current.warning }
    static var error: Color { AppVisualTheme.current.error }
    static var onPrimary: Color { AppVisualTheme.current.onPrimary }
}

struct AppTextFieldStyle: TextFieldStyle {
    @Environment(\.appVisualTheme) private var theme

    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(.body.weight(.semibold))
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(theme.inputBackground, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(theme.inputBorder, lineWidth: 1)
            }
    }
}

struct AppTextEditor: View {
    @Environment(\.appVisualTheme) private var theme
    @Binding var text: String
    let placeholder: String
    var minHeight: CGFloat = 112

    var body: some View {
        TextEditor(text: $text)
            .font(.body.weight(.semibold))
            .scrollContentBackground(.hidden)
            .padding(10)
            .frame(minHeight: minHeight)
            .background(theme.inputBackground, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(theme.inputBorder, lineWidth: 1)
            }
            .overlay(alignment: .topLeading) {
                if text.isEmpty, !placeholder.isEmpty {
                    Text(placeholder)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(theme.textMuted)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 18)
                        .allowsHitTesting(false)
                }
            }
    }
}

extension MethodCard {
    var sourceDisplayLabel: String? {
        switch sourceType {
        case "inspiration": "来自灵感"
        case "practice": "来自练习复盘"
        case "rehearsal": "来自排练复盘"
        case "训练线索": "来自训练线索"
        case "排练线索": "来自排练线索"
        case "manual": "手动创建"
        default: sourceType.isEmpty ? nil : "来自记录"
        }
    }
}

enum AppVisualTheme: String, CaseIterable, Identifiable {
    case inspiration = "灵感"
    case vivid = "现场"

    var id: String { rawValue }

    static var current: AppVisualTheme {
        AppVisualTheme(rawValue: UserDefaults.standard.string(forKey: "improvtool.visualTheme") ?? "") ?? .inspiration
    }

    var pageBackground: Color {
        switch self {
        case .inspiration: Color(uiColor: .systemGroupedBackground)
        case .vivid: Color(red: 0.071, green: 0.075, blue: 0.102)
        }
    }

    var pageBackgroundEnd: Color {
        switch self {
        case .inspiration: Color(uiColor: .systemGroupedBackground)
        case .vivid: Color(red: 0.106, green: 0.102, blue: 0.145)
        }
    }

    var cardBackground: Color {
        switch self {
        case .inspiration: Color(uiColor: .secondarySystemGroupedBackground)
        case .vivid: Color(red: 0.106, green: 0.106, blue: 0.145)
        }
    }

    var textPrimary: Color {
        switch self {
        case .inspiration: .primary
        case .vivid: Color(red: 0.961, green: 0.949, blue: 0.980)
        }
    }

    var textSecondary: Color {
        switch self {
        case .inspiration: .secondary
        case .vivid: Color(red: 0.788, green: 0.765, blue: 0.824)
        }
    }

    var textMuted: Color {
        switch self {
        case .inspiration: Color.secondary.opacity(0.72)
        case .vivid: Color(red: 0.584, green: 0.553, blue: 0.643)
        }
    }

    var primary: Color {
        switch self {
        case .inspiration: Color(red: 1.0, green: 0.61, blue: 0.10)
        case .vivid: Color(red: 0.541, green: 0.388, blue: 0.949)
        }
    }

    var primarySoft: Color {
        switch self {
        case .inspiration: Color(red: 1.0, green: 0.90, blue: 0.70)
        case .vivid: Color(red: 0.541, green: 0.388, blue: 0.949).opacity(0.22)
        }
    }

    var elevatedCardBackground: Color {
        switch self {
        case .inspiration: Color(uiColor: .systemBackground)
        case .vivid: Color(red: 0.141, green: 0.137, blue: 0.192)
        }
    }

    var inputBackground: Color {
        switch self {
        case .inspiration: Color(uiColor: .tertiarySystemFill)
        case .vivid: Color(red: 0.180, green: 0.173, blue: 0.231)
        }
    }

    var inputBorder: Color {
        switch self {
        case .inspiration: Color(uiColor: .separator).opacity(0.22)
        case .vivid: Color.white.opacity(0.14)
        }
    }

    var divider: Color {
        switch self {
        case .inspiration: Color(uiColor: .separator).opacity(0.45)
        case .vivid: Color.white.opacity(0.14)
        }
    }

    var info: Color {
        switch self {
        case .inspiration: Color(red: 0.16, green: 0.50, blue: 0.66)
        case .vivid: Color(red: 0.620, green: 0.709, blue: 0.980)
        }
    }

    var infoSoft: Color {
        switch self {
        case .inspiration: Color(red: 0.86, green: 0.95, blue: 0.98)
        case .vivid: Color(red: 0.620, green: 0.709, blue: 0.980).opacity(0.14)
        }
    }

    var success: Color {
        switch self {
        case .inspiration: Color(red: 0.05, green: 0.75, blue: 0.78)
        case .vivid: Color(red: 0.376, green: 0.831, blue: 0.690)
        }
    }

    var warning: Color {
        switch self {
        case .inspiration: Color(red: 0.72, green: 0.39, blue: 0.05)
        case .vivid: Color(red: 0.945, green: 0.702, blue: 0.431)
        }
    }

    var error: Color {
        switch self {
        case .inspiration: .red
        case .vivid: Color(red: 1.0, green: 0.529, blue: 0.600)
        }
    }

    var onPrimary: Color { .white }
    var overlay: Color { self == .vivid ? Color.black.opacity(0.62) : Color.black.opacity(0.24) }
    var shadow: Color { self == .vivid ? Color.black.opacity(0.30) : Color.black.opacity(0.08) }
    var preferredColorScheme: ColorScheme? { self == .vivid ? .dark : nil }
}

private struct AppVisualThemeKey: EnvironmentKey {
    static let defaultValue = AppVisualTheme.inspiration
}

private struct AdaptiveLayoutModeKey: EnvironmentKey {
    static let defaultValue = AdaptiveLayoutMode.compact
}

extension EnvironmentValues {
    var appVisualTheme: AppVisualTheme {
        get { self[AppVisualThemeKey.self] }
        set { self[AppVisualThemeKey.self] = newValue }
    }

    var adaptiveLayoutMode: AdaptiveLayoutMode {
        get { self[AdaptiveLayoutModeKey.self] }
        set { self[AdaptiveLayoutModeKey.self] = newValue }
    }
}

enum MaterialSourcePreference: String, CaseIterable, Identifiable {
    case all = "全部素材"
    case owned = "只看我的"

    var id: String { rawValue }

    var subtitle: String {
        switch self {
        case .all: "包含公共素材和你创建的素材"
        case .owned: "只在发现页显示你创建的素材"
        }
    }

    var filter: MaterialSourceFilter {
        self == .owned ? .owned : .all
    }
}

@MainActor
final class Holder<Value>: ObservableObject {
    @Published var value: Value?
}

@MainActor
final class RootTabBarVisibility: ObservableObject {
    @Published private(set) var isVisible = true
    private var lastEvaluatedOffset: CGFloat?
    private let directionThreshold: CGFloat = 10

    func update(scrollOffset: CGFloat) {
        let offset = max(0, scrollOffset)
        if offset <= 1 {
            lastEvaluatedOffset = offset
            setVisible(true)
            return
        }
        guard let previous = lastEvaluatedOffset else {
            lastEvaluatedOffset = offset
            return
        }
        let delta = offset - previous
        guard abs(delta) >= directionThreshold else { return }
        lastEvaluatedOffset = offset
        if delta > 0 {
            setVisible(false)
        }
    }

    func reset() {
        lastEvaluatedOffset = nil
        setVisible(true)
    }

    func setVisible(_ visible: Bool) {
        guard isVisible != visible else { return }
        withAnimation(.easeOut(duration: 0.22)) {
            isVisible = visible
        }
    }
}

extension View {
    @ViewBuilder
    func rootTabBarVisibility(_ visibility: Visibility) -> some View {
        if #available(iOS 18.0, *) {
            toolbarVisibility(visibility, for: .tabBar)
        } else {
            toolbar(visibility, for: .tabBar)
        }
    }

    @ViewBuilder
    func adaptiveTaskInset<Inset: View>(
        layoutMode: AdaptiveLayoutMode,
        @ViewBuilder content: () -> Inset
    ) -> some View {
        safeAreaInset(edge: .bottom, spacing: 0, content: content)
    }
}

struct AdaptiveTaskPanel<Content: View>: View {
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 10) { content }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
            .overlay(alignment: .top) {
                Rectangle().fill(AppTheme.divider).frame(height: 1)
            }
    }
}

struct AppPageShell<Content: View>: View {
    @EnvironmentObject private var container: AppContainer
    @EnvironmentObject private var rootTabBar: RootTabBarVisibility
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    let bottomInset: CGFloat
    let topInset: CGFloat
    let tracksRootTabBar: Bool
    let onRefresh: (() async -> Void)?
    @State private var lastDragTranslationY: CGFloat?
    @State private var isUserInteracting = false
    @ViewBuilder var content: () -> Content

    init(
        bottomInset: CGFloat = 32,
        topInset: CGFloat = 14,
        tracksRootTabBar: Bool = false,
        onRefresh: (() async -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.bottomInset = bottomInset
        self.topInset = topInset
        self.tracksRootTabBar = tracksRootTabBar
        self.onRefresh = onRefresh
        self.content = content
    }

    @ViewBuilder
    var body: some View {
        if #available(iOS 18.0, *) {
            pageScrollView
                .onScrollGeometryChange(for: CGFloat.self) { geometry in
                    geometry.contentOffset.y + geometry.contentInsets.top
                } action: { _, offset in
                    guard tracksRootTabBar, adaptiveLayoutMode == .compact, isUserInteracting else { return }
                    rootTabBar.update(scrollOffset: offset)
                }
                .onScrollPhaseChange { _, phase, context in
                    isUserInteracting = phase == .tracking || phase == .interacting
                    guard tracksRootTabBar,
                          adaptiveLayoutMode == .compact,
                          phase == .tracking || phase == .interacting || phase == .decelerating,
                          let velocityY = context.velocity?.dy,
                          abs(velocityY) >= 10
                    else { return }
                    rootTabBar.setVisible(velocityY < 0)
                }
        } else {
            pageScrollView
                .simultaneousGesture(rootTabBarGesture)
        }
    }

    private var pageScrollView: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                content()
                    .padding(.horizontal, AppTheme.pageHorizontalPadding)
                    .padding(.top, topInset)
                    .padding(.bottom, bottomInset)
                    .frame(maxWidth: pageContentMaxWidth, alignment: .top)
            }
            .frame(maxWidth: .infinity)
        }
        .refreshable {
            await onRefresh?()
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(
            LinearGradient(
                colors: [
                    container.theme.pageBackground,
                    container.theme.pageBackgroundEnd
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
    }

    private var rootTabBarGesture: some Gesture {
        DragGesture(minimumDistance: 10)
            .onChanged { value in
                guard tracksRootTabBar, adaptiveLayoutMode == .compact else { return }
                let translationY = value.translation.height
                guard let previous = lastDragTranslationY else {
                    lastDragTranslationY = translationY
                    return
                }
                let delta = translationY - previous
                guard abs(delta) >= 10 else { return }
                lastDragTranslationY = translationY
                rootTabBar.setVisible(delta > 0)
            }
            .onEnded { _ in
                lastDragTranslationY = nil
            }
    }

    private var pageContentMaxWidth: CGFloat {
        .infinity
    }
}

struct AppCard<Content: View>: View {
    @EnvironmentObject private var container: AppContainer
    var padding: CGFloat = 18
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(container.theme.cardBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: container.theme.shadow, radius: 14, x: 0, y: 8)
    }
}
