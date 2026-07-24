import SwiftUI
import AVFAudio
import AVKit
import PhotosUI
import UniformTypeIdentifiers
import UIKit
import ImageIO

struct AudioRecorderSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var recorder = AudioRecorderController()
    let title: String
    let onSave: (URL, TimeInterval) -> Void

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: title)
                AppCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(recorder.statusText)
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(recorder.elapsedText)
                            .font(.system(size: 42, weight: .heavy, design: .rounded))
                            .foregroundStyle(recorder.isRecording ? AppTheme.orange : AppTheme.blue)
                            .monospacedDigit()
                        if let message = recorder.message {
                            Text(message)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                }

                HStack(spacing: 12) {
                    if recorder.isRecording {
                        PrimaryButton(title: "停止录音") {
                            recorder.stop()
                        }
                    } else {
                        PrimaryButton(title: recorder.recordedURL == nil ? "开始录音" : "重新录音") {
                            recorder.start()
                        }
                    }
                }

                if recorder.recordedURL != nil {
                    HStack(spacing: 12) {
                        Button("取消") {
                            dismiss()
                        }
                        .font(.headline.weight(.bold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppTheme.divider, in: Capsule())

                        PrimaryButton(title: "保存录音") {
                            guard let url = recorder.recordedURL else { return }
                            onSave(url, recorder.duration)
                            dismiss()
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .onDisappear {
            recorder.cancelIfNeeded()
        }
    }
}

enum CameraCaptureMode {
    case photo
    case video
}

struct CameraCaptureView: UIViewControllerRepresentable {
    let mode: CameraCaptureMode
    let onCapture: (URL, AttachmentType) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        let usesCamera = UIImagePickerController.isSourceTypeAvailable(.camera)
        picker.sourceType = usesCamera ? .camera : .photoLibrary
        picker.mediaTypes = mode == .video ? [UTType.movie.identifier] : [UTType.image.identifier]
        if usesCamera {
            picker.cameraCaptureMode = mode == .video ? .video : .photo
        }
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: CameraCaptureView

        init(parent: CameraCaptureView) {
            self.parent = parent
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            do {
                if let mediaURL = info[.mediaURL] as? URL {
                    parent.onCapture(mediaURL, .video)
                } else if let image = info[.originalImage] as? UIImage,
                          let data = image.jpegData(compressionQuality: 0.88) {
                    let url = FileManager.default.temporaryDirectory
                        .appendingPathComponent("improv-photo-\(UUID().uuidString).jpg")
                    try data.write(to: url, options: .atomic)
                    parent.onCapture(url, .image)
                }
            } catch {
                // The calling screen keeps its draft and can retry capture.
            }
            parent.dismiss()
        }
    }
}

private struct ImportedMediaFile: Transferable {
    let url: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .image) { item in
            SentTransferredFile(item.url)
        } importing: { received in
            try copyImportedFile(received.file)
        }
        FileRepresentation(contentType: .movie) { item in
            SentTransferredFile(item.url)
        } importing: { received in
            try copyImportedFile(received.file)
        }
    }

    private static func copyImportedFile(_ source: URL) throws -> ImportedMediaFile {
        let fileExtension = source.pathExtension.isEmpty ? "bin" : source.pathExtension
        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent("improv-import-\(UUID().uuidString).\(fileExtension)")
        try FileManager.default.copyItem(at: source, to: destination)
        return ImportedMediaFile(url: destination)
    }
}

func importedMediaURL(from item: PhotosPickerItem, type: AttachmentType) async throws -> URL {
    guard let imported = try await item.loadTransferable(type: ImportedMediaFile.self) else {
        throw CocoaError(.fileReadUnknown)
    }
    return imported.url
}

@MainActor
final class AudioRecorderController: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published private(set) var isRecording = false
    @Published private(set) var recordedURL: URL?
    @Published private(set) var duration: TimeInterval = 0
    @Published var message: String?

    private var audioRecorder: AVAudioRecorder?
    private var timer: Timer?
    private var startedAt: Date?

    var statusText: String {
        if isRecording { return "正在录音" }
        if recordedURL != nil { return "录音已完成" }
        return "保存后进入待整理"
    }

    var elapsedText: String {
        let seconds = Int(duration)
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }

    func start() {
        message = nil
        requestPermission { [weak self] allowed in
            guard let self else { return }
            guard allowed else {
                self.message = "需要允许麦克风权限后才能录音。"
                return
            }
            self.startRecording()
        }
    }

    func stop() {
        audioRecorder?.stop()
        finishRecording()
    }

    func cancelIfNeeded() {
        if isRecording {
            audioRecorder?.stop()
        }
        timer?.invalidate()
        timer = nil
        isRecording = false
    }

    private func requestPermission(_ completion: @escaping @MainActor @Sendable (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission { allowed in
                Task { @MainActor in completion(allowed) }
            }
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission { allowed in
                Task { @MainActor in completion(allowed) }
            }
        }
    }

    private func startRecording() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)

            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("improv-audio-\(UUID().uuidString).m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44_100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue
            ]
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.delegate = self
            recorder.record()
            audioRecorder = recorder
            recordedURL = nil
            duration = 0
            startedAt = Date()
            isRecording = true
            timer?.invalidate()
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    guard let self, let startedAt = self.startedAt else { return }
                    self.duration = Date().timeIntervalSince(startedAt)
                }
            }
        } catch {
            message = "录音启动失败，请稍后重试。"
            isRecording = false
        }
    }

    private func finishRecording() {
        timer?.invalidate()
        timer = nil
        guard let recorder = audioRecorder else {
            isRecording = false
            return
        }
        duration = max(duration, recorder.currentTime)
        recordedURL = recorder.url
        audioRecorder = nil
        isRecording = false
        message = "录音会作为音频附件保存。"
    }

    nonisolated func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        Task { @MainActor in
            self.message = "录音保存失败，请重新录制。"
            self.cancelIfNeeded()
        }
    }
}
