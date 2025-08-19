/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {createBlob, decode, decodeAudioData} from './utils';
import type {Blob} from '@google/genai';

interface AudioServiceOptions {
  onInputAudio: (blob: Blob) => void;
}

/**
 * Encapsulates all Web Audio API logic for microphone input and audio output.
 */
export class AudioService {
  private onInputAudio: (blob: Blob) => void;

  // Public nodes for visualizers
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  // Private audio contexts and nodes
  private inputAudioContext: AudioContext;
  private outputAudioContext: AudioContext;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private outputSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;

  constructor(options: AudioServiceOptions) {
    this.onInputAudio = options.onInputAudio;

    this.inputAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({sampleRate: 16000});
    this.outputAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({sampleRate: 24000});

    this.inputNode = this.inputAudioContext.createGain();
    this.outputNode = this.outputAudioContext.createGain();

    this.outputNode.connect(this.outputAudioContext.destination);
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  /**
   * Requests microphone access and starts capturing audio.
   */
  public async start(): Promise<void> {
    if (this.mediaStream) {
      return; // Already started
    }

    await this.inputAudioContext.resume();

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    this.sourceNode = this.inputAudioContext.createMediaStreamSource(
      this.mediaStream,
    );
    this.sourceNode.connect(this.inputNode);

    const bufferSize = 256;
    this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
      bufferSize,
      1,
      1,
    );

    this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
      const inputBuffer = audioProcessingEvent.inputBuffer;
      const pcmData = inputBuffer.getChannelData(0);
      this.onInputAudio(createBlob(pcmData));
    };

    this.sourceNode.connect(this.scriptProcessorNode);
    this.scriptProcessorNode.connect(this.inputAudioContext.destination);
  }

  /**
   * Stops capturing audio and releases the microphone.
   */
  public stop(): void {
    if (!this.mediaStream) return;

    if (this.scriptProcessorNode && this.sourceNode) {
      this.scriptProcessorNode.disconnect();
      this.sourceNode.disconnect();
    }

    this.scriptProcessorNode = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Decodes and schedules a chunk of audio data for playback.
   * @param base64Data The base64-encoded audio data to play.
   */
  public async playAudioChunk(base64Data: string): Promise<void> {
    if (this.outputSources.size === 0) {
      this.nextStartTime = this.outputAudioContext.currentTime + 0.1;
    }

    this.nextStartTime = Math.max(
      this.nextStartTime,
      this.outputAudioContext.currentTime,
    );

    const audioBuffer = await decodeAudioData(
      decode(base64Data),
      this.outputAudioContext,
      24000,
      1,
    );

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputNode);
    source.addEventListener('ended', () => {
      this.outputSources.delete(source);
    });

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    this.outputSources.add(source);
  }

  /**
   * Immediately stops all scheduled audio playback.
   */
  public interruptPlayback(): void {
    for (const source of this.outputSources.values()) {
      source.stop();
      this.outputSources.delete(source);
    }
    this.nextStartTime = 0;
  }
}
