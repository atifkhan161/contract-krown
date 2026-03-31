// Contract Crown Registration View
// User registration form with validation and API integration

import { router } from './router.js';
import { sessionManager } from '../session/index.js';

export class RegistrationView {
  private container: HTMLElement | null = null;

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'registration-view';
    container.innerHTML = `
      <div class="login-container">
        <div class="app-title">Contract Crown</div>
        <div class="app-subtitle">Create your account</div>
        <div class="form-group">
          <input class="form-input" type="text" placeholder="Username" id="register-username" />
        </div>
        <div class="form-group">
          <input class="form-input" type="password" placeholder="Password (min 4 characters)" id="register-password" />
        </div>
        <button class="btn btn-primary w-full" id="register-btn">Register</button>
        <div class="error-message alert alert-error mt-2 hidden" id="register-error"></div>
        <div class="success-message alert alert-success mt-2 hidden" id="register-success"></div>
        <div class="login-link mt-4">
          <span>Already have an account? </span>
          <a href="#" id="back-to-login-link">Back to Login</a>
        </div>
      </div>
    `;

    this.container = container;
    this.attachEventListeners();
    return container;
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const usernameInput = this.container.querySelector('#register-username') as HTMLInputElement;
    const passwordInput = this.container.querySelector('#register-password') as HTMLInputElement;
    const registerBtn = this.container.querySelector('#register-btn') as HTMLButtonElement;
    const backToLoginLink = this.container.querySelector('#back-to-login-link') as HTMLAnchorElement;

    registerBtn?.addEventListener('click', () => {
      this.handleRegistration(usernameInput.value, passwordInput.value);
    });

    passwordInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleRegistration(usernameInput.value, passwordInput.value);
      }
    });

    backToLoginLink?.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate('/login');
    });
  }

  private async handleRegistration(username: string, password: string): Promise<void> {
    this.hideError();
    this.hideSuccess();

    if (!username.trim()) {
      this.showError('Username is required');
      return;
    }

    if (password.length < 4) {
      this.showError('Password must be at least 4 characters');
      return;
    }

    const registerBtn = this.container?.querySelector('#register-btn') as HTMLButtonElement;
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          this.showError('Username is already taken');
        } else if (response.status === 400) {
          this.showError(data.message || 'Invalid input');
        } else {
          this.showError('Registration failed. Please try again.');
        }
        return;
      }

      this.showSuccess('Registration successful! Logging you in...');

      sessionManager.login(data.userId, data.username, data.token, data.expiresAt);
      
      setTimeout(() => {
        router.handleLoginRedirect();
      }, 500);
    } catch {
      this.showError('Network error. Please check your connection.');
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = 'Register';
    }
  }

  private showError(message: string): void {
    if (!this.container) return;
    const errorEl = this.container.querySelector('#register-error') as HTMLElement;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  hideError(): void {
    if (!this.container) return;
    const errorEl = this.container.querySelector('#register-error') as HTMLElement;
    if (errorEl) {
      errorEl.classList.add('hidden');
    }
  }

  private showSuccess(message: string): void {
    if (!this.container) return;
    const successEl = this.container.querySelector('#register-success') as HTMLElement;
    if (successEl) {
      successEl.textContent = message;
      successEl.classList.remove('hidden');
    }
  }

  hideSuccess(): void {
    if (!this.container) return;
    const successEl = this.container.querySelector('#register-success') as HTMLElement;
    if (successEl) {
      successEl.classList.add('hidden');
    }
  }

  destroy(): void {
    this.container = null;
  }
}
