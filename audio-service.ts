/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {createBlob, decode, decodeAudioData} from './utils';
import type {Blob} from '@google/genai';

interface AudioServiceOptions {
  onInputAudio: (blob: Blob) => void;
}

const pcmProcessorWorklet = `
class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    // We expect one input, with one channel, of Float32Array data.
    const inputChannelData = inputs[0]?.[0];

    // If there's no data, don't do anything.
    if (inputChannelData) {
      // Post the raw PCM data back to the main thread.
      // The data is a Float32Array, which will be cloned.
      this.port.postMessage(inputChannelData);
    }
    
    return true; // Keep processor alive
  }
}

registerProcessor('pcm-processor', PcmProcessor);
`;

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
  private audioWorkletNode: AudioWorkletNode | null = null;
  private outputSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private workletModuleAdded = false;

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

    if (this.inputAudioContext.state === 'suspended') {
      await this.inputAudioContext.resume();
    }

    if (!this.inputAudioContext.audioWorklet) {
      throw new Error('AudioWorklet is not supported by this browser.');
    }

    if (!this.workletModuleAdded) {
      const blob = new Blob([pcmProcessorWorklet], {
        type: 'application/javascript',
      });
      const workletURL = URL.createObjectURL(blob);

      try {
        await this.inputAudioContext.audioWorklet.addModule(workletURL);
        this.workletModuleAdded = true;
      } catch (e) {
        console.error('Error adding audio worklet module', e);
        throw e;
      } finally {
        URL.revokeObjectURL(workletURL);
      }
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
      },
      video: false,
    });

    this.sourceNode = this.inputAudioContext.createMediaStreamSource(
      this.mediaStream,
    );

    this.audioWorkletNode = new AudioWorkletNode(
      this.inputAudioContext,
      'pcm-processor',
    );

    this.audioWorkletNode.port.onmessage = (event) => {
      const pcmData = event.data; // This is a Float32Array
      this.onInputAudio(createBlob(pcmData));
    };

    // The visualizer taps into `inputNode`. The worklet also gets data from it.
    this.sourceNode.connect(this.inputNode);
    this.inputNode.connect(this.audioWorkletNode);
    // The worklet node does not need to be connected to the destination.
    // This prevents microphone feedback.
  }

  /**
   * Stops capturing audio and releases the microphone.
   */
  public stop(): void {
    if (!this.mediaStream) return;

    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.onmessage = null;
      // Disconnect the input node from the worklet, leaving other connections intact
      this.inputNode.disconnect(this.audioWorkletNode);
      this.audioWorkletNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

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