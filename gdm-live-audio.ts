/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, LiveServerMessage, Modality, Session} from '@google/genai';
import {LitElement, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

import {createBlob, decode, decodeAudioData} from './utils';
import {isValidUrl} from './youtube-utils';
import {Analysis, AnalysisService} from './analysis-service';
import {styles} from './gdm-live-audio.css';

import './visual-3d';
import './components/analysis-modal';
import './components/timeline-modal';

interface SearchResult {
  uri: string;
  title: string;
}

export interface TimelineEvent {
  timestamp: string;
  message: string;
  type:
    | 'info'
    | 'success'
    | 'error'
    | 'record'
    | 'process'
    | 'connect'
    | 'disconnect';
}

interface ProcessingState {
  active: boolean;
  step: string;
  progress: number;
}

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  static styles = styles;

  @state() isRecording = false;
  @state() status = '';
  @state() error = '';
  @state() urlInput: string = '';
  @state() selectedFile: File | null = null;
  @state() processingState: ProcessingState = {
    active: false,
    step: '',
    progress: 0,
  };
  @state() showAnalysisModal = false;
  @state() showTimelineModal = false;
  @state() searchResults: SearchResult[] = [];
  @state() timelineEvents: TimelineEvent[] = [];
  @state() analyses: Analysis[] = [];

  private client: GoogleGenAI;
  private session: Session;
  private analysisService: AnalysisService;
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream;
  private sourceNode: AudioBufferSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;
  private sources = new Set<AudioBufferSourceNode>();

  constructor() {
    super();
    this.initClient();
  }

  private initAudio() {
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  private logEvent(message: string, type: TimelineEvent['type']) {
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const newEvent: TimelineEvent = {timestamp, message, type};
    this.timelineEvents = [newEvent, ...this.timelineEvents];
  }

  private async initClient() {
    this.logEvent('Assistente inicializado.', 'info');
    this.initAudio();

    this.client = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });
    this.analysisService = new AnalysisService(this.client);

    this.outputNode.connect(this.outputAudioContext.destination);

    this.initSession();
  }

  private async initSession(systemInstruction?: string) {
    if (this.session) {
      this.session.close();
    }

    const instruction =
      systemInstruction ||
      'Você é um assistente de voz prestativo que fala português do Brasil. Você não tem a capacidade de pesquisar na internet.';

    if (!systemInstruction) {
      this.logEvent('Sessão reiniciada para o modo geral.', 'info');
    }

    const model = 'gemini-2.5-flash-native-audio-dialog';
    this.updateStatus('Conectando ao assistente...');
    try {
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            this.logEvent('Conexão com o assistente estabelecida.', 'connect');
            if (this.analyses.length === 0) {
              this.updateStatus('Conectado');
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            const audio =
              message.serverContent?.modelTurn?.parts[0]?.inlineData;

            if (audio) {
              if (this.sources.size === 0) {
                this.nextStartTime =
                  this.outputAudioContext.currentTime + 0.1;
              }
              this.nextStartTime = Math.max(
                this.nextStartTime,
                this.outputAudioContext.currentTime,
              );
              const audioBuffer = await decodeAudioData(
                decode(audio.data),
                this.outputAudioContext,
                24000,
                1,
              );
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(this.outputNode);
              source.addEventListener('ended', () => {
                this.sources.delete(source);
              });
              source.start(this.nextStartTime);
              this.nextStartTime += audioBuffer.duration;
              this.sources.add(source);
            }

            const grounding = (message.serverContent as any)?.candidates?.[0]
              ?.groundingMetadata;
            if (grounding?.groundingChunks?.length) {
              this.searchResults = grounding.groundingChunks
                .map((chunk) => chunk.web)
                .filter(Boolean);
            }

            if (message.serverContent?.interrupted) {
              for (const source of this.sources.values()) {
                source.stop();
                this.sources.delete(source);
              }
              this.nextStartTime = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            this.updateError(e.message);
            this.logEvent(`Erro de conexão: ${e.message}`, 'error');
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Conexão fechada: ' + e.reason);
            this.logEvent(`Conexão fechada: ${e.reason}`, 'disconnect');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Orus'}},
            languageCode: 'pt-BR',
          },
          systemInstruction: instruction,
        },
      });
    } catch (e) {
      console.error(e);
      this.updateError((e as Error).message);
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
    this.error = '';
  }

  private updateError(msg: string) {
    this.error = msg;
    this.status = '';
    this.logEvent(msg, 'error');
    setTimeout(() => {
      if (this.error === msg) this.error = '';
    }, 5000);
  }

  private async startRecording() {
    if (this.isRecording) return;
    this.searchResults = [];
    this.inputAudioContext.resume();
    this.updateStatus('Pedindo acesso ao microfone...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.updateStatus('Acesso ao microfone concedido. Iniciando captura...');
      this.sourceNode = this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );
      this.sourceNode.connect(this.inputNode);
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        256,
        1,
        1,
      );
      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;
        const pcmData = audioProcessingEvent.inputBuffer.getChannelData(0);
        this.session.sendRealtimeInput({media: createBlob(pcmData)});
      };
      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);
      this.isRecording = true;
      this.updateStatus('🔴 Gravando... Fale agora.');
      this.logEvent('Gravação iniciada.', 'record');
    } catch (err) {
      console.error('Error starting recording:', err);
      this.updateError(`Erro ao iniciar gravação: ${(err as Error).message}`);
      this.stopRecording();
    }
  }

  private stopRecording() {
    if (!this.isRecording && !this.mediaStream && !this.inputAudioContext)
      return;
    this.updateStatus('Parando gravação...');
    this.isRecording = false;
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
    this.logEvent('Gravação parada.', 'record');
    this.updateStatus('Gravação parada. Clique para começar de novo.');
  }

  private setProcessingState(
    active: boolean,
    step = '',
    progress = 0,
    isError = false,
  ) {
    this.processingState = {active, step, progress};
    if (active) {
      this.status = '';
      this.error = '';
    }
    if (!active && !isError) {
      this.updateStatus('Pronto para conversar.');
    }
  }

  async handleAnalysisSubmit(e: Event) {
    e.preventDefault();
    if (this.processingState.active) return;
    const hasTextInput = this.urlInput.trim().length > 0;
    const hasFile = this.selectedFile !== null;
    if (!hasTextInput && !hasFile) {
      this.updateError('Forneça uma URL, um tópico ou carregue um arquivo.');
      return;
    }

    this.setProcessingState(true, 'Iniciando análise...', 5);
    this.logEvent('Análise de conteúdo iniciada.', 'process');
    this.searchResults = [];

    try {
      const input = this.selectedFile || this.urlInput.trim();
      const newAnalysis = await this.analysisService.analyze(input, (step, progress) => {
        this.setProcessingState(true, step, progress);
        this.logEvent(`${step}: ${this.selectedFile?.name || this.urlInput}`, 'process');
      });
      
      this.logEvent('Análise concluída com sucesso.', 'success');
      this.setProcessingState(true, 'Configurando assistente...', 95);

      this.analyses = [...this.analyses, newAnalysis];
      this.selectedFile = null;
      this.urlInput = '';
      this.logEvent(`Contexto adicionado: "${newAnalysis.title}"`, 'success');

      const systemInstruction = this.analysisService.generateSystemInstruction(this.analyses);
      await this.initSession(systemInstruction);

      const titleToShow = this.analyses.length > 1 ? 'Múltiplos contextos' : this.analyses[0].title;
      this.updateStatus(`Pronto! Pergunte sobre "${titleToShow}"`);
    } catch (err) {
      console.error(err);
      this.updateError(`Erro na análise: ${(err as Error).message}`);
      this.setProcessingState(false, 'Falha na análise', 0, true);
    } finally {
      this.setProcessingState(false);
    }
  }

  private triggerFileInput() {
    this.shadowRoot?.getElementById('file-input')?.click();
  }

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.urlInput = this.selectedFile.name;
    } else {
      this.selectedFile = null;
    }
  }

  private async removeAnalysis(idToRemove: string) {
    this.analyses = this.analyses.filter((a) => a.id !== idToRemove);
    this.logEvent('Contexto removido.', 'info');
    if (this.analyses.length === 0) {
      this.reset();
    } else {
      const systemInstruction = this.analysisService.generateSystemInstruction(this.analyses);
      await this.initSession(systemInstruction);
      this.updateStatus('Contexto removido. Sessão atualizada.');
    }
  }

  private reset() {
    this.analyses = [];
    this.urlInput = '';
    this.selectedFile = null;
    this.searchResults = [];
    const fileInput = this.shadowRoot?.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    this.initSession();
    this.updateStatus('Sessão reiniciada.');
  }

  render() {
    return html`
      <analysis-modal
        .show=${this.showAnalysisModal}
        .analyses=${this.analyses}
        @close-modal=${() => (this.showAnalysisModal = false)}
        @log-event=${(e: CustomEvent) =>
          this.logEvent(e.detail.message, e.detail.type)}></analysis-modal>
      <timeline-modal
        .show=${this.showTimelineModal}
        .events=${this.timelineEvents}
        @close-modal=${() => (this.showTimelineModal = false)}></timeline-modal>

      <div class="input-container">
        <form class="input-form" @submit=${this.handleAnalysisSubmit}>
          <input
            type="text"
            id="url-input"
            aria-label="URL, tópico de pesquisa ou nome do arquivo"
            placeholder="Cole uma URL, digite um tema ou carregue um arquivo..."
            .value=${this.urlInput}
            @input=${(e: Event) => {
              this.urlInput = (e.target as HTMLInputElement).value;
              if (this.selectedFile) {
                this.selectedFile = null;
                const fileInput = this.shadowRoot?.getElementById(
                  'file-input',
                ) as HTMLInputElement;
                if (fileInput) fileInput.value = '';
              }
            }}
            ?disabled=${this.processingState.active} />
          <button
            type="button"
            class="icon-button"
            @click=${this.triggerFileInput}
            ?disabled=${this.processingState.active}
            title="Carregar um arquivo"
            aria-label="Carregar um arquivo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="#ffffff">
              <path
                d="M440-320v-320H320l160-200 160 200H520v320H440ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
            </svg>
          </button>
          <button
            type="submit"
            aria-label="Analisar, Pesquisar ou Adicionar Contexto"
            ?disabled=${
              (!this.urlInput.trim() && !this.selectedFile) ||
              this.processingState.active
            }>
            ${this.processingState.active
              ? html`
                  <div
                    class="progress-bar"
                    style="width: ${this.processingState.progress}%"></div>
                  <div class="progress-text">
                    <div class="loader"></div>
                    <span
                      >${this.processingState.step}
                      ${this.processingState.progress}%</span
                    >
                  </div>
                `
              : this.analyses.length > 0
              ? 'Adicionar'
              : 'Analisar'}
          </button>
        </form>
        <input
          type="file"
          id="file-input"
          style="display: none;"
          @change=${this.handleFileSelect}
          accept="image/*,application/pdf,.csv,.xls,.xlsx,.doc,.docx,.md,.xlm" />
        ${this.analyses.length > 0
          ? html`
              <div class="content-pills-container">
                ${this.analyses.map(
                  (analysis) => html`
                    <div class="content-pill" title=${analysis.source}>
                      <span>${analysis.title}</span>
                      <button
                        @click=${() => this.removeAnalysis(analysis.id)}
                        title="Remover contexto"
                        aria-label="Remover ${analysis.title} do contexto">
                        ×
                      </button>
                    </div>
                  `,
                )}
              </div>
            `
          : ''}
      </div>

      <div id="status" class=${this.error ? 'error' : ''}>
        ${this.error || this.status}
      </div>

      <div class="bottom-container">
        ${this.searchResults.length > 0
          ? html`
              <div class="search-results">
                <p>Fontes da pesquisa:</p>
                <ul>
                  ${this.searchResults.map(
                    (result) => html`
                      <li>
                        <a
                          href=${result.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          >${result.title || result.uri}</a
                        >
                      </li>
                    `,
                  )}
                </ul>
              </div>
            `
          : ''}

        <div class="media-controls">
          <button
            id="startButton"
            @click=${this.startRecording}
            ?disabled=${this.isRecording}
            aria-label="Iniciar gravação">
            <svg
              viewBox="0 0 100 100"
              width="24px"
              height="24px"
              fill="#c80000"
              xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" />
            </svg>
          </button>
          <button
            id="stopButton"
            @click=${this.stopRecording}
            ?disabled=${!this.isRecording}
            aria-label="Parar gravação">
            <svg
              viewBox="0 0 100 100"
              width="24px"
              height="24px"
              fill="#ffffff"
              xmlns="http://www.w3.org/2000/svg">
              <rect x="15" y="15" width="70" height="70" rx="8" />
            </svg>
          </button>
          <button
            id="resetButton"
            @click=${this.reset}
            ?disabled=${this.isRecording}
            aria-label="Reiniciar sessão e limpar todos os contextos">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="#ffffff">
              <path
                d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
            </svg>
          </button>
          ${this.analyses.length > 0
            ? html`
                <button
                  id="transcriptionButton"
                  @click=${() => (this.showAnalysisModal = true)}
                  title="Ver análises de conteúdo"
                  aria-label="Ver análises de conteúdo">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="24px"
                    viewBox="0 -960 960 960"
                    width="24px"
                    fill="#ffffff">
                    <path
                      d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z" />
                  </svg>
                </button>
              `
            : ''}
          ${this.timelineEvents.length > 0
            ? html`
                <button
                  id="timelineButton"
                  @click=${() => (this.showTimelineModal = true)}
                  title="Ver Linha do Tempo"
                  aria-label="Ver Linha do Tempo">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="24px"
                    viewBox="0 -960 960 960"
                    width="24px"
                    fill="#ffffff">
                    <path
                      d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM200-80q-33 0-56.5-23.5T120-160v-640q0-33 23.5-56.5T200-880h560q33 0 56.5 23.5T840-800v640q0 33-23.5 56.5T760-80H200Zm0-80h560v-640H200v640Z" />
                  </svg>
                </button>
              `
            : ''}
        </div>
      </div>

      <gdm-live-audio-visuals-3d
        .inputNode=${this.inputNode}
        .outputNode=${this.outputNode}></gdm-live-audio-visuals-3d>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio': GdmLiveAudio;
  }
}
