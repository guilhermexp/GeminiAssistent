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
  SavedSession,
} from './types';

// Import the new shell and view components
import './assistant-shell';
import './assistant-view';

// Import sub-components that are passed as slots or used directly
import './analysis-modal'; // for gdm-analysis-panel
import './history-modal';

// Refactored logic handlers
import {ContentAnalysisManager} from './content-analysis-manager';
import {generateCompositeSystemInstruction} from './system-instruction-builder';
import {AudioService} from './audio-service';

const LOCAL_STORAGE_KEY = 'gemini-live-sessions';

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
  @state() showHistoryModal = false;
  @state() searchResults: SearchResult[] = [];
  @state() timelineEvents: TimelineEvent[] = [];
  @state() analyses: Analysis[] = [];
  @state() savedSessions: SavedSession[] = [];
  @state() systemInstruction =
    'Você é um assistente de voz prestativo que fala português do Brasil. Você não tem a capacidade de pesquisar na internet.';
  @state() inputNode?: GainNode;
  @state() outputNode?: GainNode;
  @state() activePersona: string | null = null;

  private client: GoogleGenAI;
  private session: Session;
  private contentAnalysisManager: ContentAnalysisManager;
  private audioService: AudioService;
  private readonly CONTEXT_WINDOW_SIZE = 1_000_000;
  private lastLoggedSources = '';

  private readonly models = [
    'gemini-2.5-flash-preview-native-audio-dialog',
    'gemini-live-2.5-flash-preview',
  ];

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
    this.loadSessionsFromStorage();
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
      generateCompositeSystemInstruction(this.analyses, this.activePersona);

    if (!newSystemInstruction) {
      this.logEvent('Sessão reiniciada para o modo geral.', 'info');
    }

    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Orus'}},
        languageCode: 'pt-BR',
      },
      systemInstruction: this.systemInstruction,
      contextWindowCompression: {slidingWindow: {}},
    };

    // If there is no specific content to analyze, enable Google Search.
    if (this.analyses.length === 0) {
      config.tools = [{googleSearch: {}}];
      this.logEvent('Busca do Google ativada para respostas factuais.', 'info');
    }

    this.updateStatus('Conectando ao assistente...');
    let lastError: Error | null = null;

    for (const model of this.models) {
      try {
        this.logEvent(`Tentando conectar com o modelo: ${model}`, 'info');
        this.session = await this.client.live.connect({
          model: model,
          callbacks: {
            onopen: () => {
              this.logEvent(`Conexão estabelecida com ${model}.`, 'connect');
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
                const sources: SearchResult[] = grounding.groundingChunks
                  .map((chunk: any) => chunk.web)
                  .filter(Boolean);

                if (sources.length > 0) {
                  this.searchResults = sources;

                  const sourcesKey = sources
                    .map((s) => s.uri)
                    .sort()
                    .join(',');

                  if (sourcesKey && sourcesKey !== this.lastLoggedSources) {
                    this.lastLoggedSources = sourcesKey;

                    let logMessage = `O assistente usou ${sources.length} fonte(s) para a resposta:`;
                    sources.forEach((source: SearchResult) => {
                      logMessage += `\n • ${source.title || source.uri}`;
                    });

                    this.logEvent(logMessage, 'info');
                  }
                }
              } else {
                // Reset when a message without sources arrives, so the next grounded
                // answer can be logged.
                this.lastLoggedSources = '';
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
          config: config,
        });
        // If connection is successful, clear any previous error and return
        this.error = '';
        this.logEvent('Compressão da janela de contexto habilitada.', 'info');
        return;
      } catch (e) {
        console.error(`Falha ao conectar com o modelo ${model}:`, e);
        this.logEvent(
          `Falha ao conectar com o modelo ${model}: ${(e as Error).message}`,
          'error',
        );
        lastError = e as Error;
      }
    }

    // If the loop completes, it means all models failed to connect.
    if (lastError) {
      this.updateError(`Falha ao conectar ao assistente: ${lastError.message}`);
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
      this.updateStatus('Estou ouvindo, Fale agora.');
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
    const {urlOrTopic, file, analysisMode} = e.detail;

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
          analysisMode,
          this.analyses,
          this.activePersona,
          callbacks,
        );

      this.logEvent('Análise concluída com sucesso.', 'success');
      this.analyses = newAnalyses;

      const summarySize = newAnalysis.summary.length;
      const percentageUsed = (summarySize / this.CONTEXT_WINDOW_SIZE) * 100;
      this.logEvent(
        `Contexto de "${
          newAnalysis.title
        }" adicionado, consumindo ${percentageUsed.toFixed(
          4,
        )}% da janela de contexto.`,
        'info',
      );

      if (this.analyses.length >= 5) {
        this.logEvent(
          'Sugestão: A sessão contém múltiplos contextos. Para tópicos não relacionados, considere reiniciar a sessão para otimizar o foco.',
          'info',
        );
      }

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
      // Keep the persona, just remove content
      const instruction = generateCompositeSystemInstruction(
        [],
        this.activePersona,
      );
      await this.initSession(instruction);
      this.updateStatus('Contexto removido. Sessão atualizada.');
    } else {
      const compositeInstruction = generateCompositeSystemInstruction(
        this.analyses,
        this.activePersona,
      );
      await this.initSession(compositeInstruction);
      this.updateStatus('Contexto removido. Sessão atualizada.');
    }
  }

  private reset() {
    const isSessionWorthSaving =
      this.analyses.length > 0 ||
      this.activePersona !== null ||
      this.timelineEvents.some((event) => event.type === 'record');

    if (isSessionWorthSaving) {
      this.saveCurrentSession();
    }

    // Reset state for the new session
    this.analyses = [];
    this.searchResults = [];
    this.timelineEvents = [];
    this.activePersona = null;
    this.initSession();

    if (isSessionWorthSaving) {
      this.updateStatus('Nova sessão iniciada.');
      this.logEvent('Nova sessão iniciada.', 'info');
    } else {
      this.updateStatus('Sessão reiniciada.');
      this.logEvent(
        'Sessão reiniciada, todos os contextos e persona foram limpos.',
        'info',
      );
    }
  }

  private clearContexts() {
    this.analyses = [];
    this.searchResults = [];

    const instruction = generateCompositeSystemInstruction(
      [],
      this.activePersona,
    );
    this.initSession(instruction);
    this.updateStatus('Contextos limpos. A persona foi mantida.');
    this.logEvent(
      'Todos os contextos da sessão foram limpos. A persona ativa foi mantida.',
      'info',
    );
  }

  private async handlePersonaChange(e: CustomEvent) {
    this.activePersona = e.detail.persona;
    const personaName =
      this.activePersona
        ?.split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Padrão';

    this.logEvent(`Persona alterada para: ${personaName}`, 'info');

    const newSystemInstruction = generateCompositeSystemInstruction(
      this.analyses,
      this.activePersona,
    );
    await this.initSession(newSystemInstruction);
    this.updateStatus(`Persona alterada para ${personaName}. Pronto.`);
  }

  // =================================================================
  // SESSION HISTORY MANAGEMENT
  // =================================================================
  private loadSessionsFromStorage() {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      this.savedSessions = saved ? JSON.parse(saved) : [];
      this.logEvent(
        `Carregadas ${this.savedSessions.length} sessões do histórico.`,
        'history',
      );
    } catch (e) {
      console.error('Falha ao carregar sessões:', e);
      this.savedSessions = [];
      this.updateError('Não foi possível carregar o histórico de sessões.');
    }
  }

  private saveSessionsToStorage() {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(this.savedSessions),
      );
    } catch (e) {
      console.error('Falha ao salvar sessões:', e);
      this.updateError('Não foi possível salvar a sessão no histórico.');
    }
  }

  private saveCurrentSession() {
    const date = new Date();
    const defaultTitle = `Conversa Geral - ${date.toLocaleString('pt-BR')}`;
    let title = defaultTitle;

    if (this.analyses.length > 0) {
      title = this.analyses[0].title;
      if (this.analyses.length > 1) {
        title += ` (+${this.analyses.length - 1} contextos)`;
      }
    } else if (this.activePersona) {
      title = `Persona: ${
        this.activePersona
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ') || 'Padrão'
      } - ${date.toLocaleString('pt-BR')}`;
    }

    const newSession: SavedSession = {
      id: date.toISOString(),
      title,
      analyses: this.analyses,
      timelineEvents: this.timelineEvents,
      systemInstruction: this.systemInstruction,
      searchResults: this.searchResults,
      activePersona: this.activePersona,
    };

    // Add to the beginning of the list
    this.savedSessions = [newSession, ...this.savedSessions];
    this.saveSessionsToStorage();
    this.logEvent(`Sessão "${title}" salva no histórico.`, 'history');
  }

  private async loadSession(e: CustomEvent) {
    const {sessionId} = e.detail;
    const sessionToLoad = this.savedSessions.find((s) => s.id === sessionId);

    if (sessionToLoad) {
      this.analyses = sessionToLoad.analyses;
      this.timelineEvents = sessionToLoad.timelineEvents;
      this.searchResults = sessionToLoad.searchResults;
      this.activePersona = sessionToLoad.activePersona;

      await this.initSession(sessionToLoad.systemInstruction);
      this.showHistoryModal = false;
      this.updateStatus(`Sessão "${sessionToLoad.title}" carregada.`);
      this.logEvent(`Sessão "${sessionToLoad.title}" carregada.`, 'history');
    } else {
      this.updateError('Não foi possível encontrar a sessão para carregar.');
    }
  }

  private deleteSession(e: CustomEvent) {
    const {sessionId} = e.detail;
    const sessionToDelete = this.savedSessions.find((s) => s.id === sessionId);
    if (sessionToDelete) {
      this.savedSessions = this.savedSessions.filter(
        (s) => s.id !== sessionId,
      );
      this.saveSessionsToStorage();
      this.logEvent(
        `Sessão "${sessionToDelete.title}" excluída do histórico.`,
        'history',
      );
    }
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
          .showHistoryModal=${this.showHistoryModal}
          .savedSessions=${this.savedSessions}
          .activePersona=${this.activePersona}
          @analysis-submit=${this.handleAnalysisSubmit}
          @analysis-remove=${this.removeAnalysis}
          @start-recording=${this.startRecording}
          @stop-recording=${this.stopRecording}
          @reset=${this.reset}
          @clear-contexts=${this.clearContexts}
          @show-analysis=${() => (this.showAnalysisPanel = !this.showAnalysisPanel)}
          @show-timeline=${() => (this.showTimelineModal = true)}
          @close-timeline=${() => (this.showTimelineModal = false)}
          @show-history=${() => (this.showHistoryModal = true)}
          @close-history=${() => (this.showHistoryModal = false)}
          @save-session=${this.saveCurrentSession}
          @load-session=${this.loadSession}
          @delete-session=${this.deleteSession}
          @persona-change=${this.handlePersonaChange}>
        </gdm-assistant-view>
      </gdm-assistant-shell>
    `;
  }
}