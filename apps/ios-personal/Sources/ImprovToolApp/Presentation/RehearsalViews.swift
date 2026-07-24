import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import AVFAudio
import AVKit
import UIKit

struct RehearsalView: View {
    @ObservedObject var viewModel: RehearsalViewModel
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @Environment(\.dismiss) private var dismiss
    @State private var activeSheet: RehearsalSheet?
    @State private var selectedMaterial: Material?
    @State private var materialPresented = false
    @State private var reviewPresented = false

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "排练")
                if let rehearsal = viewModel.rehearsal {
                    AppCard {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("本次排练")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                    Text("\(rehearsal.title) · \(rehearsal.duration)")
                                        .font(.title3.weight(.heavy))
                                    Text("目标：\(rehearsal.goals.joined(separator: " / "))")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                    Text("\(rehearsal.plan.count) 条素材 · \(rehearsal.status.rawValue)")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(AppTheme.blue)
                                        .padding(.horizontal, 9)
                                        .padding(.vertical, 5)
                                        .background(AppTheme.blueSoft, in: Capsule())
                                }
                                Spacer()
                                SmallPillButton(title: "编辑") {
                                    activeSheet = .plan
                                }
                            }
                        }
                    }

                    AppCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("速记与灵感")
                                .font(.headline.weight(.heavy))
                            HStack {
                                TextField("记下现场发现", text: $viewModel.quickNote, axis: .vertical)
                                    .textFieldStyle(AppTextFieldStyle())
                                SmallPillButton(title: "保存") {
                                    Task { _ = await viewModel.saveLinkedInspiration() }
                                }
                            }
                            ForEach(viewModel.linkedInspirations.prefix(3)) { inspiration in
                                Text(inspiration.desc)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(AppTheme.textSecondary)
                            }
                        }
                    }

                    AppCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("素材计划与反馈")
                                    .font(.headline.weight(.heavy))
                                Spacer()
                                SmallPillButton(title: "加素材") {
                                    activeSheet = .addMaterial
                                }
                            }
                            if rehearsal.plan.isEmpty {
                                EmptyStateCard(title: "先加素材", subtitle: "加入 1-3 条即可开始记录。")
                            } else {
                                ForEach(Array(rehearsal.plan.enumerated()), id: \.element.id) { index, item in
                                    RehearsalPlanCard(
                                        index: index + 1,
                                        item: item,
                                        material: viewModel.material(for: item.materialId),
                                        materialTitle: viewModel.materialTitle(for: item.materialId),
                                        onDetail: {
                                            selectedMaterial = viewModel.material(for: item.materialId)
                                            materialPresented = selectedMaterial != nil
                                        },
                                        onToggleStatus: {
                                            Task { await viewModel.cyclePlanStatus(materialId: item.materialId) }
                                        },
                                        onSaveFeedback: { keep, tryNext in
                                            Task { await viewModel.updatePlan(materialId: item.materialId, keep: keep, tryNext: tryNext) }
                                        }
                                    )
                                }
                            }
                        }
                    }

                } else {
                    EmptyStateCard(title: "没有进行中的排练", subtitle: "从记录页快速开启排练后，会在这里继续。")
                }
            }
        }
        .adaptiveTaskInset(layoutMode: adaptiveLayoutMode) {
            if let rehearsal = viewModel.rehearsal {
                AdaptiveTaskPanel {
                    SmallPillButton(title: rehearsal.status == .paused ? "继续排练" : "暂停") {
                        Task {
                            guard await viewModel.pauseOrResume() else { return }
                            if viewModel.rehearsal?.status == .paused { dismiss() }
                        }
                    }
                    PrimaryButton(title: "结束并复盘") {
                        reviewPresented = true
                    }
                }
                .disabled(viewModel.isSaving)
            }
        }
        .task {
            await viewModel.refreshFromSession()
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .addMaterial:
                RehearsalAddMaterialSheet(viewModel: viewModel)
            case .plan:
                RehearsalPlanSheet(viewModel: viewModel)
            case .feedback(let item):
                RehearsalItemFeedbackSheet(item: item, viewModel: viewModel)
            }
        }
        .navigationDestination(isPresented: $materialPresented) {
            if let selectedMaterial {
                MaterialDetailHostView(material: selectedMaterial)
            }
        }
        .navigationDestination(isPresented: $reviewPresented) {
            RehearsalReviewView(viewModel: viewModel)
        }
        .overlay(alignment: .bottom) {
            MessageBanner(message: viewModel.message)
                .padding(.bottom, 20)
        }
        .rootTabBarVisibility(.hidden)
    }
}

private struct RehearsalPlanCard: View {
    let index: Int
    let item: RehearsalPlanItem
    let material: Material?
    let materialTitle: String
    let onDetail: () -> Void
    let onToggleStatus: () -> Void
    let onSaveFeedback: (String, String) -> Void
    @State private var keep: String
    @State private var tryNext: String

    init(
        index: Int,
        item: RehearsalPlanItem,
        material: Material?,
        materialTitle: String,
        onDetail: @escaping () -> Void,
        onToggleStatus: @escaping () -> Void,
        onSaveFeedback: @escaping (String, String) -> Void
    ) {
        self.index = index
        self.item = item
        self.material = material
        self.materialTitle = materialTitle
        self.onDetail = onDetail
        self.onToggleStatus = onToggleStatus
        self.onSaveFeedback = onSaveFeedback
        _keep = State(initialValue: item.keep)
        _tryNext = State(initialValue: item.tryNext)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Text("\(index)")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(AppTheme.textPrimary)
                    .frame(width: 34, height: 34)
                    .background(AppTheme.orangeSoft, in: Circle())
                VStack(alignment: .leading, spacing: 6) {
                    Text(materialTitle)
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    Text(metaText)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineLimit(2)
                }
                Spacer()
                SmallPillButton(title: "详情", action: onDetail)
            }

            HStack(spacing: 10) {
                SmallPillButton(title: item.status.rawValue, tone: AppTheme.orange, fill: AppTheme.orangeSoft, action: onToggleStatus)
                Text("Keep / Try")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.orange)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(AppTheme.orangeSoft, in: Capsule())
                Spacer()
            }

            VStack(spacing: 10) {
                TextField("Keep：有效的瞬间", text: $keep)
                    .textFieldStyle(AppTextFieldStyle())
                    .onSubmit { onSaveFeedback(keep, tryNext) }
                TextField("Try：下次调整", text: $tryNext)
                    .textFieldStyle(AppTextFieldStyle())
                    .onSubmit { onSaveFeedback(keep, tryNext) }
                SmallPillButton(title: "保存 Keep / Try", tone: AppTheme.orange, fill: AppTheme.orangeSoft) {
                    onSaveFeedback(keep, tryNext)
                }
            }
        }
        .padding(14)
        .background(AppTheme.cardBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var metaText: String {
        let tags = (material?.tags ?? []).prefix(2).joined(separator: " · ")
        let abilities = (material?.abilities ?? []).prefix(2).joined(separator: " · ")
        return [material?.type.rawValue ?? "", tags, abilities].filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

private struct RehearsalMaterialDetailSheet: View {
    let material: Material
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: material.title)
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(material.type.rawValue)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.blue)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(AppTheme.blueSoft, in: Capsule())
                        Text(material.desc)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                }
                if !material.steps.isEmpty {
                    AppCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("训练步骤")
                                .font(.headline.weight(.heavy))
                            ForEach(Array(material.steps.enumerated()), id: \.offset) { index, step in
                                Text("\(index + 1). \(step)")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(AppTheme.textSecondary)
                            }
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

private enum RehearsalSheet: Identifiable {
    case addMaterial
    case plan
    case feedback(RehearsalPlanItem)

    var id: String {
        switch self {
        case .addMaterial: "addMaterial"
        case .plan: "plan"
        case .feedback(let item): "feedback-\(item.materialId)"
        }
    }
}

private struct RehearsalAddMaterialSheet: View {
    @ObservedObject var viewModel: RehearsalViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var visibleMaterials: [Material] {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidates = viewModel.materials.filter { material in
            !(viewModel.rehearsal?.plan.contains(where: { $0.materialId == material.id }) ?? false)
        }
        guard !clean.isEmpty else { return candidates }
        return candidates.filter { material in
            ([material.title, material.desc] + material.tags + material.abilities + material.scenes)
                .joined(separator: " ")
                .localizedCaseInsensitiveContains(clean)
        }
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "添加到排练")
                AppCard(padding: 14) {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(AppTheme.textSecondary)
                        TextField("搜索素材、能力或目标", text: $query)
                            .font(.subheadline.weight(.semibold))
                    }
                }
                if visibleMaterials.isEmpty {
                    EmptyStateCard(title: viewModel.materials.isEmpty ? "还没有素材库" : "没有可添加素材", subtitle: viewModel.materials.isEmpty ? "先到发现页添加素材。" : "已加入或搜索无结果。")
                } else {
                    ForEach(visibleMaterials) { material in
                        AppCard {
                            HStack {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(material.title)
                                        .font(.headline.weight(.heavy))
                                        .foregroundStyle(AppTheme.textPrimary)
                                    Text(material.desc)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                        .lineLimit(2)
                                }
                                Spacer()
                                SmallPillButton(title: "加入") {
                                    Task {
                                        await viewModel.addMaterialToPlan(materialId: material.id)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}

private struct RehearsalPlanSheet: View {
    @ObservedObject var viewModel: RehearsalViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var duration: String
    @State private var selectedGoals: Set<String>
    @State private var customGoal = ""

    init(viewModel: RehearsalViewModel) {
        self.viewModel = viewModel
        let rehearsal = viewModel.rehearsal
        _title = State(initialValue: rehearsal?.title ?? "今日排练")
        _duration = State(initialValue: rehearsal?.duration ?? "60 分钟")
        _selectedGoals = State(initialValue: Set(rehearsal?.goals ?? []))
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "调整排练计划")
                if let rehearsal = viewModel.rehearsal {
                    AppCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("当前排练")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(AppTheme.textSecondary)
                            Text("\(rehearsal.title) · \(rehearsal.duration)")
                                .font(.headline.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                            Text(rehearsal.goals.joined(separator: " / "))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        TextField("排练名称", text: $title)
                            .textFieldStyle(AppTextFieldStyle())
                        TextField("时长", text: $duration)
                            .textFieldStyle(AppTextFieldStyle())
                        Text("目标")
                            .font(.headline.weight(.heavy))
                        FlowWrap(spacing: 8, rowSpacing: 8) {
                            ForEach(["身体到场", "关系建立", "叙事", "演出前", "复盘"], id: \.self) { goal in
                                ActionChip(title: goal, selected: selectedGoals.contains(goal)) {
                                    toggleGoal(goal)
                                }
                            }
                        }
                        HStack {
                            TextField("自定义目标", text: $customGoal)
                                .textFieldStyle(AppTextFieldStyle())
                            SmallPillButton(title: "添加") {
                                let clean = customGoal.trimmingCharacters(in: .whitespacesAndNewlines)
                                if !clean.isEmpty {
                                    selectedGoals.insert(clean)
                                    customGoal = ""
                                }
                            }
                        }
                    }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("素材计划")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        if let rehearsal = viewModel.rehearsal, !rehearsal.plan.isEmpty {
                            ForEach(Array(rehearsal.plan.enumerated()), id: \.element.id) { index, item in
                                HStack(alignment: .center, spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("\(index + 1). \(viewModel.materialTitle(for: item.materialId))")
                                            .font(.subheadline.weight(.heavy))
                                            .foregroundStyle(AppTheme.textPrimary)
                                        Text(item.status.rawValue)
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(AppTheme.textSecondary)
                                    }
                                    Spacer()
                                    SmallPillButton(title: "切换状态") {
                                        Task { await viewModel.cyclePlanStatus(materialId: item.materialId) }
                                    }
                                }
                                if item.id != rehearsal.plan.last?.id {
                                    Divider()
                                }
                            }
                        } else {
                            EmptyStateCard(title: "还没有排练计划", subtitle: "先添加素材。")
                        }
                    }
                }
                PrimaryButton(title: "保存计划") {
                    Task {
                        await viewModel.updateRehearsalInfo(title: title, duration: duration, goals: Array(selectedGoals))
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func toggleGoal(_ goal: String) {
        if selectedGoals.contains(goal) {
            selectedGoals.remove(goal)
        } else {
            selectedGoals.insert(goal)
        }
    }
}

private struct RehearsalItemFeedbackSheet: View {
    let item: RehearsalPlanItem
    @ObservedObject var viewModel: RehearsalViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var keep: String
    @State private var tryNext: String

    init(item: RehearsalPlanItem, viewModel: RehearsalViewModel) {
        self.item = item
        self.viewModel = viewModel
        _keep = State(initialValue: item.keep)
        _tryNext = State(initialValue: item.tryNext)
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "素材反馈")
                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(viewModel.materialTitle(for: item.materialId))
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        TextField("Keep", text: $keep)
                            .textFieldStyle(AppTextFieldStyle())
                        TextField("Try", text: $tryNext)
                            .textFieldStyle(AppTextFieldStyle())
                    }
                }
                PrimaryButton(title: "保存反馈") {
                    Task {
                        await viewModel.updatePlan(materialId: item.materialId, keep: keep, tryNext: tryNext)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

private struct RehearsalReviewView: View {
    @ObservedObject var viewModel: RehearsalViewModel
    @State private var keep = ""
    @State private var tryNext = ""
    @State private var reminder = ""
    @State private var selectedDirections: Set<String> = ["带领提醒"]
    @State private var completedRehearsal: Rehearsal?

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                if let completedRehearsal {
                    PageTitle(title: "排练记录")
                    AppCard {
                        VStack(alignment: .leading, spacing: 12) {
                            DisplayTag(title: "已完成")
                            Text(completedRehearsal.title)
                                .font(.title3.weight(.heavy))
                            Text("Keep：\(completedRehearsal.reviewKeep)")
                                .font(.subheadline.weight(.semibold))
                            Text("Try：\(completedRehearsal.reviewTry)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                    ShareLink(item: shareText) {
                        Label("分享复盘", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                } else {
                PageTitle(title: "排练复盘")
                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        TextField("整体 Keep", text: $keep)
                            .textFieldStyle(AppTextFieldStyle())
                        TextField("整体 Try", text: $tryNext)
                            .textFieldStyle(AppTextFieldStyle())
                        TextField("下次提醒", text: $reminder)
                            .textFieldStyle(AppTextFieldStyle())
                    }
                }

                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("沉淀方向")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        FlowWrap(spacing: 8, rowSpacing: 8) {
                            ForEach(["带领提醒", "游戏调整", "下次计划"], id: \.self) { direction in
                                ActionChip(title: direction, selected: selectedDirections.contains(direction)) {
                                    toggleDirection(direction)
                                }
                            }
                        }
                    }
                }

                HStack(spacing: 12) {
                    ShareLink(item: shareText) {
                        Text("分享复盘")
                            .font(.headline.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .tint(AppTheme.blue)
                    Button("沉淀为方法卡") {
                        Task {
                            completedRehearsal = await viewModel.complete(
                                keep: keep,
                                tryNext: reviewTryText,
                                reminder: reminder,
                                createMethodCard: true
                            )
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(AppTheme.orange)
                    PrimaryButton(title: "保存复盘") {
                        Task {
                            completedRehearsal = await viewModel.complete(
                                keep: keep,
                                tryNext: reviewTryText,
                                reminder: reminder,
                                createMethodCard: false
                            )
                        }
                    }
                }
                .disabled(viewModel.isSaving)
                }
            }
        }
        .rootTabBarVisibility(.hidden)
    }

    private var reviewTryText: String {
        tryNext
    }

    private var methodTitle: String {
        let base = viewModel.rehearsal?.title ?? "排练复盘"
        let direction = selectedDirections.first ?? "带领提醒"
        return "\(base) · \(direction)"
    }

    private var shareText: String {
        let title = viewModel.rehearsal?.title ?? "排练复盘"
        return "\(title)\nKeep: \(keep)\nTry: \(reviewTryText)"
    }

    private func toggleDirection(_ direction: String) {
        if selectedDirections.contains(direction) {
            selectedDirections.remove(direction)
        } else {
            selectedDirections.insert(direction)
        }
    }
}

private struct RehearsalInsightSheet: View {
    let title: String
    let desc: String
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "个人沉淀")
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("带领提醒")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.orange)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(AppTheme.orangeSoft, in: Capsule())
                        Text(title)
                            .font(.title3.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(desc.isEmpty ? "下次排练前回看这张方法卡。" : desc)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                }
                PrimaryButton(title: "保存为方法卡") {
                    onSave()
                    dismiss()
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}
