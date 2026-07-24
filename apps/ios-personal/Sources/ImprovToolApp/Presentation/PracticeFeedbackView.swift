import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import AVFAudio
import AVKit
import UIKit

struct PracticeFeedbackView: View {
    let material: Material
    @ObservedObject var viewModel: PracticeFeedbackViewModel
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @Environment(\.dismiss) private var dismiss
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var selectedVideoItem: PhotosPickerItem?
    @State private var audioRecorderVisible = false
    @State private var cameraVisible = false
    @State private var cameraMode: CameraCaptureMode = .photo
    @State private var moreVisible = false

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "素材练习复盘")
                if let durationText = viewModel.activeMaterialDurationText {
                    AppCard(padding: 14) {
                        HStack {
                            Text("本次练习时长")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(AppTheme.textSecondary)
                            Spacer()
                            Text(durationText)
                                .font(.headline.weight(.heavy))
                                .foregroundStyle(AppTheme.orange)
                        }
                    }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("关联方式")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.textSecondary)
                        Text(material.title)
                            .font(.title3.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(material.desc)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                            .lineLimit(3)
                    }
                }

                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("本次复盘")
                            .font(.headline.weight(.heavy))
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("评分")
                                        .font(.subheadline.weight(.heavy))
                                        .foregroundStyle(AppTheme.textPrimary)
                                    Text(scoreSummary)
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                }
                                Spacer()
                                VStack(spacing: 0) {
                                    Text("\(viewModel.score)")
                                        .font(.title2.weight(.heavy))
                                        .foregroundStyle(AppTheme.orange)
                                    Text("分")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(AppTheme.orangeSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            HStack(spacing: 12) {
                                scoreStepButton("-") { adjustScore(-1) }
                                VStack(spacing: 6) {
                                    Slider(
                                        value: Binding(
                                            get: { Double(viewModel.score) },
                                            set: { viewModel.score = Int($0.rounded()) }
                                        ),
                                        in: 1...10,
                                        step: 1
                                    )
                                    .tint(AppTheme.orange)
                                    HStack {
                                        Text("1")
                                        Spacer()
                                        Text("5")
                                        Spacer()
                                        Text("10")
                                    }
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTheme.textMuted)
                                }
                                scoreStepButton("+") { adjustScore(1) }
                            }
                        }
                        TextEditor(text: $viewModel.note)
                            .font(.body.weight(.semibold))
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 130)
                            .padding(10)
                            .background(AppTheme.inputBackground, in: RoundedRectangle(cornerRadius: 12))
                        HStack(spacing: 8) {
                            Menu {
                                Button("拍照", systemImage: "camera") {
                                    cameraMode = .photo
                                    cameraVisible = true
                                }
                                Button("拍视频", systemImage: "video") {
                                    cameraMode = .video
                                    cameraVisible = true
                                }
                            } label: {
                                Label("拍摄", systemImage: "camera")
                                    .font(.footnote.weight(.semibold))
                                    .frame(minHeight: 44)
                            }
                            PhotosPicker(selection: $selectedPhotoItem, matching: .any(of: [.images, .videos])) {
                                Text("上传照片或视频")
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(AppTheme.blue)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.82)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(AppTheme.blueSoft, in: Capsule())
                                    .overlay(Capsule().stroke(AppTheme.blue.opacity(0.12), lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .onChange(of: selectedPhotoItem) { _, item in
                                addPickedPracticeItem(item)
                            }

                            PhotosPicker(selection: $selectedVideoItem, matching: .videos) {
                                Text("选视频")
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(AppTheme.blue)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.82)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(AppTheme.blueSoft, in: Capsule())
                                    .overlay(Capsule().stroke(AppTheme.blue.opacity(0.12), lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .onChange(of: selectedVideoItem) { _, item in
                                addPickedPracticeItem(item, type: .video)
                            }
                            SmallPillButton(title: "录音") {
                                audioRecorderVisible = true
                            }
                        }
                        ForEach(viewModel.attachments) { attachment in
                            HStack {
                                Text(attachmentLabel(attachment))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(AppTheme.textSecondary)
                                Spacer()
                                Button("删除") {
                                    viewModel.removeAttachment(id: attachment.id)
                                }
                                .font(.caption.weight(.bold))
                                .foregroundStyle(AppTheme.error)
                            }
                        }
                    }
                }

                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        DisclosureGroup(isExpanded: $moreVisible) {
                            VStack(alignment: .leading, spacing: 12) {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("归属场景")
                                        .font(.subheadline.weight(.heavy))
                                        .foregroundStyle(AppTheme.textPrimary)
                                    Text(viewModel.activeRehearsalTitle.map { "当前排练：\($0)" } ?? "单独练习记录")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 7)
                                        .background(AppTheme.cardBackground, in: Capsule())
                                    if viewModel.activeRehearsalTitle == nil, !viewModel.historicalRehearsals.isEmpty {
                                        Picker("关联历史排练", selection: $viewModel.linkedHistoricalRehearsalId) {
                                            Text("不关联").tag("")
                                            ForEach(viewModel.historicalRehearsals) { rehearsal in
                                                Text(rehearsal.title).tag(rehearsal.id)
                                            }
                                        }
                                        .pickerStyle(.menu)
                                    }
                                    if case .loading = viewModel.historicalState {
                                        ProgressView("加载历史排练")
                                    }
                                    if case .failed(let message) = viewModel.historicalState {
                                        Button(message) {
                                            Task { await viewModel.loadHistoricalRehearsals() }
                                        }
                                        .font(.caption.weight(.semibold))
                                    }
                                }
                                TextField("人数", text: $viewModel.attendance)
                                    .textFieldStyle(AppTextFieldStyle())
                                TextField("下次提醒", text: $viewModel.reminder)
                                    .textFieldStyle(AppTextFieldStyle())
                            }
                            .padding(.top, 10)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("更多信息")
                                    .font(.headline.weight(.heavy))
                                    .foregroundStyle(AppTheme.textPrimary)
                                Text("人数、归属场景和下次提醒")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(AppTheme.textSecondary)
                            }
                        }
                        .tint(AppTheme.blue)
                    }
                }

            }
        }
        .adaptiveTaskInset(layoutMode: adaptiveLayoutMode) {
            AdaptiveTaskPanel {
                SheetActionRow(
                    secondaryTitle: "保存并沉淀",
                    secondaryAction: {
                        Task {
                            if await viewModel.save(material: material, createMethodCard: true) {
                                dismiss()
                            }
                        }
                    },
                    primaryTitle: "保存记录",
                    primaryAction: {
                        Task {
                            if await viewModel.save(material: material) {
                                dismiss()
                            }
                        }
                    },
                    isSecondaryDisabled: viewModel.isSaving,
                    isPrimaryDisabled: viewModel.isSaving
                )
            }
        }
        .overlay(alignment: .bottom) {
            MessageBanner(message: viewModel.message)
                .padding(.bottom, 20)
        }
        .navigationDestination(isPresented: $audioRecorderVisible) {
            AudioRecorderSheet(title: "录音") { url, duration in
                uploadPracticeMedia(url: url, type: .audio, duration: duration)
            }
        }
        .fullScreenCover(isPresented: $cameraVisible) {
            CameraCaptureView(mode: cameraMode) { url, type in
                uploadPracticeMedia(url: url, type: type)
            }
        }
        .task {
            await viewModel.loadHistoricalRehearsals()
        }
        .rootTabBarVisibility(.hidden)
    }

    private var scoreSummary: String {
        if viewModel.score >= 8 { return "很有效" }
        if viewModel.score >= 5 { return "一般" }
        return "需调整"
    }

    private func scoreStepButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.headline.weight(.heavy))
                .foregroundStyle(AppTheme.textPrimary)
                .frame(width: 32, height: 32)
                .background(AppTheme.cardBackground, in: Circle())
                .overlay(Circle().stroke(AppTheme.divider, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func adjustScore(_ delta: Int) {
        viewModel.score = min(10, max(1, viewModel.score + delta))
    }

    private func attachmentLabel(_ attachment: PracticeAttachment) -> String {
        switch attachment.type {
        case .image: "照片"
        case .video: "视频"
        case .audio: "音频"
        }
    }

    private func addPickedPracticeItem(_ item: PhotosPickerItem?, type: AttachmentType) {
        guard let item else { return }
        Task {
            defer {
                if type == .image { selectedPhotoItem = nil } else { selectedVideoItem = nil }
            }
            guard let url = try? await importedMediaURL(from: item, type: type) else { return }
            _ = await viewModel.uploadAttachment(localURL: url, type: type)
        }
    }

    private func addPickedPracticeItem(_ item: PhotosPickerItem?) {
        guard let item else { return }
        let type: AttachmentType = item.supportedContentTypes.contains { $0.conforms(to: .movie) } ? .video : .image
        addPickedPracticeItem(item, type: type)
    }

    private func uploadPracticeMedia(url: URL, type: AttachmentType, duration: TimeInterval? = nil) {
        Task {
            _ = await viewModel.uploadAttachment(localURL: url, type: type, duration: duration)
        }
    }
}
