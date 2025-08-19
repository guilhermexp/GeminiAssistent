/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, LiveServerMessage, Modality, Session} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

import type {
  Analysis,
  ProcessingState,
  SearchResult,
  TimelineEvent,
  AnalysisCallbacks,
} from './types';

// Import the new shell and view components
import './assistant-shell';
import './assistant-view';

// Import sub-components that are passed as slots or used directly
import './analysis-modal'; // for gdm-analysis-panel

// Refactored logic handlers
import {ContentAnalysisManager} from './content-analysis-manager';
import {generateCompositeSystemInstruction} from './system-instruction-builder';
import {AudioService} from './audio-service';

// =================================================================
// MAIN LIT COMPONENT (NOW ACTING AS A CONTROLLER)
// =================================================================
@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';
  @state() processingState: ProcessingState = {
    active: false,
    step: '',
    progress: 0,
  };
  @state() showAnalysisPanel = false;
  @state() showTimelineModal = false;
  @state() searchResults: SearchResult[] = [];
  @state() timelineEvents: TimelineEvent[] = [];
  @state() analyses: Analysis[] = [];
  @state() systemInstruction =
    'Você é um assistente de voz prestativo que fala português do Brasil. Você não tem a capacidade de pesquisar na internet.';
  @state() inputNode?: GainNode;
  @state() outputNode?: GainNode;

  private client: GoogleGenAI;
  private session: Session;
  private contentAnalysisManager: ContentAnalysisManager;
  private audioService: AudioService;

  static styles = css`
    :host {
      width: 100vw;
      height: 100vh;
      display: block;
    }
  `;

  constructor() {
    super();
    this.client = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });
    this.contentAnalysisManager = new ContentAnalysisManager(this.client);
    this.audioService = new AudioService({
      onInputAudio: (audioBlob) => {
        if (this.session && this.isRecording) {
          this.session.sendRealtimeInput({media: audioBlob});
        }
      },
    });

    // Expose audio nodes for the visualizer
    this.inputNode = this.audioService.inputNode;
    this.outputNode = this.audioService.outputNode;

    this.logEvent('Assistente inicializado.', 'info');
    this.initSession();
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

  private async initSession(newSystemInstruction?: string) {
    if (this.isRecording) {
      this.stopRecording();
    }
    if (this.session) {
      this.session.close();
    }

    this.systemInstruction =
      newSystemInstruction ||
      'Você é um assistente de voz prestativo que fala português do Brasil. Você não tem a capacidade de pesquisar na internet.';

    if (!newSystemInstruction) {
      this.logEvent('Sessão reiniciada para o modo geral.', 'info');
    }

    const model = 'gemini-2.5-flash-preview-native-audio-dialog';
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
              this.audioService.playAudioChunk(audio.data);
            }

            const grounding = (message.serverContent as any)?.candidates?.[0]
              ?.groundingMetadata;
            if (grounding?.groundingChunks?.length) {
              this.searchResults = grounding.groundingChunks
                .map((chunk) => chunk.web)
                .filter(Boolean);
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              this.audioService.interruptPlayback();
            }
          },
          onerror: (e: ErrorEvent) => {
            this.updateError(e.message);
            this.logEvent(`Erro de conexão: ${e.message}`, 'error');
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Conexão fechada: ' + e.reason);
            this.logEvent(`Conexão fechada: ${e.reason}`, 'disconnect');
            // If we were recording when the connection dropped, stop the recording.
            if (this.isRecording) {
              this.audioService.stop();
              this.isRecording = false;
              this.updateStatus(
                'Gravação interrompida. A conexão foi fechada.',
              );
              this.logEvent(
                'Gravação interrompida devido à desconexão.',
                'record',
              );
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Orus'}},
            languageCode: 'pt-BR',
          },
          systemInstruction: this.systemInstruction,
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
      if (this.error === msg) {
        this.error = '';
      }
    }, 5000);
  }

  private async startRecording() {
    if (this.isRecording) {
      return;
    }
    this.searchResults = [];

    this.updateStatus('Pedindo acesso ao microfone...');

    try {
      await this.audioService.start();
      this.isRecording = true;
      this.updateStatus('🔴 Gravando... Fale agora.');
      this.logEvent('Gravação iniciada.', 'record');
    } catch (err) {
      console.error('Error starting recording:', err);
      this.updateError(`Erro ao iniciar gravação: ${(err as Error).message}`);
      this.isRecording = false; // Ensure state is correct on failure
    }
  }

  private stopRecording() {
    if (!this.isRecording) return;
    this.updateStatus('Parando gravação...');
    this.audioService.stop();
    this.isRecording = false;
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

  async handleAnalysisSubmit(e: CustomEvent) {
    if (this.processingState.active) return;
    const {urlOrTopic, file} = e.detail;

    if (!urlOrTopic && !file) {
      this.updateError('Forneça uma URL, um tópico ou carregue um arquivo.');
      return;
    }

    this.setProcessingState(true, 'Iniciando análise...', 5);
    this.logEvent('Análise de conteúdo iniciada.', 'process');
    this.searchResults = [];

    const callbacks: AnalysisCallbacks = {
      setProcessingState: (active, step, progress) =>
        this.setProcessingState(active, step, progress),
      logEvent: (message, type) => this.logEvent(message, type),
    };

    try {
      const {newAnalyses, newSystemInstruction, newAnalysis} =
        await this.contentAnalysisManager.handleAnalysisRequest(
          urlOrTopic,
          file,
          this.analyses,
          callbacks,
        );

      this.logEvent('Análise concluída com sucesso.', 'success');
      this.analyses = newAnalyses;
      this.logEvent(`Contexto adicionado: "${newAnalysis.title}"`, 'success');

      await this.initSession(newSystemInstruction);

      const titleToShow =
        this.analyses.length > 1
          ? 'Múltiplos contextos'
          : this.analyses[0].title;
      this.updateStatus(`Pronto! Pergunte sobre "${titleToShow}"`);
    } catch (err) {
      console.error(err);
      this.updateError(`Erro na análise: ${(err as Error).message}`);
      this.setProcessingState(false, 'Falha na análise', 0, true);
    } finally {
      this.setProcessingState(false);
    }
  }

  private async removeAnalysis(e: CustomEvent) {
    const {idToRemove} = e.detail;
    this.analyses = this.analyses.filter((a) => a.id !== idToRemove);
    this.logEvent('Contexto removido.', 'info');

    if (this.analyses.length === 0) {
      this.reset();
    } else {
      const compositeInstruction = generateCompositeSystemInstruction(
        this.analyses,
      );
      await this.initSession(compositeInstruction);
      this.updateStatus('Contexto removido. Sessão atualizada.');
    }
  }

  private reset() {
    this.analyses = [];
    this.searchResults = [];
    this.initSession(); // Re-initializes with default prompt
    this.updateStatus('Sessão reiniciada.');
    this.logEvent(
      'Sessão reiniciada e todos os contextos foram limpos.',
      'info',
    );
  }

  render() {
    return html`
      <gdm-assistant-shell .panelOpen=${this.showAnalysisPanel}>
        <gdm-analysis-panel
          slot="analysis-panel"
          .show=${this.showAnalysisPanel}
          .analyses=${this.analyses}
          @close=${() => (this.showAnalysisPanel = false)}></gdm-analysis-panel>

        <gdm-assistant-view
          slot="assistant-view"
          .status=${this.status}
          .error=${this.error}
          .searchResults=${this.searchResults}
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}
          .isRecording=${this.isRecording}
          .analyses=${this.analyses}
          .showTimelineModal=${this.showTimelineModal}
          .timelineEvents=${this.timelineEvents}
          .processingState=${this.processingState}
          @analysis-submit=${this.handleAnalysisSubmit}
          @analysis-remove=${this.removeAnalysis}
          @start-recording=${this.startRecording}
          @stop-recording=${this.stopRecording}
          @reset=${this.reset}
          @show-analysis=${() => (this.showAnalysisPanel = !this.showAnalysisPanel)}
          @show-timeline=${() => (this.showTimelineModal = true)}
          @close-timeline=${() => (this.showTimelineModal = false)}>
        </gdm-assistant-view>
      </gdm-assistant-shell>
    `;
  }
}
