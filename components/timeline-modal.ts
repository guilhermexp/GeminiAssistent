import {LitElement, html, css, svg} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {TimelineEvent} from '../gdm-live-audio';

@customElement('timeline-modal')
export class TimelineModal extends LitElement {
  @property({type: Boolean}) show = false;
  @property({type: Array}) events: TimelineEvent[] = [];

  static styles = css`
    /* All timeline modal styles from the original file go here */
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
    }
     /* Add all other relevant styles: .timeline-list, .timeline-item, etc. */
  `;

  private closeModal() {
    this.dispatchEvent(new CustomEvent('close-modal'));
  }

  private _renderTimelineIcon(type: TimelineEvent['type']) {
    const icons = {
      info: svg`<path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/>`,
      success: svg`<path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>`,
      error: svg`<path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/>`,
      record: svg`<path d="M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm-40-600v240q0 17 11.5 28.5T480-720q17 0 28.5-11.5T520-760v-240q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760ZM160-80v-400h80v400h-80Zm160 0v-400h80v400h-80Zm160 0v-400h80v400h-80Zm160 0v-400h80v400h-80Z"/>`,
      process: svg`<path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>`,
      connect: svg`<path d="m560-440-56-56 103-104H160v-80h447L504-784l56-56 200 200-200 200ZM160-120v-80h240v80H160Zm0-160v-80h400v80H160Z"/>`,
      disconnect: svg`<path d="M640-120v-80H240v80h400Zm-82-160-58-58-99-99-22-21 43-43 21 22 99 99 58 58 56-56-224-224-56 56 224 224-56 56Zm82-200v-80h-87l-63-63 56-57 174 174v126h-80Z"/>`,
    };
    return svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">${icons[type] || icons['info']}</svg>`;
  }

  render() {
    if (!this.show) return html``;

    return html`
      <div class="modal-overlay" @click=${this.closeModal}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <h3>Linha do Tempo da Sessão</h3>
          <ul class="timeline-list">
            ${this.events.map(
              (event) => html`
                <li class="timeline-item timeline-type-${event.type}">
                  <div class="timeline-icon">${this._renderTimelineIcon(event.type)}</div>
                  <div class="timeline-body">
                    <span class="timeline-message">${event.message}</span>
                    <span class="timeline-timestamp">${event.timestamp}</span>
                  </div>
                </li>
              `,
            )}
          </ul>
          <div class="modal-actions">
            <button class="primary-btn" @click=${this.closeModal}>Fechar</button>
          </div>
        </div>
      </div>
    `;
  }
}
