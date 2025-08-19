/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

/**
 * A shell component that manages the main layout of the application, including a
 * collapsible side panel for analysis content.
 */
@customElement('gdm-assistant-shell')
export class AssistantShell extends LitElement {
  /**
   * Controls whether the analysis panel is visible.
   */
  @property({type: Boolean, reflect: true}) panelOpen = false;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .main-container {
      display: flex;
      width: 100%;
      height: 100%;
    }

    .analysis-panel-container {
      width: 0;
      flex-shrink: 0;
      overflow: hidden;
      transition: width 0.4s ease-in-out;
    }

    :host([panelOpen]) .analysis-panel-container {
      width: 40%;
      max-width: 600px;
    }

    .assistant-view-container {
      flex-grow: 1;
      position: relative;
      height: 100%;
      overflow: hidden; /* Canvas might overflow otherwise */
    }
  `;

  render() {
    return html`
      <div class="main-container">
        <div class="analysis-panel-container">
          <slot name="analysis-panel"></slot>
        </div>
        <div class="assistant-view-container">
          <slot name="assistant-view"></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-assistant-shell': AssistantShell;
  }
}
