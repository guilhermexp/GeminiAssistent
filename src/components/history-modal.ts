/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html, svg} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import type {Analysis, SavedSession, SearchHistoryItem} from '../types/types';
import {getYouTubeVideoId} from '../utils/youtube-utils';
import './video-player.js';

@customElement('gdm-history-modal')
export class GdmHistoryModal extends LitElement {
  @property({type: Boolean}) show = false;
  @property({type: Array}) sessions: SavedSession[] = [];
  @property({type: Array}) searchHistory: SearchHistoryItem[] = [];

  @state() private filterText = '';
  @state() private activeTab: 'sessions' | 'youtube' | 'search' = 'sessions';
  @state() private selectedVideo: Analysis | null = null;

  static styles = css`
    :host {
      --primary-color: #5078ff;
      --background-color: rgba(30, 30, 30, 0.95);
      --border-color: rgba(255, 255, 255, 0.2);
      --text-color: #eee;
      --text-color-secondary: #aaa;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .modal-content {
      background: var(--background-color);
      padding: 24px;
      border-radius: 12px;
      width: clamp(300px, 90vw, 700px);
      max-height: 85vh;
      border: 1px solid var(--border-color);
      color: var(--text-color);
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: relative; /* For video player overlay */
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }

    .modal-header h3 {
      margin: 0;
      color: var(--primary-color);
    }

    .modal-header .close-button {
      background: none;
      border: none;
      color: var(--text-color-secondary);
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
    }
    .modal-header .close-button:hover {
      color: var(--text-color);
      background-color: rgba(255, 255, 255, 0.1);
    }

    .save-session-button {
      width: 100%;
      padding: 12px 20px;
      border-radius: 8px;
      border: none;
      background: var(--primary-color);
      color: white;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      transition: background-color 0.2s;
      flex-shrink: 0;
      margin-top: 16px;
    }
    .save-session-button:hover {
      background: #6a8dff;
    }

    .search-input {
      width: 100%;
      padding: 10px 16px;
      background-color: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border-color);
      color: var(--text-color);
      border-radius: 8px;
      font-size: 14px;
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    .list-container {
      flex-grow: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      /* For better scrollbar appearance */
      scrollbar-width: thin;
      scrollbar-color: #5078ff #1e1e1e;
    }

    .sessions-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .session-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      transition: background-color 0.2s;
    }
    .session-item:not(:last-child) {
      margin-bottom: 8px;
    }
    .session-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .session-info {
      flex-grow: 1;
      min-width: 0;
    }
    .session-title {
      font-size: 0.95em;
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 0 0 4px 0;
    }
    .session-timestamp {
      font-size: 0.8em;
      color: var(--text-color-secondary);
    }

    .session-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .session-actions button {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid transparent;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .session-actions .load-button {
      background: rgba(80, 120, 255, 0.2);
      color: #a9bfff;
      border-color: #5078ff;
    }
    .session-actions .load-button:hover {
      background: rgba(80, 120, 255, 0.4);
      color: white;
    }
    .session-actions .delete-button {
      background: rgba(255, 100, 100, 0.1);
      color: #ffacad;
      border-color: transparent;
    }
    .session-actions .delete-button:hover {
      background: rgba(255, 100, 100, 0.3);
      color: white;
      border-color: #ff6464;
    }

    .no-sessions {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-color-secondary);
      font-style: italic;
    }

    /* New styles for tabs */
    .tabs-container {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }
    .tab-button {
      padding: 12px 20px;
      cursor: pointer;
      background: none;
      border: none;
      color: var(--text-color-secondary);
      font-weight: 500;
      font-size: 15px;
      border-bottom: 3px solid transparent;
      margin-bottom: -1px;
    }
    .tab-button:hover {
      color: var(--text-color);
    }
    .tab-button.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }

    /* New styles for youtube list */
    .youtube-list {
      list-style: none;
      padding: 8px;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }

    .youtube-item {
      cursor: pointer;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      transition: background-color 0.2s;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .youtube-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .youtube-thumbnail {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-bottom: 1px solid var(--border-color);
    }
    .youtube-info {
      padding: 12px;
      flex-grow: 1;
    }
    .youtube-title {
      font-size: 0.9em;
      color: var(--text-color);
      margin: 0;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* New styles for video player overlay */
    .video-player-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      flex-direction: column;
      z-index: 10;
      padding: 24px;
      box-sizing: border-box;
    }
    .video-player-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-shrink: 0;
      color: var(--text-color);
    }
    .video-player-header h4 {
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-right: 16px;
    }
    .video-player-container {
      flex-grow: 1;
      position: relative;
    }
  `;

  private get youtubeHistory(): Analysis[] {
    const seenUrls = new Set<string>();
    const youtubeAnalyses: Analysis[] = [];
    for (const session of [...this.sessions].reverse()) {
      for (const analysis of session.analyses) {
        if (analysis.type === 'youtube' && !seenUrls.has(analysis.source)) {
          seenUrls.add(analysis.source);
          youtubeAnalyses.push(analysis);
        }
      }
    }
    return youtubeAnalyses;
  }

  private getYoutubeThumbnail(url: string): string {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '';
  }

  private playVideo(video: Analysis) {
    this.selectedVideo = video;
  }

  private closePlayer() {
    this.selectedVideo = null;
  }

  private _close() {
    this.dispatchEvent(
      new CustomEvent('close', {bubbles: true, composed: true}),
    );
    // Reset state on close
    this.selectedVideo = null;
    this.activeTab = 'sessions';
    this.filterText = '';
  }

  private _saveSession() {
    this.dispatchEvent(
      new CustomEvent('save-session', {bubbles: true, composed: true}),
    );
  }

  private _loadSession(sessionId: string) {
    this.dispatchEvent(
      new CustomEvent('load-session', {
        detail: {sessionId},
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _deleteSession(sessionId: string) {
    if (
      confirm(
        'Tem certeza de que deseja excluir esta sessão? Esta ação não pode ser desfeita.',
      )
    ) {
      this.dispatchEvent(
        new CustomEvent('delete-session', {
          detail: {sessionId},
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _selectSearchTerm(term: string) {
    this.dispatchEvent(
      new CustomEvent('search-history-select', {
        detail: {term},
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _deleteSearchTerm(searchId: string) {
    if (
      confirm('Tem certeza de que deseja excluir esta pesquisa do seu histórico?')
    ) {
      this.dispatchEvent(
        new CustomEvent('delete-search-history', {
          detail: {searchId},
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  render() {
    if (!this.show) {
      return html``;
    }

    const filteredSessions = this.sessions.filter((s) =>
      s.title.toLowerCase().includes(this.filterText.toLowerCase()),
    );

    const filteredYoutubeHistory = this.youtubeHistory.filter((video) =>
      video.title.toLowerCase().includes(this.filterText.toLowerCase()),
    );

    const filteredSearchHistory = this.searchHistory.filter((s) =>
      s.term.toLowerCase().includes(this.filterText.toLowerCase()),
    );

    return html`
      <div class="modal-overlay" @click=${this._close}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>Histórico</h3>
            <button
              class="close-button"
              @click=${this._close}
              aria-label="Fechar">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24px"
                viewBox="0 -960 960 960"
                width="24px"
                fill="currentColor">
                <path
                  d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
              </svg>
            </button>
          </div>

          <div class="tabs-container">
            <button
              class="tab-button ${this.activeTab === 'sessions'
                ? 'active'
                : ''}"
              @click=${() => (this.activeTab = 'sessions')}>
              Sessões
            </button>
            <button
              class="tab-button ${this.activeTab === 'youtube'
                ? 'active'
                : ''}"
              @click=${() => (this.activeTab = 'youtube')}>
              YouTube
            </button>
            <button
              class="tab-button ${this.activeTab === 'search' ? 'active' : ''}"
              @click=${() => (this.activeTab = 'search')}>
              Pesquisas
            </button>
          </div>

          <input
            type="text"
            class="search-input"
            placeholder=${this.activeTab === 'sessions'
              ? 'Pesquisar sessões...'
              : this.activeTab === 'youtube'
              ? 'Pesquisar vídeos...'
              : 'Pesquisar histórico...'}
            .value=${this.filterText}
            @input=${(e: Event) =>
              (this.filterText = (e.target as HTMLInputElement).value)} />

          <div class="list-container">
            ${this.activeTab === 'sessions'
              ? this.renderSessionsList(filteredSessions)
              : this.activeTab === 'youtube'
              ? this.renderYoutubeList(filteredYoutubeHistory)
              : this.renderSearchHistoryList(filteredSearchHistory)}
          </div>

          ${this.selectedVideo ? this.renderVideoPlayer() : ''}
        </div>
      </div>
    `;
  }

  renderSessionsList(sessions: SavedSession[]) {
    return html`
      ${sessions.length > 0
        ? html`
            <ul class="sessions-list">
              ${repeat(
                sessions,
                (session) => session.id,
                (session) => html`
                  <li class="session-item">
                    <div class="session-info">
                      <p class="session-title" title=${session.title}>
                        ${session.title}
                      </p>
                      <span class="session-timestamp">
                        ${new Date(Number(session.id)).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div class="session-actions">
                      <button
                        class="load-button"
                        @click=${() => this._loadSession(session.id)}>
                        Carregar
                      </button>
                      <button
                        class="delete-button"
                        @click=${() => this._deleteSession(session.id)}>
                        Excluir
                      </button>
                    </div>
                  </li>
                `,
              )}
            </ul>
          `
        : html`
            <div class="no-sessions">
              <p>Nenhuma sessão corresponde à sua pesquisa.</p>
            </div>
          `}
      <button class="save-session-button" @click=${this._saveSession}>
        Salvar Sessão Atual
      </button>
    `;
  }

  renderYoutubeList(videos: Analysis[]) {
    return html`
      ${videos.length > 0
        ? html`
            <ul class="youtube-list">
              ${repeat(
                videos,
                (video) => video.id,
                (video) => html`
                  <li
                    class="youtube-item"
                    @click=${() => this.playVideo(video)}
                    title=${video.title}>
                    <img
                      class="youtube-thumbnail"
                      src=${this.getYoutubeThumbnail(video.source)}
                      alt="Thumbnail for ${video.title}"
                      loading="lazy" />
                    <div class="youtube-info">
                      <p class="youtube-title">${video.title}</p>
                    </div>
                  </li>
                `,
              )}
            </ul>
          `
        : html`
            <div class="no-sessions">
              <p>
                ${this.filterText
                  ? 'Nenhum vídeo corresponde à sua pesquisa.'
                  : 'Nenhum vídeo do YouTube foi analisado ainda.'}
              </p>
              ${!this.filterText
                ? html`<p>Analise um vídeo para vê-lo aqui.</p>`
                : ''}
            </div>
          `}
    `;
  }

  renderSearchHistoryList(searches: SearchHistoryItem[]) {
    return html`
      ${searches.length > 0
        ? html`
            <ul class="sessions-list">
              ${repeat(
                searches,
                (search) => search.id,
                (search) => html`
                  <li class="session-item">
                    <div class="session-info">
                      <p class="session-title" title=${search.term}>
                        ${search.term}
                      </p>
                      <span class="session-timestamp">
                        ${new Date(Number(search.id)).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div class="session-actions">
                      <button
                        class="load-button"
                        @click=${() => this._selectSearchTerm(search.term)}>
                        Pesquisar
                      </button>
                      <button
                        class="delete-button"
                        @click=${() => this._deleteSearchTerm(search.id)}>
                        Excluir
                      </button>
                    </div>
                  </li>
                `,
              )}
            </ul>
          `
        : html`
            <div class="no-sessions">
              <p>
                ${this.filterText
                  ? 'Nenhuma pesquisa corresponde à sua busca.'
                  : 'Nenhuma pesquisa foi realizada ainda.'}
              </p>
              ${!this.filterText
                ? html`<p>Use a barra principal para pesquisar um tema.</p>`
                : ''}
            </div>
          `}
    `;
  }

  renderVideoPlayer() {
    return html`
      <div class="video-player-overlay">
        <div class="video-player-header">
          <h4>${this.selectedVideo?.title}</h4>
          <button
            class="close-button"
            @click=${this.closePlayer}
            aria-label="Fechar Player">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="currentColor">
              <path
                d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
            </svg>
          </button>
        </div>
        <div class="video-player-container">
          <gdm-video-player
            .src=${this.selectedVideo?.previewData ||
            ''}></gdm-video-player>
        </div>
      </div>
    `;
  }
}
