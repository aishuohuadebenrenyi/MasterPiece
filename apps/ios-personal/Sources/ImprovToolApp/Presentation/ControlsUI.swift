import SwiftUI

struct DisplayTag: View {
    let title: String
    var tone: Color = AppTheme.blue
    var fill: Color = AppTheme.blueSoft

    var body: some View {
        Text(title)
            .font(.caption2.weight(.bold))
            .foregroundStyle(tone)
            .lineLimit(1)
            .minimumScaleFactor(0.78)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(fill, in: Capsule())
            .overlay(Capsule().stroke(tone.opacity(0.10), lineWidth: 1))
    }
}

struct ActionChip: View {
    @EnvironmentObject private var container: AppContainer
    let title: String
    var selected = false
    var prominent = false
    var compact = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font((compact ? Font.caption : Font.footnote).weight(.semibold))
                .foregroundStyle(selected || prominent ? container.theme.primary : container.theme.info)
                .lineLimit(1)
                .minimumScaleFactor(0.76)
                .padding(.horizontal, compact ? 9 : 11)
                .padding(.vertical, compact ? 5 : 7)
                .background(
                    Capsule()
                        .fill(selected || prominent ? container.theme.primarySoft : container.theme.infoSoft)
                )
                .overlay(
                    Capsule()
                        .stroke((selected || prominent ? container.theme.primary : container.theme.info).opacity(0.16), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .frame(minHeight: compact ? 34 : 44)
    }
}

struct SmallPillButton: View {
    let title: String
    var tone: Color = AppTheme.blue
    var fill: Color = AppTheme.blueSoft
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(tone)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(fill, in: Capsule())
                .overlay(Capsule().stroke(tone.opacity(0.12), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
    }
}

struct PrimaryButton: View {
    @EnvironmentObject private var container: AppContainer
    let title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(container.theme.onPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(container.theme.primary, in: Capsule())
                .shadow(color: container.theme.primary.opacity(0.18), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }
}

struct SheetActionRow: View {
    @EnvironmentObject private var container: AppContainer
    let secondaryTitle: String
    let secondaryAction: () -> Void
    let primaryTitle: String
    let primaryAction: () -> Void
    var secondaryTint = AppTheme.blue
    var secondaryFill = AppTheme.blueSoft
    var isSecondaryDisabled = false
    var isPrimaryDisabled = false

    var body: some View {
        HStack(spacing: 12) {
            Button(action: secondaryAction) {
                Text(secondaryTitle)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(secondaryTint)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(secondaryFill, in: Capsule())
                    .overlay(Capsule().stroke(secondaryTint.opacity(0.16), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(isSecondaryDisabled)

            Button(action: primaryAction) {
                Text(primaryTitle)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(container.theme.onPrimary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(container.theme.primary, in: Capsule())
                    .shadow(color: container.theme.primary.opacity(0.18), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(.plain)
            .disabled(isPrimaryDisabled)
        }
    }
}

private struct FittedSheetHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

struct FittedSheet<Content: View>: View {
    @EnvironmentObject private var container: AppContainer
    private let minimumHeight: CGFloat
    private let maximumHeight: CGFloat
    @State private var contentHeight: CGFloat
    @ViewBuilder private let content: () -> Content

    init(minimumHeight: CGFloat = 300, maximumHeight: CGFloat = 560, @ViewBuilder content: @escaping () -> Content) {
        self.minimumHeight = minimumHeight
        self.maximumHeight = maximumHeight
        _contentHeight = State(initialValue: minimumHeight)
        self.content = content
    }

    var body: some View {
        content()
            .padding(.horizontal, AppTheme.pageHorizontalPadding)
            .padding(.top, 14)
            .padding(.bottom, 24)
            .background(
                GeometryReader { proxy in
                    Color.clear.preference(key: FittedSheetHeightKey.self, value: proxy.size.height)
                }
            )
            .onPreferenceChange(FittedSheetHeightKey.self) { nextHeight in
                contentHeight = min(max(nextHeight, minimumHeight), maximumHeight)
            }
            .background(
                LinearGradient(
                    colors: [container.theme.pageBackground, container.theme.pageBackgroundEnd],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .presentationDetents([.height(contentHeight)])
            .presentationDragIndicator(.visible)
    }
}

struct DraggableFloatingAction<Label: View>: View {
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @Binding var position: CGPoint?
    let action: () -> Void
    @ViewBuilder let label: () -> Label
    @State private var suppressTap = false

    var body: some View {
        GeometryReader { proxy in
            Button {
                guard !suppressTap else { return }
                action()
            } label: {
                label()
            }
            .buttonStyle(.plain)
            .position(resolvedPosition(in: proxy.size))
            .simultaneousGesture(
                DragGesture(minimumDistance: 8)
                    .onChanged { value in
                        suppressTap = true
                        position = constrained(value.location, in: proxy.size)
                    }
                    .onEnded { value in
                        let candidate = constrained(value.location, in: proxy.size)
                        position = CGPoint(
                            x: candidate.x < proxy.size.width / 2 ? minimumX(in: proxy.size) : maximumX(in: proxy.size),
                            y: candidate.y
                        )
                        DispatchQueue.main.async { suppressTap = false }
                    }
            )
        }
    }

    private func minimumX(in size: CGSize) -> CGFloat {
        horizontalMargin(in: size) + 29
    }

    private func maximumX(in size: CGSize) -> CGFloat {
        max(minimumX(in: size), size.width - horizontalMargin(in: size) - 29)
    }

    private func resolvedPosition(in size: CGSize) -> CGPoint {
        constrained(position ?? CGPoint(x: maximumX(in: size), y: max(54, size.height - 52)), in: size)
    }

    private func constrained(_ point: CGPoint, in size: CGSize) -> CGPoint {
        CGPoint(
            x: min(max(point.x, minimumX(in: size)), maximumX(in: size)),
            y: min(max(point.y, 54), max(54, size.height - 52))
        )
    }

    private func horizontalMargin(in size: CGSize) -> CGFloat {
        0
    }
}

struct PageTitle: View {
    @EnvironmentObject private var container: AppContainer
    let title: String
    var centered = false

    var body: some View {
        Text(title)
            .font(.system(size: 32, weight: .heavy, design: .rounded))
            .foregroundStyle(container.theme.textPrimary)
            .frame(maxWidth: .infinity, alignment: centered ? .center : .leading)
    }

}

struct SheetCloseButton: View {
    @Environment(\.appVisualTheme) private var theme
    let accessibilityLabel: String
    let action: () -> Void

    init(accessibilityLabel: String = "关闭", action: @escaping () -> Void) {
        self.accessibilityLabel = accessibilityLabel
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.footnote.weight(.bold))
                .foregroundStyle(theme.textSecondary)
                .frame(width: 32, height: 32)
                .background(theme.elevatedCardBackground, in: Circle())
                .overlay(Circle().stroke(theme.divider, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
        .accessibilityLabel(accessibilityLabel)
    }
}

struct SheetTitleBar: View {
    let title: String
    let closeAccessibilityLabel: String
    let closeAction: () -> Void

    init(
        _ title: String,
        closeAccessibilityLabel: String = "关闭",
        closeAction: @escaping () -> Void
    ) {
        self.title = title
        self.closeAccessibilityLabel = closeAccessibilityLabel
        self.closeAction = closeAction
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            PageTitle(title: title)
            Spacer()
            SheetCloseButton(accessibilityLabel: closeAccessibilityLabel, action: closeAction)
        }
    }
}

struct MessageBanner: View {
    @Environment(\.appVisualTheme) private var theme
    let message: String?

    var body: some View {
        if let message {
            Text(message)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(theme.textPrimary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(theme.elevatedCardBackground.opacity(0.94), in: Capsule())
                .shadow(color: theme.shadow, radius: 12, x: 0, y: 5)
        }
    }
}

struct EmptyStateCard: View {
    let title: String
    let subtitle: String

    var body: some View {
        AppCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(AppTheme.textPrimary)
                Text(subtitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
    }
}

struct LoadingCard: View {
    let title: String

    var body: some View {
        AppCard {
            HStack(spacing: 12) {
                ProgressView()
                    .tint(AppTheme.teal)
                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
            .padding(.vertical, 8)
        }
    }
}

struct FlowWrap<Content: View>: View {
    let spacing: CGFloat
    let rowSpacing: CGFloat
    @ViewBuilder var content: () -> Content

    var body: some View {
        WrappingFlowLayout(spacing: spacing, rowSpacing: rowSpacing) {
            content()
        }
    }
}

private struct WrappingFlowLayout: Layout {
    let spacing: CGFloat
    let rowSpacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .greatestFiniteMagnitude
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + spacing + size.width > maxWidth {
                x = 0
                y += rowHeight + rowSpacing
                rowHeight = 0
            }
            if x > 0 { x += spacing }
            x += size.width
            rowHeight = max(rowHeight, size.height)
        }

        return CGSize(width: proposal.width ?? x, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + spacing + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + rowSpacing
                rowHeight = 0
            }
            if x > bounds.minX { x += spacing }
            subview.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
            x += size.width
            rowHeight = max(rowHeight, size.height)
        }
    }
}

enum AppTab: String, CaseIterable, Identifiable {
    case discover = "发现"
    case record = "记录"
    case mine = "我的"

    var id: String { rawValue }

    var iconName: String {
        switch self {
        case .discover: "square.grid.2x2.fill"
        case .record: "plus.circle.fill"
        case .mine: "person.crop.circle.fill"
        }
    }
}
