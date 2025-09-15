/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import type {Analysis} from '../types/types';
import './user-profile';

@customElement('gdm-sidebar')
export class GdmSidebar extends LitElement {
  @property({type: Boolean}) show = false;
  @property({type: Array}) analyses: Analysis[] = [];
  @property({type: String}) selectedAnalysisId: string | null = null;
  @property({type: String}) activePersona: string | null = null;

  @state() private filterText = '';
  @state() private selectedTag: string | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #2a2a2a;
      color: #eee;
      font-family: sans-serif;
      overflow: hidden;
      box-sizing: border-box;
      border-radius: 0;
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 20px 16px 20px;
      flex-shrink: 0;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }

    .header-title .dot {
      width: 10px;
      height: 10px;
      background-color: #5078ff;
      border-radius: 50%;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .action-button {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .action-button:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, 0.1);
    }

    .sidebar-body {
      flex-grow: 1;
      overflow-y: auto;
      padding: 16px 20px 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: #aaa;
      text-transform: uppercase;
      margin: 0;
    }

    .search-container {
      position: relative;
    }
    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #888;
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      padding: 10px 16px 10px 42px;
      background-color: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #eee;
      border-radius: 8px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .search-input:focus {
      outline: none;
      border-color: #5078ff;
    }

    .tag-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tag-pill {
      background: rgba(255, 255, 255, 0.05);
      color: #ccc;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }
    .tag-pill:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .tag-pill.active {
      background: rgba(80, 120, 255, 0.2);
      color: #fff;
      border-color: #5078ff;
    }

    .notes-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .note-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 8px;
      color: #ccc;
      text-decoration: none;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background-color 0.2s, color 0.2s, border-color 0.2s;
    }
    .note-item:hover {
      background-color: rgba(255, 255, 255, 0.05);
      color: #fff;
    }
    .note-item.active {
      background-color: rgba(80, 120, 255, 0.15);
      color: #fff;
      border-left-color: #5078ff;
    }
    .note-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-grow: 1;
      min-width: 0;
    }
    .note-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 14px;
    }
    .remove-note-button {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 2px;
      border-radius: 50%;
      display: flex;
      opacity: 0;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .note-item:hover .remove-note-button,
    .note-item.active .remove-note-button {
      opacity: 1;
    }
    .remove-note-button:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, 0.1);
    }
    .no-items-message {
      text-align: center;
      padding: 10px;
      color: #888;
      font-size: 13px;
      font-style: italic;
    }

    .sidebar-footer {
      padding: 16px 20px;
      flex-shrink: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
  `;

  private _reset() {
    this.dispatchEvent(
      new CustomEvent('reset', {bubbles: true, composed: true}),
    );
  }

  private _selectAnalysis(id: string) {
    this.dispatchEvent(
      new CustomEvent('select-analysis', {
        detail: {id},
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _removeAnalysis(e: Event, id: string) {
    e.stopPropagation(); // Prevent selection when removing
    this.dispatchEvent(
      new CustomEvent('analysis-remove', {
        detail: {id},
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _newAnalysis() {
    this.dispatchEvent(
      new CustomEvent('new-analysis', {bubbles: true, composed: true}),
    );
  }

  private _closeSidebar() {
    this.dispatchEvent(
      new CustomEvent('close-sidebar', {bubbles: true, composed: true}),
    );
  }

  private get uniqueTags(): Map<string, number> {
    const tagCounts = new Map<string, number>();
    this.analyses.forEach((analysis) => {
      analysis.tags?.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    // Sort by count descending, then alphabetically for ties
    return new Map(
      [...tagCounts.entries()].sort((a, b) => {
        if (b[1] !== a[1]) {
          return b[1] - a[1];
        }
        return a[0].localeCompare(b[0]);
      }),
    );
  }

  private toggleTagFilter(tag: string) {
    if (this.selectedTag === tag) {
      this.selectedTag = null; // Deselect if clicked again
    } else {
      this.selectedTag = tag;
    }
  }

  render() {
    let filteredAnalyses = this.analyses;

    if (this.selectedTag) {
      filteredAnalyses = filteredAnalyses.filter((a) =>
        a.tags?.includes(this.selectedTag!),
      );
    }

    if (this.filterText) {
      const lowerCaseFilter = this.filterText.toLowerCase();
      filteredAnalyses = filteredAnalyses.filter(
        (analysis) =>
          analysis.title.toLowerCase().includes(lowerCaseFilter) ||
          analysis.tags?.some((tag) =>
            tag.toLowerCase().includes(lowerCaseFilter),
          ),
      );
    }

    return html`
      <div class="sidebar-header">
        <div class="header-title">
          <span class="dot"></span>
          <span>Voice Notes</span>
        </div>
        <div class="header-actions">
          <button
            class="action-button"
            @click=${this._newAnalysis}
            title="Nova Análise">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20px"
              viewBox="0 -960 960 960"
              width="20px"
              fill="currentColor">
              <path
                d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
            </svg>
          </button>
          <button
            class="action-button"
            @click=${this._closeSidebar}
            title="Fechar painel lateral">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20px"
              viewBox="0 -960 960 960"
              width="20px"
              fill="currentColor">
              <path
                d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" />
            </svg>
          </button>
        </div>
      </div>
      <div class="sidebar-body">
        <div class="section">
          <div class="search-container">
            <div class="search-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="20px"
                viewBox="0 -960 960 960"
                width="20px"
                fill="currentColor">
                <path
                  d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
              </svg>
            </div>
            <input
              type="text"
              class="search-input"
              placeholder="Pesquisar por título ou tag..."
              .value=${this.filterText}
              @input=${(e: Event) =>
                (this.filterText = (e.target as HTMLInputElement).value)} />
          </div>
        </div>

        <div class="section">
          <h4 class="section-title">Tópicos</h4>
          <div class="tag-cloud">
            ${Array.from(this.uniqueTags.entries()).map(
              ([tag, count]) => html`
                <button
                  class="tag-pill ${this.selectedTag === tag ? 'active' : ''}"
                  @click=${() => this.toggleTagFilter(tag)}>
                  ${tag}
                </button>
              `,
            )}
            ${this.uniqueTags.size === 0
              ? html`<p class="no-items-message">Nenhum tópico ainda.</p>`
              : ''}
          </div>
        </div>

        <div class="section">
          <h4 class="section-title">Análises</h4>
          ${
            this.analyses.length > 0
              ? html`
                  <ul class="notes-list">
                    ${repeat(
                      filteredAnalyses,
                      (analysis) => analysis.id,
                      (analysis) => html`
                        <li
                          class="note-item ${this.selectedAnalysisId ===
                          analysis.id
                            ? 'active'
                            : ''}"
                          @click=${() => this._selectAnalysis(analysis.id)}
                          title=${analysis.title}>
                          <div class="note-info">
                            <span class="note-title">${analysis.title}</span>
                          </div>
                          <button
                            class="remove-note-button"
                            @click=${(e: Event) =>
                              this._removeAnalysis(e, analysis.id)}
                            title="Remover nota">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="18px"
                              viewBox="0 -960 960 960"
                              width="18px"
                              fill="currentColor">
                              <path
                                d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                            </svg>
                          </button>
                        </li>
                      `,
                    )}
                  </ul>
                  ${filteredAnalyses.length === 0
                    ? html`<p class="no-items-message">
                        Nenhuma análise corresponde aos filtros.
                      </p>`
                    : ''}
                `
              : html`<p class="no-items-message">
                  Nenhuma análise na sessão.
                </p>`
          }
        </div>
      </div>
      <div class="sidebar-footer">
        <gdm-user-profile
          .activePersona=${this.activePersona}></gdm-user-profile>
      </div>
    `;
  }
}
