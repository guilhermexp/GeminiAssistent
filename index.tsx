/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {StateService} from './src/services/state-service';

// Import all shell and view components
import './src/components/assistant-shell';
import './src/components/sidebar';
import './src/components/assistant-view';
import './src/components/visualizer-panel';
import './src/components/chat-panel';

/**
 * The main application component. It initializes the state service,
 * subscribes to state changes, and renders the main application shell.
 * It also acts as the central hub for dispatching user actions to the state service.
 */
@customElement('gdm-live-audio')
class GdmLiveAudio extends LitElement {
  @state() private stateService = new StateService();
  @state() private appState = this.stateService.getState();
  private unsubscribe: (() => void) | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = this.stateService.subscribe(() => {
      this.appState = this.stateService.getState();
    });
    // Initial state sync
    this.appState = this.stateService.getState();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    // Clean up session on component removal
    this.stateService.resetSession();
  }

  // --- Event Handlers ---

  private async handleAnalysisSubmit(e: CustomEvent) {
    await this.stateService.analyzeContent(e.detail);
  }

  private handleRemoveAnalysis(e: CustomEvent) {
    this.stateService.removeAnalysis(e.detail.id);
  }

  private async handleSelectAnalysis(e: CustomEvent) {
    await this.stateService.setSelectedAnalysisId(e.detail.id);
  }

  private handleUpdateAnalysis(e: CustomEvent) {
    this.stateService.updateAnalysisSummary(e.detail.id, e.detail.summary);
  }

  private handlePersonaChange(e: CustomEvent) {
    this.stateService.setPersona(e.detail.persona);
  }

  private handleStartRecording() {
    this.stateService.startRecording();
  }

  private handleStopRecording() {
    this.stateService.stopRecording();
  }

  private handleReset() {
    this.stateService.resetSession();
  }

  private handleShowTimeline() {
    this.stateService.setShowTimelineModal(true);
  }

  private handleCloseTimeline() {
    this.stateService.setShowTimelineModal(false);
  }

  private handleShowHistory() {
    this.stateService.setShowHistoryModal(true);
  }

  private handleCloseHistory() {
    this.stateService.setShowHistoryModal(false);
  }

  private handleSaveSession() {
    this.stateService.saveCurrentSession();
  }

  private handleLoadSession(e: CustomEvent) {
    this.stateService.loadSession(e.detail.sessionId);
  }

  private handleDeleteSession(e: CustomEvent) {
    this.stateService.deleteSession(e.detail.sessionId);
  }

  private handleSelectSearchHistory(e: CustomEvent) {
    this.stateService.selectSearchHistory(e.detail.term);
  }

  private handleDeleteSearchHistory(e: CustomEvent) {
    this.stateService.deleteSearchHistoryItem(e.detail.searchId);
  }

  private async handleBack() {
    await this.stateService.setSelectedAnalysisId(null);
  }

  private handleCloseSidebar() {
    this.stateService.setShowSidebar(false);
  }

  private handleOpenSidebar() {
    this.stateService.setShowSidebar(true);
  }

  private handleSendTextMessage(e: CustomEvent) {
    this.stateService.sendTextMessage(e.detail.message);
  }

  private handleInsertImageInAnalysis(e: CustomEvent) {
    this.stateService.insertImageIntoAnalysis(e.detail.imageUrl);
  }

  // --- Render Method ---

  render() {
    const state = this.appState;
    // The shell now correctly receives event handlers to dispatch actions
    return html`
      <gdm-assistant-shell
        ?sidebarOpen=${state.showSidebar}
        ?visualizerPanelOpen=${state.showVisualizerPanel}>
        <gdm-sidebar
          slot="sidebar"
          .analyses=${state.analyses}
          .selectedAnalysisId=${state.selectedAnalysisId}
          .activePersona=${state.activePersona}
          @select-analysis=${this.handleSelectAnalysis}
          @analysis-remove=${this.handleRemoveAnalysis}
          @persona-change=${this.handlePersonaChange}
          @show-history=${this.handleShowHistory}
          @reset=${this.handleReset}
          @new-analysis=${this.handleBack}
          @close-sidebar=${this.handleCloseSidebar}></gdm-sidebar>

        <gdm-assistant-view
          slot="assistant-view"
          .status=${state.status}
          .error=${state.error}
          .searchResults=${state.searchResults}
          .isRecording=${state.isRecording}
          .hasTimelineEvents=${state.timelineEvents.length > 0}
          .analyses=${state.analyses}
          .selectedAnalysisId=${state.selectedAnalysisId}
          .showTimelineModal=${state.showTimelineModal}
          .showHistoryModal=${state.showHistoryModal}
          .showSidebar=${state.showSidebar}
          .timelineEvents=${state.timelineEvents}
          .savedSessions=${state.savedSessions}
          .searchHistory=${state.searchHistory}
          .processingState=${state.processingState}
          .inputNode=${this.stateService.audioService.inputNode}
          .outputNode=${this.stateService.audioService.outputNode}
          @analysis-submit=${this.handleAnalysisSubmit}
          @start-recording=${this.handleStartRecording}
          @stop-recording=${this.handleStopRecording}
          @reset=${this.handleReset}
          @show-timeline=${this.handleShowTimeline}
          @close-timeline=${this.handleCloseTimeline}
          @show-history=${this.handleShowHistory}
          @close-history=${this.handleCloseHistory}
          @save-session=${this.handleSaveSession}
          @load-session=${this.handleLoadSession}
          @delete-session=${this.handleDeleteSession}
          @search-history-select=${this.handleSelectSearchHistory}
          @delete-search-history=${this.handleDeleteSearchHistory}
          @back=${this.handleBack}
          @analysis-update=${this.handleUpdateAnalysis}
          @open-sidebar=${this.handleOpenSidebar}></gdm-assistant-view>

        <gdm-visualizer-panel
          slot="visualizer-panel"
          .analyses=${state.analyses}
          .selectedAnalysisId=${state.selectedAnalysisId}
          .chatHistory=${state.chatHistory}
          .isChatting=${state.isChatting}
          @analysis-remove=${(e: CustomEvent) =>
            this.stateService.removeAnalysis(e.detail.idToRemove)}
          @send-text-message=${this.handleSendTextMessage}
          @insert-image-in-analysis=${this.handleInsertImageInAnalysis}>
        </gdm-visualizer-panel>
      </gdm-assistant-shell>
    `;
  }
}
