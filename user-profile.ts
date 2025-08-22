/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

// Replicating the types from the React example
interface UserData {
  name: string;
  email: string;
  avatar: string;
}

const demoUser: UserData = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  avatar: 'https://github.com/educlopez.png',
};

@customElement('gdm-user-profile')
export class GdmUserProfile extends LitElement {
  @property({type: String}) activePersona: string | null = null;
  @state() private user: UserData = demoUser;

  @state() private isDropdownOpen = false;
  @state() private isEditModalOpen = false;
  @state() private isPersonaModalOpen = false;

  // Temp state for editing profile
  @state() private tempName = '';
  @state() private tempEmail = '';

  static styles = css`
    :host {
      position: relative;
      font-family: sans-serif;
      color: #eee;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid rgba(255, 255, 255, 0.3);
      transition: border-color 0.2s;
    }

    .avatar:hover {
      border-color: #5078ff;
    }

    .dropdown {
      position: absolute;
      top: calc(100% + 12px);
      right: 0;
      background: #1e1e1e;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 8px;
      z-index: 100;
      min-width: 220px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
      background: none;
      border: none;
      color: #eee;
      text-align: left;
      font-size: 14px;
    }

    .dropdown-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .dropdown-item svg {
      flex-shrink: 0;
    }

    /* Modal styles */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(5px);
    }

    .modal-content {
      background: #1e1e1e;
      padding: 24px;
      border-radius: 12px;
      width: clamp(300px, 90vw, 450px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 85vh;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h4 {
      margin: 0;
      color: #5078ff;
    }

    .close-button {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 50%;
    }
    .close-button:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, 0.1);
    }

    /* Edit Profile Modal */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-group label {
      font-size: 13px;
      color: #ccc;
    }

    .form-group input {
      padding: 10px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(0, 0, 0, 0.2);
      color: #eee;
      font-size: 14px;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }

    .modal-actions button {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-weight: 500;
    }

    .save-button {
      background: #5078ff;
      color: white;
    }

    /* Persona Modal Styles */
    .persona-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      margin: 0 -8px;
      padding: 0 8px;
    }
    .persona-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      border: 2px solid transparent;
      background-color: rgba(255, 255, 255, 0.05);
      transition: all 0.2s ease;
      text-align: left;
      color: #eee;
      width: 100%;
    }
    .persona-item:hover {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .persona-item.active {
      border-color: #5078ff;
      background-color: rgba(80, 120, 255, 0.1);
    }
    .persona-name {
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 4px;
    }
    .persona-description {
      font-size: 13px;
      color: #ccc;
      line-height: 1.4;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.body.addEventListener('click', this.handleOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.body.removeEventListener('click', this.handleOutsideClick);
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (this.isDropdownOpen && !e.composedPath().includes(this)) {
      this.isDropdownOpen = false;
    }
  };

  private toggleDropdown(e: Event) {
    e.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  private openEditModal() {
    this.tempName = this.user.name;
    this.tempEmail = this.user.email;
    this.isEditModalOpen = true;
    this.isDropdownOpen = false;
  }

  private openHistoryModal() {
    this.dispatchEvent(
      new CustomEvent('show-history', {bubbles: true, composed: true}),
    );
    this.isDropdownOpen = false;
  }

  private openPersonaModal() {
    this.isPersonaModalOpen = true;
    this.isDropdownOpen = false;
  }

  private selectPersona(persona: string | null) {
    this.dispatchEvent(
      new CustomEvent('persona-change', {
        detail: {persona},
        bubbles: true,
        composed: true,
      }),
    );
    this.isPersonaModalOpen = false;
  }

  private handleSaveProfile() {
    this.user = {...this.user, name: this.tempName, email: this.tempEmail};
    this.isEditModalOpen = false;
  }

  render() {
    return html`
      <div>
        <img
          src="${this.user.avatar}"
          alt="User Avatar"
          class="avatar"
          @click=${this.toggleDropdown} />

        ${this.isDropdownOpen
          ? html`
              <div class="dropdown">
                <button class="dropdown-item" @click=${this.openEditModal}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="20px"
                    viewBox="0 -960 960 960"
                    width="20px"
                    fill="currentColor">
                    <path
                      d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q62 0 126 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z" />
                  </svg>
                  <span>Edit Profile</span>
                </button>
                <button
                  class="dropdown-item"
                  @click=${this.openHistoryModal}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="20px"
                    viewBox="0 -960 960 960"
                    width="20px"
                    fill="currentColor">
                    <path
                      d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q134 0 227 93t93 227h-80q-17-84-77.5-142.5T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q42 0 81-14.5t69-41.5l-90-90h240v240l-84-84q-42 34-93 52t-113 18Z" />
                  </svg>
                  <span>Last Sessions</span>
                </button>
                <button class="dropdown-item" @click=${this.openPersonaModal}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="20px"
                    viewBox="0 -960 960 960"
                    width="20px"
                    fill="currentColor">
                    <path
                      d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0-25-8.5-48.5T589-613q-22-26-49.5-40.5T480-669q-51 0-88 35.5T352-544q0 40 24 71t64 43q-23 12-42 30.5T373-358q-36 41-55.5 86T298-172h-48q-10-44-24-86.5T199-354q-47-49-71.5-112.5T103-596q0-131 92-224t225-93q121 0 213.5 83T729-596q0 58-19.5 107.5T658-396q-14 18-31 33.5T592-334q22-19 36-42.5t14-49.5q0-51-36.5-87T520-550q-48 0-82 33t-34 77q0 14 3 27t9 25q-14 3-26.5 4.5T366-280h228q21 0 40-6t35-16q-2-21-5.5-41t-8.5-38q-35-42-83-65.5T480-480Z" />
                  </svg>
                  <span>Persona</span>
                </button>
              </div>
            `
          : ''}
      </div>

      ${this.isEditModalOpen ? this.renderEditModal() : ''}
      ${this.isPersonaModalOpen ? this.renderPersonaModal() : ''}
    `;
  }

  renderEditModal() {
    return html`
      <div class="modal-overlay" @click=${() => (this.isEditModalOpen = false)}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h4>Edit Profile</h4>
            <button
              class="close-button"
              @click=${() => (this.isEditModalOpen = false)}>
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
          <div class="form-group">
            <label for="name">Name</label>
            <input
              id="name"
              type="text"
              .value=${this.tempName}
              @input=${(e: Event) =>
                (this.tempName = (e.target as HTMLInputElement).value)} />
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              .value=${this.tempEmail}
              @input=${(e: Event) =>
                (this.tempEmail = (e.target as HTMLInputElement).value)} />
          </div>
          <div class="modal-actions">
            <button class="save-button" @click=${this.handleSaveProfile}>
              Save
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderPersonaModal() {
    const personas = [
      {
        key: 'tutor',
        name: 'Tutor',
        description: 'Ensina sobre o conteúdo de forma didática.',
      },
      {
        key: 'coding-engineer',
        name: 'Engenheiro de Codificação',
        description: 'Fornece respostas técnicas e focadas em código.',
      },
      {
        key: 'direct',
        name: 'Direto',
        description: 'Responde de forma rápida e objetiva.',
      },
      {
        key: 'data-analyst',
        name: 'Analista de Dados',
        description: 'Atua como um parceiro de negócios focado em dados.',
      },
    ];

    return html`
      <div
        class="modal-overlay"
        @click=${() => (this.isPersonaModalOpen = false)}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h4>Selecione uma Persona</h4>
            <button
              class="close-button"
              @click=${() => (this.isPersonaModalOpen = false)}>
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
          <div class="persona-list">
            ${personas.map(
              (p) => html`
                <button
                  class="persona-item ${this.activePersona === p.key
                    ? 'active'
                    : ''}"
                  @click=${() => this.selectPersona(p.key)}>
                  <span class="persona-name">${p.name}</span>
                  <span class="persona-description">${p.description}</span>
                </button>
              `,
            )}
            <button
              class="persona-item ${!this.activePersona ? 'active' : ''}"
              @click=${() => this.selectPersona(null)}>
              <span class="persona-name">Padrão</span>
              <span class="persona-description"
                >O assistente prestativo e geral.</span
              >
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-user-profile': GdmUserProfile;
  }
}
