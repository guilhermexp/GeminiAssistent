/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, LiveServerMessage, Modality, Session} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

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

// Import the new sub-components
import './analysis-form';
import './media-controls';
import './analysis-modal';
import './timeline-modal';

// =================================================================
// MAIN LIT COMPONENT
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
  @state() showAnalysisModal = false;
  @state() showTimelineModal = false;
  @state() searchResults: SearchResult[] = [];
  @state() timelineEvents: TimelineEvent[] = [];
  @state() analyses: Analysis[] = [];
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

    this.logEvent(`Contexto adicionado: "${contentInfo.title}"`, 'success');

    const compositeInstruction = this.generateCompositeSystemInstruction();
    await this.initSession(compositeInstruction);

    const titleToShow =
      this.analyses.length > 1
        ? 'Múltiplos contextos'
        : this.analyses[0].title;
    this.updateStatus(`Pronto! Pergunte sobre "${titleToShow}"`);
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
      const result = await this.analysisService.analyze(
        urlOrTopic,
        file,
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

  private async removeAnalysis(e: CustomEvent) {
    const {idToRemove} = e.detail;
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
    this.searchResults = [];
    this.initSession(); // Re-initializes with default prompt
    this.updateStatus('Sessão reiniciada.');
    this.logEvent('Sessão reiniciada e todos os contextos foram limpos.', 'info');
  }

  render() {
    return html`
      <div>
        <gdm-analysis-modal
          .show=${this.showAnalysisModal}
          .analyses=${this.analyses}
          @close=${() => (this.showAnalysisModal = false)}></gdm-analysis-modal>

        <gdm-timeline-modal
          .show=${this.showTimelineModal}
          .events=${this.timelineEvents}
          @close=${() =>
            (this.showTimelineModal = false)}></gdm-timeline-modal>

        <gdm-analysis-form
          .analyses=${this.analyses}
          .processingState=${this.processingState}
          @analysis-submit=${this.handleAnalysisSubmit}
          @analysis-remove=${this.removeAnalysis}></gdm-analysis-form>

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

          <gdm-media-controls
            .isRecording=${this.isRecording}
            .hasAnalyses=${this.analyses.length > 0}
            .hasTimelineEvents=${this.timelineEvents.length > 0}
            @start-recording=${this.startRecording}
            @stop-recording=${this.stopRecording}
            @reset=${this.reset}
            @show-analysis=${() => (this.showAnalysisModal = true)}
            @show-timeline=${() =>
              (this.showTimelineModal = true)}></gdm-media-controls>
        </div>

        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}></gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}
