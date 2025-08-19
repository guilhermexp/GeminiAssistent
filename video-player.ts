import {LitElement, css, html, PropertyValueMap} from 'lit';
import {customElement, property, state, query} from 'lit/decorators.js';

const formatTime = (t: number) =>
  `${Math.floor(t / 60)}:${Math.floor(t % 60)
    .toString()
    .padStart(2, '0')}`;

@customElement('gdm-video-player')
export class GdmVideoPlayer extends LitElement {
  @property({type: String}) src = '';
  @state() private isYoutube = false;

  // Video player state
  @query('video') private videoEl: HTMLVideoElement | undefined;
  @state() private duration = 0;
  @state() private currentTime = 0;
  @state() private isPlaying = false;
  @state() private isScrubbing = false;

  static styles = css`
    @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      position: absolute;
      inset: 0;
      background: #000;
    }

    .player-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    video,
    iframe {
      max-width: 100%;
      max-height: 100%;
      border: none;
      aspect-ratio: 16 / 9;
      display: block;
    }

    .video-container {
      position: relative;
      max-width: 100%;
      max-height: 100%;
      aspect-ratio: 16/9;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #000;
    }
    .video-container video {
      width: 100%;
      height: 100%;
    }

    .video-controls {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 15px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
      color: white;
      font-family: sans-serif;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 21;
    }

    .video-container:hover .video-controls,
    .video-controls.visible {
      opacity: 1;
    }

    .video-controls button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
    }
    .video-controls .icon {
      font-family: 'Material Symbols Outlined';
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      font-size: 28px;
    }

    .video-scrubber {
      flex-grow: 1;
      position: relative;
      height: 16px;
      display: flex;
      align-items: center;
    }

    .video-scrubber input[type='range'] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
      margin: 0;
      padding: 0;
    }

    .video-scrubber input[type='range']::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      background: #5078ff;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid white;
      margin-top: -5px; /* Vertically center */
    }

    .video-scrubber input[type='range']::-moz-range-thumb {
      width: 14px;
      height: 14px;
      background: #5078ff;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid white;
    }
    .progress-track {
      position: absolute;
      top: 6px;
      left: 0;
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
      pointer-events: none;
    }

    .progress-fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: #5078ff;
      border-radius: 2px;
    }

    .video-time {
      font-variant-numeric: tabular-nums;
    }
  `;

  protected updated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>,
  ): void {
    if (_changedProperties.has('src')) {
      this.isYoutube = this.src.includes('youtube.com/embed');
      this.resetPlayerState();
    }
  }

  resetPlayerState() {
    this.duration = 0;
    this.currentTime = 0;
    this.isPlaying = true; // Autoplay is on
  }

  togglePlay() {
    if (!this.videoEl) return;
    if (this.videoEl.paused) {
      this.videoEl.play();
    } else {
      this.videoEl.pause();
    }
  }

  handleDurationChange() {
    this.duration = this.videoEl?.duration || 0;
  }

  handleTimeUpdate() {
    if (!this.isScrubbing) {
      this.currentTime = this.videoEl?.currentTime || 0;
    }
  }

  handleScrubberChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const newTime = parseFloat(input.value);
    this.currentTime = newTime;
    if (this.videoEl) {
      this.videoEl.currentTime = newTime;
    }
  }

  render() {
    if (!this.src) return html``;

    if (this.isYoutube) {
      return html`
        <div class="player-wrapper">
          <iframe
            .src=${this.src}
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen></iframe>
        </div>
      `;
    }

    const progressPercent =
      this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;

    return html`
      <div class="player-wrapper">
        <div class="video-container">
          <video
            .src=${this.src}
            @click=${this.togglePlay}
            @durationchange=${this.handleDurationChange}
            @timeupdate=${this.handleTimeUpdate}
            @play=${() => (this.isPlaying = true)}
            @pause=${() => (this.isPlaying = false)}
            preload="auto"
            autoplay
            muted
            loop></video>
          <div class="video-controls ${this.isPlaying ? '' : 'visible'}">
            <button @click=${this.togglePlay} aria-label="Play/Pause">
              <span class="icon material-symbols-outlined">
                ${this.isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <div class="video-scrubber">
              <div class="progress-track">
                <div
                  class="progress-fill"
                  style="width: ${progressPercent}%"></div>
              </div>
              <input
                type="range"
                min="0"
                max=${this.duration || 0}
                .value=${String(this.currentTime)}
                step="0.01"
                @input=${this.handleScrubberChange}
                @pointerdown=${() => (this.isScrubbing = true)}
                @pointerup=${() => (this.isScrubbing = false)}
                aria-label="Video progress" />
            </div>
            <div class="video-time">
              ${formatTime(this.currentTime)} / ${formatTime(this.duration)}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-video-player': GdmVideoPlayer;
  }
}
