import Foundation
import Capacitor
import AVFoundation
import Speech

/// Local Capacitor plugin "ClingVoice":
///  - Boss voice: AVSpeechSynthesizer with the best installed MALE English voice (Premium > Enhanced > compact), low pitch, brisk clipped lines.
///  - Voice input: on-device SFSpeechRecognizer with live partial results (WKWebView has no webkitSpeechRecognition).
@objc(ClingVoicePlugin)
public class ClingVoicePlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "ClingVoicePlugin"
    public let jsName = "ClingVoice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "voiceInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognitionAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestRecognitionPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopListening", returnType: CAPPluginReturnPromise)
    ]

    // MARK: - Boss voice (TTS)
    private let synth = AVSpeechSynthesizer()
    private var pendingCall: CAPPluginCall?
    private var remaining = 0
    static let preferred = ["Evan", "Nathan", "Aaron", "Tom", "Reed", "Alex", "Fred"]

    override public func load() { synth.delegate = self }

    static func bestVoice() -> AVSpeechSynthesisVoice? {
        let en = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("en") }
        func q(_ v: AVSpeechSynthesisVoice) -> Int {
            if #available(iOS 16.0, *), v.quality == .premium { return 3 }
            return v.quality == .enhanced ? 2 : 1
        }
        func nameRank(_ v: AVSpeechSynthesisVoice) -> Int {
            let n = v.name.lowercased()
            if let i = preferred.firstIndex(where: { n.hasPrefix($0.lowercased()) }) { return preferred.count - i }
            return 0
        }
        let us = en.filter { $0.language == "en-US" }
        // 1) a preferred male name, best quality first, then preference order
        let named = en.filter { nameRank($0) > 0 }.sorted { (q($0), nameRank($0), $0.language == "en-US" ? 1 : 0) > (q($1), nameRank($1), $1.language == "en-US" ? 1 : 0) }
        if let v = named.first { return v }
        // 2) any male en-US, then any male English
        let male = en.filter { $0.gender == .male }.sorted { (q($0), $0.language == "en-US" ? 1 : 0) > (q($1), $1.language == "en-US" ? 1 : 0) }
        if let v = male.first { return v }
        // 3) any en-US voice
        return us.sorted { q($0) > q($1) }.first ?? AVSpeechSynthesisVoice(language: "en-US")
    }

    @objc func voiceInfo(_ call: CAPPluginCall) {
        guard let v = Self.bestVoice() else { call.resolve(["name": "", "quality": "none"]); return }
        var quality = v.quality == .enhanced ? "enhanced" : "default"
        if #available(iOS 16.0, *), v.quality == .premium { quality = "premium" }
        let male = v.gender == .male || Self.preferred.contains(where: { v.name.lowercased().hasPrefix($0.lowercased()) })
        call.resolve(["name": v.name, "identifier": v.identifier, "language": v.language, "quality": quality, "male": male])
    }

    @objc func speak(_ call: CAPPluginCall) {
        let lines = (call.getArray("lines", String.self) ?? [call.getString("text") ?? ""]).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        guard !lines.isEmpty else { call.resolve(); return }
        let pitch = Float(call.getDouble("pitch") ?? 0.78)
        let rateMul = Float(call.getDouble("rate") ?? 1.06)
        DispatchQueue.main.async {
            if self.synth.isSpeaking { self.synth.stopSpeaking(at: .immediate) }
            self.finishPending()
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try? AVAudioSession.sharedInstance().setActive(true)
            let voice = Self.bestVoice()
            self.pendingCall = call; self.remaining = lines.count
            for line in lines {
                let u = AVSpeechUtterance(string: line)
                u.voice = voice
                u.pitchMultiplier = max(0.5, min(2.0, pitch))
                u.rate = max(AVSpeechUtteranceMinimumSpeechRate, min(AVSpeechUtteranceMaximumSpeechRate, AVSpeechUtteranceDefaultSpeechRate * rateMul))
                u.volume = 1.0
                u.preUtteranceDelay = 0
                u.postUtteranceDelay = 0.14 // short, punchy pause between barked lines
                self.synth.speak(u)
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.synth.stopSpeaking(at: .immediate); self.finishPending(); call.resolve() }
    }

    private func finishPending() { remaining = 0; if let c = pendingCall { pendingCall = nil; c.resolve(["done": true]) } }
    public func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) { remaining -= 1; if remaining <= 0 { finishPending() } }
    public func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) { finishPending() }

    // MARK: - Voice input (speech recognition)
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var recognizer: SFSpeechRecognizer?

    @objc func recognitionAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": SFSpeechRecognizer(locale: Locale(identifier: "en-US"))?.isAvailable ?? false])
    }

    @objc func requestRecognitionPermission(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { call.resolve(["granted": false, "reason": "speech"]); return }
            AVAudioSession.sharedInstance().requestRecordPermission { ok in
                call.resolve(["granted": ok, "reason": ok ? "" : "microphone"])
            }
        }
    }

    @objc func startListening(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.teardown()
            let lang = call.getString("language") ?? "en-US"
            guard let rec = SFSpeechRecognizer(locale: Locale(identifier: lang)), rec.isAvailable else { call.reject("unavailable"); return }
            guard SFSpeechRecognizer.authorizationStatus() == .authorized else { call.reject("not authorized"); return }
            if self.synth.isSpeaking { self.synth.stopSpeaking(at: .immediate) }
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
                try session.setActive(true, options: .notifyOthersOnDeactivation)
                let req = SFSpeechAudioBufferRecognitionRequest()
                req.shouldReportPartialResults = true
                if rec.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
                let input = self.audioEngine.inputNode
                input.removeTap(onBus: 0)
                // Use the hardware input format (outputFormat can be stale after the category switch -> sampleRate assertion crash).
                let hw = input.inputFormat(forBus: 0)
                guard hw.sampleRate > 0, hw.channelCount > 0 else {
                    self.teardown(); call.reject("microphone unavailable"); return
                }
                let fmt = AVAudioFormat(standardFormatWithSampleRate: hw.sampleRate, channels: hw.channelCount) ?? hw
                input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { buf, _ in req.append(buf) }
                self.audioEngine.prepare(); try self.audioEngine.start()
                self.recognizer = rec; self.request = req
                self.task = rec.recognitionTask(with: req) { [weak self] result, error in
                    guard let self = self else { return }
                    if let r = result {
                        self.notifyListeners("partialResults", data: ["matches": [r.bestTranscription.formattedString], "isFinal": r.isFinal])
                    }
                    if error != nil || (result?.isFinal ?? false) {
                        DispatchQueue.main.async { self.teardown(); self.notifyListeners("listeningState", data: ["status": "stopped"]) }
                    }
                }
                self.notifyListeners("listeningState", data: ["status": "started"])
                call.resolve()
            } catch {
                self.teardown(); call.reject("could not start audio: \(error.localizedDescription)")
            }
        }
    }

    @objc func stopListening(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.request?.endAudio(); self.teardown(); call.resolve() }
    }

    private func teardown() {
        task?.cancel(); request?.endAudio()
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        audioEngine.reset()
        request = nil; task = nil; recognizer = nil
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
    }
}
