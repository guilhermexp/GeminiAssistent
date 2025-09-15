/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Session,
  Chat,
} from '@google/genai';
import {
  Analysis,
  ProcessingState,
  SearchResult,
  TimelineEvent,
  SavedSession,
  SearchHistoryItem,
  AppState,
  ChatMessage,
} from '../types/types';
import {AudioService} from './audio-service';
import {ContentAnalysisManager} from './content-analysis-manager';
import {generateCompositeSystemInstruction} from '../utils/system-instruction-builder';
import {isValidUrl} from '../utils/youtube-utils';

// Type for the state update listener
type StateListener = () => void;

const SESSIONS_STORAGE_KEY = 'gdm-live-audio-sessions';
const SEARCH_HISTORY_STORAGE_KEY = 'gdm-live-audio-search-history';

/**
 * A centralized service for managing the entire application state.
 */
export class StateService {
  private state: AppState;
  private listeners: StateListener[] = [];
  private statusTimeout: number | null = null;

  // Services and Clients
  private client: GoogleGenAI;
  private session: Session | null = null;
  private textChatSession: Chat | null = null;
  public readonly audioService: AudioService;
  private analysisManager: ContentAnalysisManager;

  constructor() {
    this.state = {
      analyses: [],
      selectedAnalysisId: null,
      processingState: {active: false, step: '', progress: 0},
      isRecording: false,
      status: '',
      error: '',
      searchResults: [],
      systemInstruction: '',
      timelineEvents: [],
      showTimelineModal: false,
      showHistoryModal: false,
      showSidebar: true,
      showVisualizerPanel: false,
      savedSessions: [],
      searchHistory: [],
      activePersona: null,
      chatHistory: [],
      isChatting: false,
      lastGeneratedImages: [],
    };

    this.client = new GoogleGenAI({apiKey: process.env.API_KEY});
    this.analysisManager = new ContentAnalysisManager(this.client);
    this.audioService = new AudioService({
      onInputAudio: (blob) => {
        if (this.state.isRecording && this.session) {
          this.session.sendRealtimeInput({media: blob});
        }
      },
    });

    this.loadSessions();
    this.loadSearchHistory();
    this.updateSystemInstruction();
    this.initializeTextChat();
  }

  // --- Core Methods ---

  public subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public getState(): Readonly<AppState> {
    return this.state;
  }

  private setState(updater: Partial<AppState>) {
    this.state = {...this.state, ...updater};
    this.notify();
  }

  // --- Session & Recording Logic ---

  public async initSession() {
    if (this.session) {
      // Session already exists, no need to initialize.
      return;
    }
    this.logEvent('Iniciando nova sessão de áudio...', 'connect');
    const model = 'gemini-2.5-flash-preview-native-audio-dialog';
    try {
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => this.updateStatus('Conectado.'),
          onmessage: this.handleLiveMessage,
          onerror: (e: ErrorEvent) => this.updateError(`Erro: ${e.message}`),
          onclose: (e: CloseEvent) => this.updateStatus('Conexão fechada.'),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Orus'}},
            languageCode: 'pt-BR',
          },
          systemInstruction: this.state.systemInstruction,
          tools: [{googleSearch: {}}],
        },
      });
      this.updateStatus('Sessão pronta.');
      this.logEvent('Sessão de áudio estabelecida.', 'success');
    } catch (e) {
      this.handleError(e, 'Falha ao iniciar a sessão');
    }
  }

  private handleLiveMessage = async (message: LiveServerMessage) => {
    const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (audio) {
      await this.audioService.playAudioChunk(audio);
    }
    if (message.serverContent?.interrupted) {
      this.audioService.interruptPlayback();
    }
    const groundingChunks =
      (message.serverContent as Record<string, any>)?.candidates?.[0]
        ?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      const searchResults = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          uri: chunk.web.uri,
          title: chunk.web.title || chunk.web.uri,
        }));
      this.setState({searchResults});
    }
  };

  public async startRecording() {
    if (this.state.isRecording) return;

    // Lazily initialize the session on the first recording attempt.
    if (!this.session) {
      this.updateStatus('Iniciando sessão...');
      await this.initSession();
    }

    this.setState({searchResults: []});
    try {
      this.updateStatus('Pedindo acesso ao microfone...');
      await this.audioService.start();
      this.setState({isRecording: true, status: 'Escutando...'});
      this.logEvent('Gravação iniciada.', 'record');
    } catch (err) {
      this.handleError(err, 'Erro ao iniciar gravação');
      this.stopRecording();
    }
  }

  public stopRecording() {
    if (!this.state.isRecording) return;
    this.audioService.stop();
    this.setState({isRecording: false});
    this.updateStatus('Gravação parada.');
    this.logEvent('Gravação parada.', 'record');
  }

  public async resetSession(clearAnalyses = true) {
    this.stopRecording();

    if (this.session) {
      await this.session.close();
      this.session = null;
    }

    const updates: Partial<AppState> = {searchResults: []};
    if (clearAnalyses) {
      updates.analyses = [];
      updates.activePersona = null;
      this.logEvent('Todos os contextos foram limpos.', 'info');
      this.setSelectedAnalysisId(null);
    }
    this.setState(updates);

    this.updateSystemInstruction();
    this.initializeTextChat();
    this.updateStatus('Sessão reiniciada.');
  }

  // --- Text Chat Logic ---

  private initializeTextChat() {
    if (!this.client) return;
    this.textChatSession = this.client.chats.create({
      model: 'gemini-2.5-flash',
      // Pass existing chat history to maintain context across resets
      history: this.state.chatHistory
        .filter((msg) => msg.text) // Filter out image-only messages if any
        .map((msg) => ({
          role: msg.role,
          parts: [{text: msg.text}],
        })),
      config: {
        systemInstruction: this.state.systemInstruction,
        tools: [{googleSearch: {}}],
      },
    });
    // Do not clear chat history here to maintain session context
    this.setState({isChatting: false});
  }

  private async _triggerImageGeneration(prompt: string, count: number) {
    const lastMessage = this.state.chatHistory[this.state.chatHistory.length - 1];
    if (!lastMessage || lastMessage.role !== 'model') return;

    // Set loading state
    lastMessage.isLoadingImages = true;
    lastMessage.imageCount = count;
    this.setState({chatHistory: [...this.state.chatHistory]});

    try {
      const response = await this.client.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: count,
        },
      });

      const newBase64Data = response.generatedImages.map(
        (img) => img.image.imageBytes,
      );
      const newImageUrls = newBase64Data.map(
        (b64) => `data:image/png;base64,${b64}`,
      );

      // Update message with images
      lastMessage.isLoadingImages = false;
      lastMessage.imageUrls = newImageUrls;
      this.setState({
        chatHistory: [...this.state.chatHistory],
        lastGeneratedImages: newBase64Data,
      });
    } catch (err) {
      lastMessage.isLoadingImages = false;
      lastMessage.text += `\n\n**Erro ao gerar imagem:** ${
        err instanceof Error ? err.message : 'Erro desconhecido'
      }`;
      this.setState({chatHistory: [...this.state.chatHistory]});
      this.handleError(err, 'Falha na geração de imagem');
    }
  }

  private async _triggerImageEditing(prompt: string) {
    const lastMessage = this.state.chatHistory[this.state.chatHistory.length - 1];
    if (!lastMessage || lastMessage.role !== 'model') return;

    if (this.state.lastGeneratedImages.length === 0) {
      lastMessage.text += `\n\n**Erro:** Não há nenhuma imagem recente para editar.`;
      this.setState({chatHistory: [...this.state.chatHistory]});
      return;
    }

    lastMessage.isLoadingImages = true;
    lastMessage.imageCount = 1;
    this.setState({chatHistory: [...this.state.chatHistory]});

    // For now, we only edit the first image of the last batch.
    const imageToEditB64 = this.state.lastGeneratedImages[0];

    try {
      const imagePart = {
        inlineData: {
          data: imageToEditB64,
          mimeType: 'image/png',
        },
      };
      const textPart = {text: prompt};

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {parts: [imagePart, textPart]},
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      let newImageUrl: string | null = null;
      let newBase64: string | null = null;
      let newText = '';

      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          newText += part.text;
        } else if (part.inlineData) {
          newBase64 = part.inlineData.data;
          newImageUrl = `data:${part.inlineData.mimeType};base64,${newBase64}`;
        }
      }

      lastMessage.isLoadingImages = false;
      lastMessage.text = newText || 'Aqui está a imagem editada.'; // Fallback text

      if (newImageUrl && newBase64) {
        lastMessage.imageUrls = [newImageUrl];
        this.setState({lastGeneratedImages: [newBase64]});
      } else {
        lastMessage.text += `\n\n**Erro:** A edição não retornou uma nova imagem.`;
      }

      this.setState({chatHistory: [...this.state.chatHistory]});
    } catch (err) {
      lastMessage.isLoadingImages = false;
      lastMessage.text += `\n\n**Erro ao editar imagem:** ${
        err instanceof Error ? err.message : 'Erro desconhecido'
      }`;
      this.setState({chatHistory: [...this.state.chatHistory]});
      this.handleError(err, 'Falha na edição de imagem');
    }
  }

  public async sendTextMessage(message: string) {
    if (!this.textChatSession || this.state.isChatting || !message.trim()) {
      return;
    }

    const userMessage: ChatMessage = {role: 'user', text: message};
    this.setState({
      isChatting: true,
      chatHistory: [...this.state.chatHistory, userMessage],
      searchResults: [],
    });

    try {
      const stream = await this.textChatSession.sendMessageStream({message});

      const modelMessage: ChatMessage = {role: 'model', text: ''};
      this.setState({
        chatHistory: [...this.state.chatHistory, modelMessage],
      });

      let accumulatedText = '';
      const allSearchResults = new Map<string, SearchResult>();

      const generateRegex = /\[generate_images\((\d+)\):\s*'([^']+)']/;
      const editRegex = /\[edit_image:\s*'([^']+)']/;
      let commandProcessed = false;

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
          accumulatedText += chunkText;

          if (!commandProcessed) {
            const genMatch = accumulatedText.match(generateRegex);
            const editMatch = accumulatedText.match(editRegex);

            if (genMatch) {
              commandProcessed = true;
              const count = parseInt(genMatch[1], 10);
              const prompt = genMatch[2];
              // Remove command from displayed text
              accumulatedText = accumulatedText.replace(generateRegex, '').trim();
              // Fire and forget, UI is updated internally
              this._triggerImageGeneration(prompt, count);
            } else if (editMatch) {
              commandProcessed = true;
              const prompt = editMatch[1];
              // Remove command from displayed text
              accumulatedText = accumulatedText.replace(editRegex, '').trim();
              this._triggerImageEditing(prompt);
            }
          }

          const lastMessage =
            this.state.chatHistory[this.state.chatHistory.length - 1];
          if (lastMessage && lastMessage.role === 'model') {
            lastMessage.text = accumulatedText;
            this.setState({chatHistory: [...this.state.chatHistory]});
          }
        }

        const groundingChunks =
          chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
          groundingChunks
            .filter((c: any) => c.web)
            .forEach((c: any) => {
              allSearchResults.set(c.web.uri, {
                uri: c.web.uri,
                title: c.web.title || c.web.uri,
              });
            });
        }
      }

      this.setState({
        isChatting: false,
        searchResults: Array.from(allSearchResults.values()),
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro desconhecido';
      this.handleError(err, 'Falha na mensagem de chat');
      const lastMessage =
        this.state.chatHistory[this.state.chatHistory.length - 1];
      if (lastMessage && lastMessage.role === 'model') {
        lastMessage.text += `\n\n**Desculpe, ocorreu um erro:** ${error}`;
        this.setState({
          isChatting: false,
          chatHistory: [...this.state.chatHistory],
        });
      }
    }
  }

  // --- Content Analysis Logic ---

  public async analyzeContent(detail: {
    urlOrTopic: string;
    file: File | null;
    analysisMode: 'default' | 'vibecode' | 'workflow';
  }) {
    const {urlOrTopic, file, analysisMode} = detail;

    if (!file && urlOrTopic.trim() && !isValidUrl(urlOrTopic.trim())) {
      const searchTerm = urlOrTopic.trim();
      if (
        !this.state.searchHistory.some(
          (item) => item.term.toLowerCase() === searchTerm.toLowerCase(),
        )
      ) {
        const newSearch: SearchHistoryItem = {
          id: Date.now().toString(),
          term: searchTerm,
        };
        this.state.searchHistory = [newSearch, ...this.state.searchHistory];
        this.saveSearchHistory();
      }
    }

    try {
      const {newAnalyses, newSystemInstruction, newAnalysis} =
        await this.analysisManager.handleAnalysisRequest(
          urlOrTopic,
          file,
          analysisMode,
          this.state.analyses,
          this.state.activePersona,
          {
            setProcessingState: this.setProcessingState,
            logEvent: this.logEvent,
          },
        );

      this.logEvent(
        `Análise "${newAnalysis.title}" concluída e adicionada ao contexto.`,
        'success',
      );

      this.setState({
        analyses: newAnalyses,
        systemInstruction: newSystemInstruction,
      });
      this.setSelectedAnalysisId(newAnalysis.id);

      // Reset voice session and text chat with new context
      await this.resetSession(false);
      // Clear chat history when context changes
      this.setState({chatHistory: []});
      this.initializeTextChat();
    } catch (err) {
      this.handleError(err, 'Falha na análise');
    } finally {
      this.setProcessingState(false);
    }
  }

  public async removeAnalysis(idToRemove: string) {
    const newAnalyses = this.state.analyses.filter((a) => a.id !== idToRemove);
    let newSelectedId = this.state.selectedAnalysisId;

    if (idToRemove === this.state.selectedAnalysisId) {
      newSelectedId = newAnalyses[0]?.id || null;
    }

    this.setState({analyses: newAnalyses, chatHistory: []}); // Clear chat
    this.setSelectedAnalysisId(newSelectedId);
    this.logEvent('Contexto removido.', 'info');
    this.updateSystemInstruction();
    await this.resetSession(false);
    this.initializeTextChat();
  }

  public async updateAnalysisSummary(analysisId: string, newSummary: string) {
    const analysisIndex = this.state.analyses.findIndex(
      (a) => a.id === analysisId,
    );
    if (analysisIndex === -1) return;

    const updatedAnalyses = [...this.state.analyses];
    const currentAnalysis = updatedAnalyses[analysisIndex];
    updatedAnalyses[analysisIndex] = {
      ...currentAnalysis,
      summary: newSummary,
    };

    this.setState({analyses: updatedAnalyses, chatHistory: []}); // Clear chat
    this.updateSystemInstruction();
    this.logEvent(`Análise "${currentAnalysis.title}" atualizada.`, 'info');
    await this.resetSession(false);
    this.initializeTextChat();
  }

  public async insertImageIntoAnalysis(imageUrl: string) {
    if (!this.state.selectedAnalysisId) {
      this.updateError(
        'Nenhuma análise selecionada para inserir a imagem.',
      );
      return;
    }

    const analysisIndex = this.state.analyses.findIndex(
      (a) => a.id === this.state.selectedAnalysisId,
    );
    if (analysisIndex === -1) return;

    const updatedAnalyses = [...this.state.analyses];
    const currentAnalysis = updatedAnalyses[analysisIndex];

    const markdownImage = `\n\n![Imagem Gerada pelo Assistente](${imageUrl})\n`;
    const newSummary = currentAnalysis.summary + markdownImage;

    updatedAnalyses[analysisIndex] = {
      ...currentAnalysis,
      summary: newSummary,
    };

    this.setState({analyses: updatedAnalyses});
    this.updateSystemInstruction();
    this.logEvent(`Imagem inserida na análise "${currentAnalysis.title}".`, 'info');
    this.updateStatus('Imagem inserida na análise!');

    // Refresh AI context
    await this.resetSession(false);
    this.initializeTextChat();
  }

  // --- State Setters ---

  public setShowTimelineModal = (show: boolean) =>
    this.setState({showTimelineModal: show});
  public setShowHistoryModal = (show: boolean) =>
    this.setState({showHistoryModal: show});

  private updateVisualizerPanelVisibility() {
    this.setState({showVisualizerPanel: !!this.state.selectedAnalysisId});
  }

  public setSelectedAnalysisId = (id: string | null) => {
    this.setState({selectedAnalysisId: id});
    this.updateVisualizerPanelVisibility();
  };

  public async setPersona(persona: string | null) {
    this.setState({activePersona: persona, chatHistory: []}); // Clear chat
    this.logEvent(`Persona alterada para: ${persona || 'Padrão'}`);
    this.updateSystemInstruction();
    await this.resetSession(false);
    this.initializeTextChat();
  }

  private updateStatus = (msg: string) => {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }
    this.setState({status: msg, error: ''});

    // Don't auto-clear empty or "Recording" messages
    if (msg && msg !== 'Escutando...') {
      this.statusTimeout = window.setTimeout(() => {
        // Only clear if the message hasn't changed in the meantime
        if (this.state.status === msg) {
          this.setState({status: ''});
        }
      }, 3000);
    }
  };
  private updateError = (msg: string) => {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }
    this.setState({error: msg, status: ''});
    this.logEvent(msg, 'error');

    // Errors should also disappear
    this.statusTimeout = window.setTimeout(() => {
      if (this.state.error === msg) {
        this.setState({error: ''});
      }
    }, 5000);
  };
  private handleError = (err: unknown, context: string) => {
    const message = err instanceof Error ? err.message : String(err);
    this.updateError(`${context}: ${message}`);
  };
  public setProcessingState = (active: boolean, step = '', progress = 0) => {
    this.setState({processingState: {active, step, progress}});
  };
  private logEvent = (
    message: string,
    type: TimelineEvent['type'] = 'info',
  ) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    this.setState({
      timelineEvents: [
        ...this.state.timelineEvents,
        {timestamp, message, type},
      ],
    });
  };

  private updateSystemInstruction() {
    const newInstruction = generateCompositeSystemInstruction(
      this.state.analyses,
      this.state.activePersona,
    );
    this.setState({systemInstruction: newInstruction});
  }

  // --- History Management ---

  private saveSessions = () =>
    localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify(this.state.savedSessions),
    );
  private loadSessions = () => {
    const data = localStorage.getItem(SESSIONS_STORAGE_KEY);
    this.state.savedSessions = data ? JSON.parse(data) : [];
  };

  private saveSearchHistory = () =>
    localStorage.setItem(
      SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(this.state.searchHistory),
    );
  private loadSearchHistory = () => {
    const data = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    this.state.searchHistory = data ? JSON.parse(data) : [];
  };

  public saveCurrentSession = () => {
    const title =
      prompt(
        'Digite um nome para esta sessão:',
        this.state.analyses[0]?.title ||
          `Sessão de ${new Date().toLocaleDateString()}`,
      ) || 'Sessão Salva';

    const newSession: SavedSession = {
      id: Date.now().toString(),
      title,
      analyses: this.state.analyses,
      timelineEvents: this.state.timelineEvents,
      systemInstruction: this.state.systemInstruction,
      searchResults: this.state.searchResults,
      activePersona: this.state.activePersona,
    };
    const savedSessions = [newSession, ...this.state.savedSessions];
    this.setState({savedSessions});
    this.saveSessions();
    this.logEvent(`Sessão "${title}" salva.`, 'history');
  };

  public async loadSession(sessionId: string) {
    const sessionToLoad = this.state.savedSessions.find(
      (s) => s.id === sessionId,
    );
    if (sessionToLoad) {
      this.setState({
        analyses: sessionToLoad.analyses,
        timelineEvents: sessionToLoad.timelineEvents,
        systemInstruction: sessionToLoad.systemInstruction,
        searchResults: sessionToLoad.searchResults,
        activePersona: sessionToLoad.activePersona,
        showHistoryModal: false,
        chatHistory: [], // Start with a fresh chat for the loaded session
        lastGeneratedImages: [],
      });
      const selectedId = sessionToLoad.analyses[0]?.id || null;
      this.setSelectedAnalysisId(selectedId);
      await this.resetSession(false);
      this.initializeTextChat();
      this.logEvent(`Sessão "${sessionToLoad.title}" carregada.`, 'history');
    }
  }

  public deleteSession(sessionId: string) {
    const savedSessions = this.state.savedSessions.filter(
      (s) => s.id !== sessionId,
    );
    this.setState({savedSessions});
    this.saveSessions();
    this.logEvent('Sessão excluída.', 'history');
  }

  public async selectSearchHistory(term: string) {
    this.setShowHistoryModal(false);
    await this.analyzeContent({
      urlOrTopic: term,
      file: null,
      analysisMode: 'default',
    });
  }

  public deleteSearchHistoryItem(searchId: string) {
    const searchHistory = this.state.searchHistory.filter(
      (s) => s.id !== searchId,
    );
    this.setState({searchHistory});
    this.saveSearchHistory();
    this.logEvent('Pesquisa excluída do histórico.', 'history');
  }

  public setShowSidebar = (show: boolean) => this.setState({showSidebar: show});
}