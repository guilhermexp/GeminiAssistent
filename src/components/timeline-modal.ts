/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html, svg} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {TimelineEvent, ProcessingState} from '../types/types';

@customElement('gdm-timeline-modal')
export class GdmTimelineModal extends LitElement {
  @property({type: Boolean}) show = false;
  @property({type: Array}) events: TimelineEvent[] = [];
  @property({type: Object}) processingState: ProcessingState;

  static styles = css`
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
      width: clamp(300px, 80vw, 800px);
      max-height: 85vh;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #eee;
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
      color: #5078ff;
    }

    .modal-header .close-button {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
    }
    .modal-header .close-button:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, 0.1);
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
    }

    .modal-actions button {
      padding: 10px 20px;
      border-radius: 20px;
      border: none;
      background: #5078ff;
      color: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    .modal-actions button:hover {
      background: #6a8dff;
    }

    .timeline-list {
      list-style: none;
      padding: 0;
      margin: 0;
      flex-grow: 1;
      overflow-y: auto;
      /* For better scrollbar appearance */
      scrollbar-width: thin;
      scrollbar-color: #5078ff #1e1e1e;
    }
    .timeline-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 12px 4px;
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
      white-space: pre-wrap;
      word-break: break-word;
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
    .timeline-type-history .timeline-icon {
      color: #9c27b0;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .timeline-icon.is-active svg {
      animation: spin 1.5s linear infinite;
    }
  `;

  private _close() {
    this.dispatchEvent(
      new CustomEvent('close', {bubbles: true, composed: true}),
    );
  }

  private renderTimelineIcon(type: TimelineEvent['type']) {
    const icons = {
      info: svg`<path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/>`,
      success: svg`<path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-50-222L662-534l-56-56-176 176-84-84-56 56 140 140Z"/>`,
      error: svg`<path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-160h80v-80h-80v80Zm0-160h80v-240h-80v240Z"/>`,
      record: svg`<path d="M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35ZM240-80v-200q0-100 70-170t170-70q100 0 170 70t70 170v200h-80v-200q0-66-47-113t-113-47q-66 0-113 47t-47 113v200H240Z"/>`,
      process: svg`<path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>`,
      connect: svg`<path d="M460-280q-83 0-141.5-58.5T260-480q0-83 58.5-141.5T460-680h240v80H460q-50 0-85 35t-35 85q0 50 35 85t85 35h240v80H460Zm240 80v-80h-240q-50 0-85-35t-35-85q0-50 35-85t85-35h240v-80H460q-83 0-141.5 58.5T260-480q0 83 58.5 141.5T460-280h240Z"/>`,
      disconnect: svg`<path d="M320-280v-80h80l-56-56 56-56 56 56q22-13 47-20t51-7h80v80h-80q-17 0-33 4.5t-31 12.5l120 120-56 56-140-140-140 140-56-56 96-96Zm314-142q-1-2-1-3.5t-1-3.5l-56-56-56 56 56 56q-23 12-48 18.5T480-400h-47l-66-66q-2-3-3-5.5t-2-5.5q0-50 35-85t85-35h240v80H480q-17 0-28.5 11.5T440-480q0 17 11.5 28.5T480-440h36l54 54ZM200-80l-56-56 616-616 56 56L200-80Z"/>`,
      history: svg`<path d="M600-80 376-304l56-56 128 128v-328h80v328l128-128 56 56L600-80ZM320-200q-100 0-170-70t-70-170q0-100 70-170t170-70h360v80H320q-66 0-113 47t-47 113q0 66 47 113t113 47h200v80H320Z"/>`,
    };
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
        ${icons[type] || icons['info']}
      </svg>
    `;
  }

  render() {
    if (!this.show) {
      return html``;
    }

    const mostRecentProcessEvent = this.events.find((e) => e.type === 'process');

    return html`
      <div class="modal-overlay" @click=${this._close}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>Linha do Tempo da Sessão</h3>
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
          <ul class="timeline-list">
            ${this.events.map((event) => {
              const isActiveProcess =
                this.processingState?.active && event === mostRecentProcessEvent;
              return html`
                <li class="timeline-item timeline-type-${event.type}">
                  <div
                    class="timeline-icon ${isActiveProcess ? 'is-active' : ''}">
                    ${this.renderTimelineIcon(event.type)}
                  </div>
                  <div class="timeline-body">
                    <span class="timeline-message">${event.message}</span>
                    <span class="timeline-timestamp">${event.timestamp}</span>
                  </div>
                </li>
              `;
            })}
          </ul>
          <div class="modal-actions">
            <button @click=${this._close}>Fechar</button>
          </div>
        </div>
      </div>
    `;
  }
}
