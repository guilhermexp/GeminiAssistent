/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html, svg} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import type {SavedSession} from './types';

@customElement('gdm-history-modal')
export class GdmHistoryModal extends LitElement {
  @property({type: Boolean}) show = false;
  @property({type: Array}) sessions: SavedSession[] = [];
  @state() private filterText = '';

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

    .sessions-list {
      list-style: none;
      padding: 0;
      margin: 0;
      flex-grow: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
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
  `;

  private _close() {
    this.dispatchEvent(new CustomEvent('close', {bubbles: true, composed: true}));
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

  render() {
    if (!this.show) {
      return html``;
    }

    const filteredSessions = this.sessions.filter((s) =>
      s.title.toLowerCase().includes(this.filterText.toLowerCase()),
    );

    return html`
      <div class="modal-overlay" @click=${this._close}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>Histórico de Sessões</h3>
            <button class="close-button" @click=${this._close} aria-label="Fechar">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
              </svg>
            </button>
          </div>

          <button class="save-session-button" @click=${this._saveSession}>
            Salvar Sessão Atual
          </button>

          <input
            type="text"
            class="search-input"
            placeholder="Pesquisar sessões..."
            .value=${this.filterText}
            @input=${(e: Event) =>
              (this.filterText = (e.target as HTMLInputElement).value)} />

          ${
            this.sessions.length > 0
              ? html`
                  <ul class="sessions-list">
                    ${repeat(
                      filteredSessions,
                      (session) => session.id,
                      (session) => html`
                        <li class="session-item">
                          <div class="session-info">
                            <p class="session-title" title=${session.title}>
                              ${session.title}
                            </p>
                            <span class="session-timestamp">
                              ${new Date(session.id).toLocaleString('pt-BR')}
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
                    <p>Nenhuma sessão salva ainda.</p>
                    <p>Clique em "Salvar Sessão Atual" para começar.</p>
                  </div>
                `
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-history-modal': GdmHistoryModal;
  }
}
