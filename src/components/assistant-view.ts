/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {
  Analysis,
  ProcessingState,
  SearchResult,
  TimelineEvent,
  SavedSession,
  SearchHistoryItem,
} from '../types/types';

// Import child components that this view renders.
import './analysis-form';
import './analysis-modal';
import './timeline-modal';
import './history-modal';
import './user-profile';
import './media-controls';
import './visualization/visual-3d';

/**
 * A component that encapsulates the main user interface for the assistant,
 * including the 3D visualization, status messages, media controls, and search results.
 */
@customElement('gdm-assistant-view')
export class AssistantView extends LitElement {
  @property({type: String}) status = '';
  @property({type: String}) error = '';
  @property({type: Array}) searchResults: SearchResult[] = [];
  @property({type: Boolean}) isRecording = false;
  @property({type: Boolean}) hasTimelineEvents = false;
  @property({type: Array}) analyses: Analysis[] = [];
  @property({type: String}) selectedAnalysisId: string | null = null;
  @property({type: Boolean}) showTimelineModal = false;
  @property({type: Boolean}) showHistoryModal = false;
  @property({type: Boolean}) showSidebar = false;
  @property({type: Array}) timelineEvents: TimelineEvent[] = [];
  @property({type: Array}) savedSessions: SavedSession[] = [];
  @property({type: Array}) searchHistory: SearchHistoryItem[] = [];
  @property({type: Object}) processingState: ProcessingState = {
    active: false,
    step: '',
    progress: 0,
  };
  @property({type: Object}) inputNode!: AudioNode;
  @property({type: Object}) outputNode!: AudioNode;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }

    .content-container {
      padding-top: 10vh;
      height: calc(100% - 10vh);
      box-sizing: border-box;
      overflow: hidden;
    }

    .main-content-area {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      height: 100%;
      color: rgba(255, 255, 255, 0.7);
      font-family: sans-serif;
      pointer-events: none; /* So it doesn't interfere with other elements */
      user-select: none;
      padding: 20px;
      box-sizing: border-box;
    }

    .main-content-area h1 {
      font-size: 3em;
      font-weight: 300;
      margin: 0 0 16px 0;
      color: #fff;
      text-shadow: 0 0 20px rgba(80, 120, 255, 0.3);
      letter-spacing: -1px;
    }

    .main-content-area p {
      font-size: 1.1em;
      max-width: 450px;
      line-height: 1.6;
    }

    .top-bar {
      position: absolute;
      top: 3vh;
      left: 50%;
      transform: translateX(-50%);
      width: 80%;
      max-width: 720px;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sidebar-toggle-button {
      background: none;
      border: none;
      color: #ccc;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .sidebar-toggle-button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    gdm-analysis-form {
      flex-grow: 1;
      min-width: 0; /* Prevents flex item from overflowing */
    }

    #status {
      position: absolute;
      bottom: 12vh;
      left: 50%;
      transform: translateX(-50%) translateY(10px); /* Start slightly lower */
      z-index: 10;
      color: rgba(255, 255, 255, 0.9);
      font-family: sans-serif;
      transition: opacity 0.3s ease, transform 0.3s ease;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      padding: 8px 16px;
      font-size: 14px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 20px;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      opacity: 0;
      white-space: nowrap;
      max-width: 90%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #status.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    #status.error {
      color: #ff8a80;
      background: rgba(80, 0, 0, 0.4);
    }

    .bottom-container {
      position: absolute;
      bottom: 2vh;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 10;
    }

    .visualizer-wrapper {
      width: 80px;
      height: 80px;
      position: relative;
    }

    .search-results {
      background: rgba(0, 0, 0, 0.3);
      padding: 8px 16px;
      border-radius: 12px;
      font-family: sans-serif;
      font-size: 13px;
      color: #ccc;
      backdrop-filter: blur(10px);
      position: absolute;
      bottom: 15vh;
      left: 50%;
      transform: translateX(-50%);
      max-width: 90%;
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

    .analysis-panel-main {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 768px) {
      .main-content-area h1 {
        font-size: 2.2em;
      }
      .main-content-area p {
        font-size: 1em;
      }
      .top-bar {
        width: 95%;
      }
      .bottom-container {
        gap: 4px;
      }
      .visualizer-wrapper {
        width: 64px;
        height: 64px;
      }
      #status {
        bottom: 12vh;
        font-size: 12px;
      }
    }
  `;

  private onTimelineModalClose() {
    this.dispatchEvent(
      new CustomEvent('close-timeline', {bubbles: true, composed: true}),
    );
  }

  private onHistoryModalClose() {
    this.dispatchEvent(
      new CustomEvent('close-history', {bubbles: true, composed: true}),
    );
  }

  private _openSidebar() {
    this.dispatchEvent(
      new CustomEvent('open-sidebar', {bubbles: true, composed: true}),
    );
  }

  render() {
    return html`
      <gdm-timeline-modal
        .show=${this.showTimelineModal}
        .events=${this.timelineEvents}
        .processingState=${this.processingState}
        @close=${this.onTimelineModalClose}></gdm-timeline-modal>

      <gdm-history-modal
        .show=${this.showHistoryModal}
        .sessions=${this.savedSessions}
        .searchHistory=${this.searchHistory}
        @close=${this.onHistoryModalClose}></gdm-history-modal>

      <div class="top-bar">
        ${!this.showSidebar
          ? html`
              <button
                class="sidebar-toggle-button"
                @click=${this._openSidebar}
                title="Abrir painel lateral">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="20px"
                  viewBox="0 -960 960 960"
                  width="20px"
                  fill="currentColor">
                  <path
                    d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
                </svg>
              </button>
            `
          : ''}
        <gdm-analysis-form
          .analyses=${this.analyses}
          .processingState=${this.processingState}></gdm-analysis-form>
      </div>
      <div class="content-container">
        ${
          this.analyses.length === 0 || !this.selectedAnalysisId
            ? html`
                <div class="main-content-area">
                  <h1>GeminiLiveAssistente.</h1>
                  <p>
                    Use o formulário acima para analisar conteúdo, ou os
                    controles abaixo para iniciar uma conversa.
                  </p>
                </div>
              `
            : html`
                <gdm-analysis-panel
                  class="analysis-panel-main"
                  .analyses=${this.analyses}
                  .selectedAnalysisId=${this.selectedAnalysisId}
                  @back=${(e: CustomEvent) =>
                    this.dispatchEvent(
                      new CustomEvent('back', e),
                    )}></gdm-analysis-panel>
              `
        }
      </div>

      <div
        id="status"
        class="${this.error ? 'error' : ''} ${this.error || this.status
          ? 'visible'
          : ''}">
        ${this.error || this.status}
      </div>

      ${
        this.searchResults.length > 0
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
          : ''
      }

      <div class="bottom-container">
        <div class="visualizer-wrapper">
          <gdm-live-audio-visuals-3d
            .inputNode=${this.inputNode}
            .outputNode=${this.outputNode}>
          </gdm-live-audio-visuals-3d>
        </div>
        <gdm-media-controls
          .isRecording=${this.isRecording}
          .hasTimelineEvents=${this.hasTimelineEvents}>
        </gdm-media-controls>
      </div>
    `;
  }
}