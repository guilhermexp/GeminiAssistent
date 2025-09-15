/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('gdm-media-controls')
export class GdmMediaControls extends LitElement {
  @property({type: Boolean}) isRecording = false;
  @property({type: Boolean}) hasTimelineEvents = false;

  static styles = css`
    .media-controls {
      display: flex;
      gap: 8px; /* Increased gap for floating effect */
    }

    button {
      outline: none;
      border: none;
      color: white;
      border-radius: 50%;
      background: transparent;
      width: 36px;
      height: 36px;
      cursor: pointer;
      font-size: 22px;
      padding: 0;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background-color 0.2s, color 0.2s;
    }

    button:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    button.active {
      background-color: #5078ff;
      color: white;
    }

    button:disabled {
      display: none;
    }

    #startButton svg {
      transform: scale(1.1);
    }

    @media (max-width: 768px) {
      button {
        width: 32px;
        height: 32px;
      }
    }
  `;

  private _dispatch(eventName: string) {
    this.dispatchEvent(
      new CustomEvent(eventName, {bubbles: true, composed: true}),
    );
  }

  render() {
    return html`
      <div class="media-controls">
        <button
          id="startButton"
          @click=${() => this._dispatch('start-recording')}
          ?disabled=${this.isRecording}
          aria-label="Iniciar gravação">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="20px"
            viewBox="0 -960 960 960"
            width="20px"
            fill="currentColor">
            <path d="M320-200v-560l440 280-440 280Z" />
          </svg>
        </button>
        <button
          id="stopButton"
          @click=${() => this._dispatch('stop-recording')}
          ?disabled=${!this.isRecording}
          aria-label="Parar gravação">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="20px"
            viewBox="0 -960 960 960"
            width="20px"
            fill="currentColor">
            <path d="M280-280v-400h400v400H280Z" />
          </svg>
        </button>
        <button
          id="resetButton"
          @click=${() => this._dispatch('reset')}
          ?disabled=${this.isRecording}
          aria-label="Reiniciar sessão e limpar todos os contextos"
          title="Reiniciar sessão (limpa contextos e persona)">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="20px"
            viewBox="0 -960 960 960"
            width="20px"
            fill="currentColor">
            <path
              d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
          </svg>
        </button>
        <button
          id="timelineButton"
          @click=${() => this._dispatch('show-timeline')}
          title="Ver Linha do Tempo"
          aria-label="Ver Linha do Tempo"
          ?disabled=${!this.hasTimelineEvents}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="20px"
            viewBox="0 -960 960 960"
            width="20px"
            fill="currentColor">
            <path
              d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h480q33 0 56.5 23.5T800-800v640q0 33-23.5 56.5T720-80H240Zm0-80h480v-640H240v640Zm120-440h240v-80H360v80Zm0 160h240v-80H360v80Zm0 160h240v-80H360v80Z" />
          </svg>
        </button>
      </div>
    `;
  }
}