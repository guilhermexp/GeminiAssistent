/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, LiveServerMessage, Modality, Session} from '@google/genai';
import {LitElement, css, html, svg} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {marked} from 'marked';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import {createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';
import {AnalysisService} from './analysis-service';
import type {
  Analysis,
  ProcessingState,
  SearchResult,
  TimelineEvent,
  AnalysisCallbacks,
} from './types';

// =================================================================
// MAIN LIT COMPONENT
// =================================================================
@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
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
  @state() selectedAnalysisIdInModal: string | null = null;
  @state() systemInstruction =
    'Você é um assistente de voz prestativo que fala português do Brasil. Você não tem a capacidade de pesquisar na internet.';

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

  static styles = css`
    #status {
      position: absolute;
      bottom: calc(2vh + 100px); /* Position above the control bar */
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      font-family: sans-serif;
      transition: color 0.3s ease;
      text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
      pointer-events: none; /* Avoid interfering with controls */
    }

    #status.error {
      color: #ff8a80; /* A less harsh red */
    }

    .input-container {
      position: absolute;
      top: 2vh;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 550px;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .input-form {
      width: 100%;
      display: flex;
      gap: 8px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 24px;
      padding: 4px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .input-form input[type='text'] {
      flex-grow: 1;
      border: none;
      background: transparent;
      color: white;
      padding: 10px 18px;
      font-size: 14px;
      outline: none;
      height: 40px;
      box-sizing: border-box;
    }

    .input-form button {
      outline: none;
      border: none;
      color: white;
      border-radius: 20px;
      background: rgba(80, 120, 255, 0.5);
      height: 40px;
      cursor: pointer;
      font-size: 14px;
      white-space: nowrap;
      transition: background-color 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
    }

    .input-form button.icon-button {
      background: transparent;
      width: 40px;
      padding: 0;
    }

    .input-form button:hover {
      background: rgba(80, 120, 255, 0.8);
    }

    .input-form button.icon-button:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .input-form button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-form button[type='submit'] {
      position: relative;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .input-form button[type='submit']:disabled {
      background: rgba(80, 120, 255, 0.4);
      opacity: 1; /* Override general disabled opacity */
      cursor: not-allowed;
    }

    .input-form button.icon-button:disabled {
      background: transparent;
    }

    .progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: rgba(80, 120, 255, 0.8);
      border-radius: 20px;
      transition: width 0.3s ease-in-out;
      z-index: 1;
    }

    .progress-text {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
    }

    /* Spinner for processing button */
    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .loader {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      animation: spin 1s linear infinite;
    }

    .content-pills-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 8px;
    }
    .content-pill {
      display: flex;
      align-items: center;
      background: rgba(0, 0, 0, 0.4);
      padding: 6px 12px;
      border-radius: 16px;
      font-family: sans-serif;
      font-size: 13px;
      color: #eee;
      border: 1px solid #5078ff;
      backdrop-filter: blur(10px);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 250px;
    }
    .content-pill span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .content-pill button {
      background: none;
      border: none;
      color: #aaa;
      margin-left: 8px;
      padding: 0;
      font-size: 16px;
      cursor: pointer;
      line-height: 1;
    }
    .content-pill button:hover {
      color: #fff;
    }

    .bottom-container {
      position: absolute;
      bottom: 2vh;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 800px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 10;
      align-items: center;
    }

    .media-controls {
      display: flex;
      gap: 8px;
    }

    .media-controls button {
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.2);
      width: 48px;
      height: 48px;
      cursor: pointer;
      font-size: 24px;
      padding: 0;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .media-controls button:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .media-controls button[disabled] {
      display: none;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .modal-content {
      background: rgba(30, 30, 30, 0.9);
      padding: 24px;
      border-radius: 12px;
      width: clamp(300px, 80vw, 1000px);
      max-height: 85vh;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #eee;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
    }
    .modal-content.analysis-modal-layout {
      flex-direction: row;
      gap: 20px;
      padding: 0; /* Remove padding for full control */
    }

    .modal-content h3 {
      margin: 24px 24px 0 24px;
      color: #5078ff;
      flex-shrink: 0;
    }

    .analysis-sidebar {
      flex: 0 0 250px;
      background: rgba(0, 0, 0, 0.2);
      padding: 24px 8px;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      overflow-y: auto;
    }
    .analysis-sidebar button {
      display: block;
      width: 100%;
      background: transparent;
      border: none;
      color: #ccc;
      padding: 12px 16px;
      text-align: left;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background-color 0.2s, color 0.2s;
    }
    .analysis-sidebar button:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
    }
    .analysis-sidebar button.active {
      background: rgba(80, 120, 255, 0.3);
      color: #fff;
      font-weight: 600;
    }

    .analysis-main {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 24px;
      padding-top: 0; /* h3 has its own margin */
    }

    .analysis-text-content {
      flex-grow: 1;
      overflow-y: auto;
      padding: 1px 16px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      line-height: 1.6;
      color: #eee;
    }
    .analysis-text-content h1,
    .analysis-text-content h2,
    .analysis-text-content h3,
    .analysis-text-content h4 {
      color: #87cefa;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 8px;
      margin-top: 24px;
    }
    .analysis-text-content h1 {
      font-size: 1.5em;
    }
    .analysis-text-content h2 {
      font-size: 1.3em;
    }
    .analysis-text-content h3 {
      font-size: 1.1em;
    }
    .analysis-text-content p {
      margin-bottom: 12px;
    }
    .analysis-text-content ul,
    .analysis-text-content ol {
      padding-left: 24px;
    }
    .analysis-text-content li {
      margin-bottom: 8px;
    }
    .analysis-text-content strong,
    .analysis-text-content b {
      color: #fff;
      font-weight: 600;
    }
    .analysis-text-content em,
    .analysis-text-content i {
      color: #f0f0f0;
      font-style: italic;
    }
    .analysis-text-content blockquote {
      border-left: 4px solid #5078ff;
      padding-left: 16px;
      margin-left: 0;
      color: #ccc;
      font-style: italic;
    }
    .analysis-text-content code {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
    }
    .analysis-text-content pre > code {
      display: block;
      padding: 12px;
      white-space: pre-wrap;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .modal-actions button {
      padding: 10px 20px;
      border-radius: 20px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s;
    }
    .modal-actions button svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    .modal-actions button:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .modal-actions .primary-btn {
      background: #5078ff;
    }
    .modal-actions .primary-btn:hover {
      background: #6a8dff;
    }

    .search-results {
      background: rgba(0, 0, 0, 0.3);
      padding: 8px 16px;
      border-radius: 12px;
      font-family: sans-serif;
      font-size: 14px;
      color: #ccc;
      max-width: 100%;
      backdrop-filter: blur(10px);
    }

    .search-results p {
      margin: 0 0 8px 0;
      font-weight: bold;
    }

    .search-results ul {
      margin: 0;
      padding: 0;
      list-style: none;
      max-height: 100px;
      overflow-y: auto;
    }

    .search-results li {
      margin-bottom: 4px;
    }

    .search-results a {
      color: #87cefa;
      text-decoration: none;
    }
    .search-results a:hover {
      text-decoration: underline;
    }

    /* Timeline Modal Styles */
    .timeline-list {
      list-style: none;
      padding: 0;
      margin: 0;
      flex-grow: 1;
      overflow-y: auto;
    }
    .timeline-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .timeline-item:last-child {
      border-bottom: none;
    }
    .timeline-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }
    .timeline-icon svg {
      width: 20px;
      height: 20px;
    }
    .timeline-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex-grow: 1;
    }
    .timeline-message {
      font-size: 0.9em;
      color: #f0f0f0;
    }
    .timeline-timestamp {
      font-size: 0.75em;
      color: #aaa;
    }
    .timeline-type-success .timeline-icon {
      color: #4caf50;
    }
    .timeline-type-error .timeline-icon {
      color: #f44336;
    }
    .timeline-type-info .timeline-icon {
      color: #2196f3;
    }
    .timeline-type-record .timeline-icon {
      color: #c80000;
    }
    .timeline-type-process .timeline-icon {
      color: #ff9800;
    }
    .timeline-type-connect .timeline-icon {
      color: #00e676;
    }
    .timeline-type-disconnect .timeline-icon {
      color: #9e9e9e;
    }
  `;

  constructor() {
    super();
    this.initClient();
    this.analysisService = new AnalysisService(this.client);
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

    this.outputNode.connect(this.outputAudioContext.destination);

    this.initSession();
  }

  private async initSession(newSystemInstruction?: string) {
    if (this.session) {
      this.session.close();
    }

    this.systemInstruction =
      newSystemInstruction ||
      'Você é um assistente de voz prestativo que fala português do Brasil. Você não tem a capacidade de pesquisar na internet.';

    // This is now handled by the `reset` method.
    // We only reset state when the user explicitly clicks the reset button.
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
              // If this is the first audio chunk of a new response,
              // schedule it to start with a short delay. This builds a
              // buffer to absorb network jitter and prevent stuttering.
              if (this.sources.size === 0) {
                this.nextStartTime =
                  this.outputAudioContext.currentTime + 0.1; // 100ms buffer
              }

              // This is the safety net. If we've fallen behind schedule,
              // reset the start time to now. This will cause a stutter, but
              // prevents audio overlap. The initial buffer should make this rare.
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

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
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

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

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

    if (this.scriptProcessorNode && this.sourceNode && this.inputAudioContext) {
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

  // =================================================================
  // Analysis Logic Improvements
  // =================================================================

  private setProcessingState(
    active: boolean,
    step = '',
    progress = 0,
    isError = false,
  ) {
    this.processingState = {active, step, progress};
    if (active) {
      // Don't log every minor progress update, just major steps.
      this.status = '';
      this.error = '';
    }
    if (!active && !isError) {
      this.updateStatus('Pronto para conversar.');
    }
  }

  private getSingleSystemInstruction(analysis: Analysis): string {
    const {title, summary, persona, type} = analysis;
    if (persona === 'analyst') {
      return `Você é um assistente de voz e analista de dados especialista. Seu foco é o conteúdo da seguinte planilha/documento: "${title}".
Você já realizou uma análise preliminar e tem o seguinte resumo como seu conhecimento base.
--- INÍCIO DO CONHECIMENTO ---
${summary}
--- FIM DO CONHECIMENTO ---
Seu papel é:
1. Responder perguntas sobre os dados usando o conhecimento acima. Seja preciso e quantitativo sempre que possível.
2. Manter um tom de analista: claro, objetivo e focado nos dados. Fale em português do Brasil.
3. Se a pergunta for sobre algo não contido nos dados, indique que a informação não está na planilha. Você não pode pesquisar informações externas.
4. Não invente dados; atenha-se estritamente ao conhecimento fornecido.`;
    }

    if (type === 'github') {
      return `Você é um assistente de voz e especialista no repositório do GitHub: "${title}".
Você já analisou o README e a estrutura de arquivos do projeto. Seu conhecimento base é o seguinte resumo:
--- INÍCIO DO CONHECIMENTO ---
${summary}
--- FIM DO CONHECIMENTO ---
Seu papel é:
1. Responder perguntas sobre o propósito, tecnologia, estrutura e como usar o repositório.
2. Manter um tom técnico e prestativo, como um engenheiro de software sênior, falando em português do Brasil.
3. Se a informação não estiver no seu conhecimento, indique que a resposta não pode ser encontrada no resumo do repositório. Você não pode pesquisar na web.
4. Não invente informações; atenha-se estritamente ao seu conhecimento do repositório.`;
    } else if (type === 'youtube') {
      return `Você é um assistente de voz inteligente especializado no vídeo do YouTube: "${title}".
Você já assistiu ao vídeo e analisou tanto o áudio quanto os elementos visuais. Seu conhecimento base é o seguinte resumo:
--- INÍCIO DO CONHECIMENTO ---
${summary}
--- FIM DO CONHECIMENTO ---
Seu papel é:
1. Responder a perguntas sobre o vídeo. Isso inclui o conteúdo falado (tópicos, ideias) E detalhes visuais (cores, pessoas, objetos, texto na tela, ações).
2. Manter um tom conversacional e natural em português do Brasil.
3. Se a informação não estiver no seu conhecimento (o resumo do vídeo), indique que a resposta não se encontra no vídeo. Você não pode pesquisar na web.
4. Não invente informações; atenha-se estritamente ao seu conhecimento do vídeo.`;
    } else {
      return `Você é um assistente de voz inteligente especializado no seguinte conteúdo: "${title}".
Você já analisou o conteúdo e tem o seguinte resumo detalhado como seu conhecimento.
--- INÍCIO DO CONHECIMENTO ---
${summary}
--- FIM DO CONHECIMENTO ---
Seu papel é:
1. Responder perguntas sobre o conteúdo usando o conhecimento acima.
2. Manter um tom conversacional e natural em português do Brasil.
3. Se a informação não estiver no seu conhecimento, indique que a resposta não se encontra no conteúdo original. Você não pode pesquisar na web.
4. Não invente informações; atenha-se ao conhecimento fornecido.`;
    }
  }

  private generateCompositeSystemInstruction(): string {
    if (this.analyses.length === 0) {
      return 'Você é um assistente de voz prestativo que fala português do Brasil. Você não tem a capacidade de pesquisar na internet.';
    }

    if (this.analyses.length === 1) {
      return this.getSingleSystemInstruction(this.analyses[0]);
    }

    let instruction = `Você é um assistente de voz especialista com conhecimento de múltiplas fontes. Abaixo estão os resumos dos conteúdos que você analisou. Responda às perguntas com base estritamente nessas informações. Ao responder, se possível, mencione a fonte (título) da qual você está extraindo a informação.\n\n`;
    this.analyses.forEach((analysis, index) => {
      instruction += `--- INÍCIO DA FONTE ${index + 1}: "${analysis.title}" (${
        analysis.type
      }) ---\n`;
      instruction += `${analysis.summary}\n`;
      instruction += `--- FIM DA FONTE ${index + 1} ---\n\n`;
    });
    instruction += `Se a pergunta for sobre algo não contido nas fontes, indique que a informação não está disponível. Você não pode pesquisar informações externas. Fale em português do Brasil.`;
    return instruction;
  }

  private async generateAnalysisAndSetupSession(
    summary: string,
    contentInfo: {title: string; source: string},
    persona: Analysis['persona'],
    contentType: Analysis['type'],
  ) {
    this.logEvent('Análise concluída com sucesso.', 'success');

    this.setProcessingState(
      true,
      'Análise recebida. Configurando assistente...',
      95,
    );

    const newAnalysis: Analysis = {
      id: Date.now().toString(),
      title: contentInfo.title,
      source: contentInfo.source,
      summary: summary,
      type: contentType,
      persona: persona,
    };

    this.analyses = [...this.analyses, newAnalysis];
    this.selectedFile = null;
    this.urlInput = '';

    this.logEvent(`Contexto adicionado: "${contentInfo.title}"`, 'success');

    const compositeInstruction = this.generateCompositeSystemInstruction();
    await this.initSession(compositeInstruction);

    const titleToShow =
      this.analyses.length > 1
        ? 'Múltiplos contextos'
        : this.analyses[0].title;
    this.updateStatus(`Pronto! Pergunte sobre "${titleToShow}"`);
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

    const callbacks: AnalysisCallbacks = {
      setProcessingState: (active, step, progress) =>
        this.setProcessingState(active, step, progress),
      logEvent: (message, type) => this.logEvent(message, type),
    };

    try {
      const result = await this.analysisService.analyze(
        this.urlInput,
        this.selectedFile,
        callbacks,
      );

      await this.generateAnalysisAndSetupSession(
        result.summary,
        {title: result.title, source: result.source},
        result.persona,
        result.type,
      );
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
      this.urlInput = this.selectedFile.name; // Show file name in input
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
      const compositeInstruction = this.generateCompositeSystemInstruction();
      await this.initSession(compositeInstruction);
      this.updateStatus('Contexto removido. Sessão atualizada.');
    }
  }

  private reset() {
    this.analyses = [];
    this.urlInput = '';
    this.selectedFile = null;
    this.searchResults = [];
    const fileInput = this.shadowRoot?.getElementById(
      'file-input',
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    this.initSession(); // Re-initializes with default prompt
    this.updateStatus('Sessão reiniciada.');
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9._-]/gi, '_').substring(0, 100);
  }

  private getCurrentAnalysis(): Analysis | undefined {
    if (!this.selectedAnalysisIdInModal) return undefined;
    return this.analyses.find((a) => a.id === this.selectedAnalysisIdInModal);
  }

  private downloadMarkdown() {
    const currentAnalysis = this.getCurrentAnalysis();
    if (!currentAnalysis) return;

    const sanitizedTitle = this.sanitizeFilename(currentAnalysis.title);
    const blob = new Blob([currentAnalysis.summary], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizedTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.logEvent('Análise baixada como Markdown.', 'info');
  }

  private async downloadPdf() {
    const currentAnalysis = this.getCurrentAnalysis();
    if (!currentAnalysis) return;

    const contentElement = this.shadowRoot?.getElementById(
      'analysis-content-for-pdf',
    );
    if (!contentElement) {
      this.updateError('Não foi possível encontrar o conteúdo para gerar o PDF.');
      return;
    }
    this.updateStatus('Gerando PDF...');
    this.logEvent('Iniciando geração de PDF.', 'process');

    try {
      const sanitizedTitle = this.sanitizeFilename(currentAnalysis.title);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
      });
      await pdf.html(contentElement, {
        callback: (doc) => {
          doc.save(`${sanitizedTitle}.pdf`);
          this.updateStatus('PDF gerado com sucesso!');
          this.logEvent('Análise baixada como PDF.', 'info');
        },
        margin: [40, 40, 40, 40],
        autoPaging: 'text',
        html2canvas: {
          scale: 0.7,
          useCORS: true,
          backgroundColor: null,
        },
        width: 515,
        windowWidth: contentElement.scrollWidth,
      });
    } catch (err) {
      this.updateError('Falha ao gerar o PDF.');
      console.error('PDF Generation Error:', err);
    }
  }

  private async shareAnalysis() {
    const currentAnalysis = this.getCurrentAnalysis();
    if (!currentAnalysis) return;

    const shareData = {
      title: `Análise: ${currentAnalysis.title}`,
      text: currentAnalysis.summary,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        this.logEvent('Análise compartilhada com sucesso.', 'success');
      } catch (err) {
        console.warn('Share was cancelled or failed', err);
        this.logEvent('Compartilhamento cancelado.', 'info');
      }
    } else {
      try {
        await navigator.clipboard.writeText(currentAnalysis.summary);
        this.updateStatus('Análise copiada para a área de transferência!');
        this.logEvent(
          'Análise copiada para a área de transferência.',
          'info',
        );
      } catch (err) {
        this.updateError('Falha ao copiar para a área de transferência.');
        console.error('Failed to copy text: ', err);
      }
    }
  }

  private renderTimelineIcon(type: TimelineEvent['type']) {
    const icons = {
      info: svg`<path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/>`,
      success: svg`<path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>`,
      error: svg`<path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/>`,
      record: svg`<path d="M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm-40-600v240q0 17 11.5 28.5T480-720q17 0 28.5-11.5T520-760v-240q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760ZM160-80v-400h80v400h-80Zm160 0v-400h80v400h-80Zm160 0v-400h80v400h-80Zm160 0v-400h80v400h-80Z"/>`,
      process: svg`<path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>`,
      connect: svg`<path d="m560-440-56-56 103-104H160v-80h447L504-784l56-56 200 200-200 200ZM160-120v-80h240v80H160Zm0-160v-80h400v80H160Z"/>`,
      disconnect: svg`<path d="M640-120v-80H240v80h400Zm-82-160-58-58-99-99-22-21 43-43 21 22 99 99 58 58 56-56-224-224-56 56 224 224-56 56Zm82-200v-80h-87l-63-63 56-57 174 174v126h-80Z"/>`,
    };
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
        ${icons[type] || icons['info']}
      </svg>
    `;
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    // When the analysis modal is opened, or the list of analyses changes,
    // ensure a default analysis is selected for viewing.
    if (
      (changedProperties.has('showAnalysisModal') &&
        this.showAnalysisModal &&
        this.analyses.length > 0 &&
        !this.selectedAnalysisIdInModal) ||
      (changedProperties.has('analyses') &&
        this.showAnalysisModal &&
        this.analyses.length > 0 &&
        !this.analyses.find((a) => a.id === this.selectedAnalysisIdInModal))
    ) {
      this.selectedAnalysisIdInModal = this.analyses[0]?.id || null;
    }
  }

  render() {
    const currentAnalysisInModal = this.getCurrentAnalysis();

    return html`
      <div>
        ${this.showAnalysisModal
          ? html`
              <div
                class="modal-overlay"
                @click=${() => (this.showAnalysisModal = false)}>
                <div
                  class="modal-content analysis-modal-layout"
                  @click=${(e: Event) => e.stopPropagation()}>
                  <div class="analysis-sidebar">
                    ${this.analyses.map(
                      (analysis) => html`
                        <button
                          class=${this.selectedAnalysisIdInModal === analysis.id
                            ? 'active'
                            : ''}
                          @click=${() =>
                            (this.selectedAnalysisIdInModal = analysis.id)}
                          title=${analysis.title}>
                          ${analysis.title}
                        </button>
                      `,
                    )}
                  </div>

                  <div class="analysis-main">
                    <h3>
                      Análise:
                      ${currentAnalysisInModal?.title || 'Nenhuma selecionada'}
                    </h3>
                    <div
                      id="analysis-content-for-pdf"
                      class="analysis-text-content">
                      ${currentAnalysisInModal
                        ? unsafeHTML(
                            marked.parse(currentAnalysisInModal.summary) as string,
                          )
                        : html`<p>Selecione uma análise na lista ao lado.</p>`}
                    </div>
                    <div class="modal-actions">
                      <button
                        @click=${this.downloadPdf}
                        title="Baixar como PDF"
                        ?disabled=${!currentAnalysisInModal}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          height="24px"
                          viewBox="0 -960 960 960"
                          width="24px">
                          <path
                            d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320v80H240v640h480v-400h80v400q0 33-23.5 56.5T720-80H240Zm420-520v-280l280 280h-280Z" />
                        </svg>
                        <span>PDF</span>
                      </button>
                      <button
                        @click=${this.downloadMarkdown}
                        title="Baixar como Markdown (.md)"
                        ?disabled=${!currentAnalysisInModal}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          height="24px"
                          viewBox="0 -960 960 960"
                          width="24px">
                          <path
                            d="M480-320 280-520l56-56 104 104v-328h80v328l104-104 56 56-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
                        </svg>
                        <span>MD</span>
                      </button>
                      <button
                        @click=${this.shareAnalysis}
                        title="Compartilhar Análise"
                        ?disabled=${!currentAnalysisInModal}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          height="24px"
                          viewBox="0 -960 960 960"
                          width="24px">
                          <path
                            d="M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-14.5L323-400q-21 15-47.5 23T220-360q-50 0-85-35t-35-85q0-50 35-85t85-35q30 0 56.5 10.5T323-560l281-171q-1-5-1.5-11.5T602-760q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-28 0-53.5-9.5T620-640L340-468q1 7 1.5 13.5t.5 14.5q0 7-1 14.5t-3 14.5l281 171q21-14 47-21.5t54-7.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-640q17 0 28.5-11.5T760-760q0-17-11.5-28.5T720-800q-17 0-28.5 11.5T680-760q0 17 11.5 28.5T720-720ZM220-440q17 0 28.5-11.5T260-480q0-17-11.5-28.5T220-520q-17 0-28.5 11.5T180-480q0 17 11.5 28.5T220-440Zm500 280q17 0 28.5-11.5T760-200q0-17-11.5-28.5T720-240q-17 0-28.5 11.5T680-200q0 17 11.5 28.5T720-160Z" />
                        </svg>
                        <span>Compartilhar</span>
                      </button>
                      <button
                        class="primary-btn"
                        @click=${() => (this.showAnalysisModal = false)}>
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            `
          : ''}
        ${this.showTimelineModal
          ? html`
              <div
                class="modal-overlay"
                @click=${() => (this.showTimelineModal = false)}>
                <div
                  class="modal-content timeline-modal"
                  @click=${(e: Event) => e.stopPropagation()}>
                  <h3>Linha do Tempo da Sessão</h3>
                  <ul class="timeline-list">
                    ${this.timelineEvents.map(
                      (event) => html`
                        <li class="timeline-item timeline-type-${event.type}">
                          <div class="timeline-icon">
                            ${this.renderTimelineIcon(event.type)}
                          </div>
                          <div class="timeline-body">
                            <span class="timeline-message"
                              >${event.message}</span
                            >
                            <span class="timeline-timestamp"
                              >${event.timestamp}</span
                            >
                          </div>
                        </li>
                      `,
                    )}
                  </ul>
                  <div class="modal-actions">
                    <button
                      class="primary-btn"
                      @click=${() => (this.showTimelineModal = false)}>
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            `
          : ''}

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
      </div>
    `;
  }
}
