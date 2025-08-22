/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('gdm-media-controls')
export class GdmMediaControls extends LitElement {
  @property({type: Boolean}) isRecording = false;
  @property({type: Boolean}) hasAnalyses = false;
  @property({type: Boolean}) hasTimelineEvents = false;

  static styles = css`
    .media-controls {
      display: flex;
      gap: 8px;
    }

    button {
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.2);
      width: 48px;
      height: 48px;
      cursor: pointer;
      font-size: 24px;
      padding: 0;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transition: background-color 0.2s;
    }

    button:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    button[disabled] {
      display: none;
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
            viewBox="0 0 100 100"
            width="24px"
            height="24px"
            fill="#c80000"
            xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" />
          </svg>
        </button>
        <button
          id="stopButton"
          @click=${() => this._dispatch('stop-recording')}
          ?disabled=${!this.isRecording}
          aria-label="Parar gravação">
          <svg
            viewBox="0 0 100 100"
            width="24px"
            height="24px"
            fill="#ffffff"
            xmlns="http://www.w3.org/2000/svg">
            <rect x="15" y="15" width="70" height="70" rx="8" />
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
            height="24px"
            viewBox="0 -960 960 960"
            width="24px"
            fill="#ffffff">
            <path
              d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
          </svg>
        </button>
        <button
          id="clearButton"
          @click=${() => this._dispatch('clear-contexts')}
          ?disabled=${this.isRecording || !this.hasAnalyses}
          aria-label="Limpar contextos da sessão atual"
          title="Limpar contextos (mantém a persona)">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="24px"
            viewBox="0 -960 960 960"
            width="24px"
            fill="#ffffff">
            <path
              d="M280-120 160-240v-480h80v454l104 106-64 60Zm200 0-140-140 56-56 140 140-56 56Zm160-160L500-420l56-56 140 140-56 56ZM240-720v-80h480v80H240Z" />
          </svg>
        </button>
        ${this.hasAnalyses
          ? html`
              <button
                id="transcriptionButton"
                @click=${() => this._dispatch('show-analysis')}
                title="Ver análises de conteúdo"
                aria-label="Ver análises de conteúdo">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="24px"
                  viewBox="0 -960 960 960"
                  width="24px"
                  fill="#ffffff">
                  <path
                    d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z" />
                </svg>
              </button>
            `
          : ''}
        ${this.hasTimelineEvents
          ? html`
              <button
                id="timelineButton"
                @click=${() => this._dispatch('show-timeline')}
                title="Ver Linha do Tempo"
                aria-label="Ver Linha do Tempo">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="24px"
                  viewBox="0 -960 960 960"
                  width="24px"
                  fill="#ffffff">
                  <path
                    d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM200-80q-33 0-56.5-23.5T120-160v-640q0-33 23.5-56.5T200-880h560q33 0 56.5 23.5T840-800v640q0 33-23.5 56.5T760-80H200Zm0-80h560v-640H200v640Z" />
                </svg>
              </button>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-media-controls': GdmMediaControls;
  }
}
