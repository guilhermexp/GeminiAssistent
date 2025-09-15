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
      display: block;
      font-family: sans-serif;
      color: #eee;
    }

    .profile-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .user-info {
      font-size: 14px;
      overflow: hidden;
      min-width: 0;
    }

    .user-name {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .avatar-container {
      position: relative;
      flex-shrink: 0;
    }

    .avatar {
      width: 40px;
      height: 40px;
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
      bottom: calc(100% + 12px);
      right: 0;
      background: #2a2a2a;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 8px;
      z-index: 100;
      min-width: 200px;
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
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
      background: none;
      border: none;
      color: white;
      text-align: left;
      font-size: 14px;
      font-weight: 500;
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

  private openPersonaModal() {
    this.isPersonaModalOpen = true;
    this.isDropdownOpen = false;
  }

  private _showHistory() {
    this.dispatchEvent(
      new CustomEvent('show-history', {bubbles: true, composed: true}),
    );
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
      <div class="profile-container">
        <div class="user-info">
          <div class="user-name">${this.user.name}</div>
        </div>
        <div class="avatar-container">
          <img
            src="${this.user.avatar}"
            alt="User Avatar"
            class="avatar"
            @click=${this.toggleDropdown} />
          ${
            this.isDropdownOpen
              ? html`
                  <div class="dropdown">
                    <button
                      class="dropdown-item"
                      @click=${this.openPersonaModal}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="20px"
                        viewBox="0 -960 960 960"
                        width="20px"
                        fill="currentColor">
                        <path
                          d="M420-420q-21 0-35.5-14.5T370-470q0-21 14.5-35.5T420-520q21 0 35.5 14.5T470-470q0 21-14.5 35.5T420-420Zm120 0q-21 0-35.5-14.5T505-470q0-21 14.5-35.5T540-520q21 0 35.5 14.5T590-470q0 21-14.5 35.5T540-420ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q50 0 96 12.5t86 36.5q-7 15-12 30.5t-7 31.5q-19-12-40-18.5T560-780q-75 0-127.5 52.5T380-600q0 45 19.5 83t53.5 67q-50 20-83.5 59.5T330-280h300q0-51-33.5-90.5T513-430q34-29 53.5-67t19.5-83q0-75-52.5-127.5T380-760q-20 0-40 6.5t-40 18.5q-2-16-7-31.5T281-801q40-24 86-36.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
                      </svg>
                      <span>Persona</span>
                    </button>
                    <button class="dropdown-item" @click=${this._showHistory}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="20px"
                        viewBox="0 -960 960 960"
                        width="20px"
                        fill="currentColor">
                        <path
                          d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-120 120-120v-240h-80v200l-80 80 40 40Z" />
                      </svg>
                      <span>Histórico</span>
                    </button>
                    <button class="dropdown-item" @click=${this.openEditModal}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="20px"
                        viewBox="0 -960 960 960"
                        width="20px"
                        fill="currentColor">
                        <path
                          d="M480-260q-83 0-141.5-58.5T280-460q0-83 58.5-141.5T480-660q83 0 141.5 58.5T680-460q0 83-58.5 141.5T480-260ZM160-80v-104q0-34 17-62t47-46q52-27 111-40.5t125-13.5q66 0 125 13.5T736-292q30 18 47 46t17 62v104H160Z" />
                      </svg>
                      <span>Editar Perfil</span>
                    </button>
                  </div>
                `
              : ''
          }
        </div>
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
            <h4>Editar Perfil</h4>
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
            <label for="name">Nome</label>
            <input
              id="name"
              type="text"
              .value=${this.tempName}
              @input=${(e: Event) =>
                (this.tempName = (e.target as HTMLInputElement).value)} />
          </div>
          <div class="form-group">
            <label for="email">E-mail</label>
            <input
              id="email"
              type="email"
              .value=${this.tempEmail}
              @input=${(e: Event) =>
                (this.tempEmail = (e.target as HTMLInputElement).value)} />
          </div>
          <div class="modal-actions">
            <button class="save-button" @click=${this.handleSaveProfile}>
              Salvar
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
