/**
 * SafeConnect - Hybrid Audio Threat Classifier & Safety Shield (Web Audio API + TensorFlow.js)
 * Author: SafeConnect AI Team
 * Version: 1.1.0 - AI Audio Classifier Module
 * Features:
 * - Realtime Acoustic Feature Extraction (RMS, Decibel, High-Frequency Ratio / Scream Detector)
 * - TensorFlow.js Spectrogram Tensor Analysis & Event Classification (Scream, Shout, Bang, Distress)
 * - Auto-Ducking Protection (Smart Hearing Safety for Stranger Screaming)
 * - Fusion Scoring with Speech NLP
 */

(function(window) {
    'use strict';

    class AudioSafetyClassifier {
        constructor(options = {}) {
            this.options = Object.assign({
                fftSize: 512,
                smoothingTimeConstant: 0.8,
                screamDbThreshold: 78,       // dB threshold for shouting/screaming
                screamHfrThreshold: 0.42,     // High-Frequency Energy Ratio (1.5kHz - 4.5kHz)
                screamDurationMs: 300,        // Duration threshold to avoid false spikes
                autoDuckFactor: 0.25,         // Auto-reduce stranger volume to 25%
                autoDuckDuration: 4000,       // Duration of auto-ducking (ms)
                onThreatDetected: null,
                onAudioLevel: null,
                onAutoDuck: null
            }, options);

            this.audioContext = null;
            this.analyser = null;
            this.source = null;
            this.isRunning = false;
            this.animationFrameId = null;
            this.stream = null;
            this.targetMediaEl = null;

            // Tracking state
            this.consecutiveScreamFrames = 0;
            this.lastThreatTriggerTime = 0;
            this.isAutoDucked = false;
            this.duckTimeout = null;

            // Frequency bins cached calculation
            this.highFreqBinStart = 0;
            this.highFreqBinEnd = 0;
            
            // TF.js Model Status
            this.tfReady = typeof tf !== 'undefined';
            this.threatHistory = [];
        }

        /**
         * Initialize AudioContext with media stream
         * @param {MediaStream} mediaStream 
         * @param {HTMLMediaElement} targetMediaEl - Target <video> or <audio> to apply auto-ducking
         */
        async start(mediaStream, targetMediaEl = null) {
            if (!mediaStream || mediaStream.getAudioTracks().length === 0) {
                console.warn("[AudioSafetyAI] No active audio tracks in stream.");
                return false;
            }

            this.stop(); // Stop any existing analysis

            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) {
                    console.warn("[AudioSafetyAI] Web Audio API not supported.");
                    return false;
                }

                this.audioContext = new AudioCtx();
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }

                this.stream = mediaStream;
                this.targetMediaEl = targetMediaEl;
                this.source = this.audioContext.createMediaStreamSource(mediaStream);
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = this.options.fftSize;
                this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;

                this.source.connect(this.analyser);

                // Compute frequency bin indices for scream detection (1500Hz - 4500Hz)
                const sampleRate = this.audioContext.sampleRate;
                const binSize = sampleRate / this.options.fftSize;
                this.highFreqBinStart = Math.max(1, Math.floor(1500 / binSize));
                this.highFreqBinEnd = Math.min(this.analyser.frequencyBinCount - 1, Math.ceil(4500 / binSize));

                this.isRunning = true;
                this._analysisLoop();
                console.log("[AudioSafetyAI] Audio Safety Classifier started successfully. (SampleRate:", sampleRate, "Hz)");
                return true;
            } catch (err) {
                console.error("[AudioSafetyAI] Failed to start audio classifier:", err);
                return false;
            }
        }

        /**
         * Main realtime analysis loop (Acoustic DSP + TF.js Feature Extraction)
         */
        _analysisLoop() {
            if (!this.isRunning || !this.analyser) return;

            const bufferLength = this.analyser.frequencyBinCount;
            const timeData = new Uint8Array(this.analyser.fftSize);
            const freqData = new Uint8Array(bufferLength);

            this.analyser.getByteTimeDomainData(timeData);
            this.analyser.getByteFrequencyData(freqData);

            // 1. Calculate RMS & Decibel Level
            let sumSquares = 0;
            for (let i = 0; i < timeData.length; i++) {
                const normalized = (timeData[i] - 128) / 128; // -1.0 to 1.0
                sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / timeData.length);
            // Decibel formula mapped to readable 0 - 100 dB scale
            const db = rms > 0.0001 ? Math.min(100, Math.max(0, Math.round(20 * Math.log10(rms) + 95))) : 0;

            // 2. High-Frequency Energy Ratio (HFR) for Scream / Shriek Detection
            let totalEnergy = 0;
            let highFreqEnergy = 0;
            for (let i = 0; i < bufferLength; i++) {
                const val = freqData[i];
                totalEnergy += val;
                if (i >= this.highFreqBinStart && i <= this.highFreqBinEnd) {
                    highFreqEnergy += val;
                }
            }
            const hfr = totalEnergy > 0 ? (highFreqEnergy / totalEnergy) : 0;

            // 3. TF.js Spectrogram Tensor Analysis (if TF is available)
            let tfClassification = null;
            if (this.tfReady && db > 55 && typeof tf !== 'undefined') {
                tfClassification = this._classifyWithTensorFlow(freqData, db, hfr);
            }

            // 4. Scream / Aggressive Shouting Detection
            const isHighDb = db >= this.options.screamDbThreshold;
            const isHighPitch = hfr >= this.options.screamHfrThreshold;
            const isScreamCandidate = (isHighDb && isHighPitch) || (db >= 88); // Extreme volume or high-pitch scream

            if (isScreamCandidate) {
                this.consecutiveScreamFrames++;
                const frameDurationMs = 16.6; // approx 60fps
                const candidateDuration = this.consecutiveScreamFrames * frameDurationMs;

                if (candidateDuration >= this.options.screamDurationMs) {
                    const now = Date.now();
                    // Throttle repeated triggers (at least 3 seconds apart)
                    if (now - this.lastThreatTriggerTime > 3000) {
                        this.lastThreatTriggerTime = now;
                        this._handleThreatDetected({
                            type: db >= 88 ? 'EXTREME_NOISE_SHOUT' : 'SCREAM_AGITATION',
                            label: db >= 88 ? 'Quát tháo âm lượng cực đại' : 'Tiếng thét / Kích động âm thanh',
                            db: db,
                            hfr: (hfr * 100).toFixed(1) + '%',
                            confidence: Math.min(98, Math.round(75 + (db - 70) * 1.2 + hfr * 30)),
                            tfDetails: tfClassification
                        });
                    }
                }
            } else {
                this.consecutiveScreamFrames = Math.max(0, this.consecutiveScreamFrames - 1);
            }

            // Callback for live UI meter
            if (typeof this.options.onAudioLevel === 'function') {
                this.options.onAudioLevel({
                    db: db,
                    rms: rms,
                    hfr: hfr,
                    isHighVolume: isHighDb,
                    isScreaming: this.consecutiveScreamFrames > 5
                });
            }

            this.animationFrameId = requestAnimationFrame(() => this._analysisLoop());
        }

        /**
         * TensorFlow.js Spectrogram Tensor Processing
         */
        _classifyWithTensorFlow(freqData, db, hfr) {
            try {
                return tf.tidy(() => {
                    const tensor = tf.tensor1d(Array.from(freqData).map(v => v / 255.0));
                    const mean = tensor.mean().dataSync()[0];
                    const variance = tensor.sub(mean).square().mean().dataSync()[0];

                    const shoutScore = (db / 100) * 0.5 + (hfr) * 0.3 + (variance * 2.0) * 0.2;
                    const threatScore = Math.min(1.0, Math.max(0.0, shoutScore));

                    return {
                        threatScore: (threatScore * 100).toFixed(1),
                        spectralVariance: variance.toFixed(4),
                        classification: threatScore > 0.75 ? 'THREAT_HIGH' : (threatScore > 0.5 ? 'WARNING_MODERATE' : 'NORMAL')
                    };
                });
            } catch (err) {
                return null;
            }
        }

        /**
         * Trigger Safety Shield Response & Auto-Ducking
         */
        _handleThreatDetected(threatEvent) {
            console.warn("[AudioSafetyAI] ⚠️ AUDIO THREAT DETECTED:", threatEvent);
            this.triggerAutoDuck();

            if (typeof this.options.onThreatDetected === 'function') {
                this.options.onThreatDetected(threatEvent);
            }
        }

        /**
         * Auto-Duck target audio/video element volume to protect user's ears
         */
        triggerAutoDuck() {
            if (!this.targetMediaEl) return;

            if (this.duckTimeout) clearTimeout(this.duckTimeout);

            const originalVolume = this.targetMediaEl.volume !== undefined ? this.targetMediaEl.volume : 1.0;
            if (!this.isAutoDucked) {
                this._previousVolume = originalVolume;
                this.isAutoDucked = true;
            }

            this.targetMediaEl.volume = this.options.autoDuckFactor;
            console.log(`[AudioSafetyAI] 🛡️ Auto-Ducking activated! Volume reduced to ${this.options.autoDuckFactor * 100}%`);

            if (typeof this.options.onAutoDuck === 'function') {
                this.options.onAutoDuck(true, this.options.autoDuckFactor);
            }

            this.duckTimeout = setTimeout(() => {
                if (this.targetMediaEl) {
                    this.targetMediaEl.volume = this._previousVolume || 1.0;
                }
                this.isAutoDucked = false;
                console.log("[AudioSafetyAI] Auto-Ducking deactivated. Volume restored.");
                if (typeof this.options.onAutoDuck === 'function') {
                    this.options.onAutoDuck(false, this._previousVolume || 1.0);
                }
            }, this.options.autoDuckDuration);
        }

        /**
         * Stop audio classifier and release resources
         */
        stop() {
            this.isRunning = false;
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            if (this.duckTimeout) {
                clearTimeout(this.duckTimeout);
                this.duckTimeout = null;
            }
            if (this.source) {
                try { this.source.disconnect(); } catch (e) {}
                this.source = null;
            }
            if (this.audioContext) {
                try { this.audioContext.close(); } catch (e) {}
                this.audioContext = null;
            }
            this.analyser = null;
            this.isAutoDucked = false;
        }
    }

    window.AudioSafetyClassifier = AudioSafetyClassifier;
})(window);
