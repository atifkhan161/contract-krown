// Contract Crown Registration View
// User registration form with validation and API integration

import { router } from './router.js';

const API_BASE = '';

export class RegistrationView {
  private container: HTMLElement | null = null;

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'registration-view';
    container.innerHTML = `
      <div class="registration-container">
        <div class="app-title">Contract Crown</div>
        <div class="app-subtitle">Create your account</div>
        <div class="form-group">
          <input class="form-input" type="text" placeholder="Username" id="register-username" autocomplete="username" />
        </div>
        <div class="form-group">
          <input class="form-input" type="email" placeholder="Email" id="register-email" autocomplete="email" />
        </div>
        <div class="form-group">
          <input class="form-input" type="password" placeholder="Password (6+ characters)" id="register-password" autocomplete="new-password" />
        </div>
        <button class="btn btn-primary w-full" id="register-btn">Create Account</button>
        <div class="register-back-link mt-4">
          <span>Already have an account? </span>
          <a href="#" id="back-to-login-link">Login</a>
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
    const emailInput = this.container.querySelector('#register-email') as HTMLInputElement;
    const passwordInput = this.container.querySelector('#register-password') as HTMLInputElement;
    const registerBtn = this.container.querySelector('#register-btn') as HTMLButtonElement;
    const backToLoginLink = this.container.querySelector('#back-to-login-link') as HTMLAnchorElement;

    usernameInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        emailInput?.focus();
      }
    });

    emailInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        passwordInput?.focus();
      }
    });

    passwordInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleRegistration(usernameInput.value, emailInput.value, passwordInput.value);
      }
    });

    registerBtn?.addEventListener('click', () => {
      this.handleRegistration(usernameInput.value, emailInput.value, passwordInput.value);
    });

    backToLoginLink?.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate('/login');
    });
  }

  private async handleRegistration(username: string, email: string, password: string): Promise<void> {
    this.hideError();
    
    const registerBtn = this.container?.querySelector('#register-btn') as HTMLButtonElement;
    
    if (!username.trim()) {
      this.showError('Please enter a username');
      return;
    }

    if (username.trim().length < 2) {
      this.showError('Username must be at least 2 characters');
      return;
    }

    if (!email.trim()) {
      this.showError('Please enter your email');
      return;
    }

    if (!this.isValidEmail(email.trim())) {
      this.showError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters');
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating account...';

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(), 
          email: email.trim(),
          password 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        this.showError(data.message || 'Registration failed. Please try again.');
        return;
      }

      registerBtn.textContent = 'Account created!';
      registerBtn.classList.add('btn-success');
      
      this.showSuccess('Success! Check your email to confirm, then login.');

      setTimeout(() => {
        router.navigate('/login');
      }, 2500);
    } catch {
      this.showError('Network error. Please check your connection and try again.');
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create Account';
      registerBtn.classList.remove('btn-success');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private showError(message: string): void {
    if (!this.container) return;

    let errorEl = this.container.querySelector('.error-message');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'error-message';
      const firstFormGroup = this.container.querySelector('.form-group');
      if (firstFormGroup?.parentNode) {
        firstFormGroup.parentNode.insertBefore(errorEl, firstFormGroup);
      }
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  hideError(): void {
    if (!this.container) return;
    const errorEl = this.container.querySelector('.error-message');
    if (errorEl) {
      errorEl.classList.add('hidden');
    }
  }

  private showSuccess(message: string): void {
    if (!this.container) return;

    let successEl = this.container.querySelector('.success-message');
    if (!successEl) {
      successEl = document.createElement('div');
      successEl.className = 'success-message';
      const btn = this.container.querySelector('.btn-primary');
      if (btn?.parentNode) {
        btn.parentNode.insertBefore(successEl, btn.nextSibling);
      }
    }
    if (successEl) {
      successEl.textContent = message;
      successEl.classList.remove('hidden');
    }
  }

  hideSuccess(): void {
    if (!this.container) return;
    const successEl = this.container.querySelector('.success-message');
    if (successEl) {
      successEl.classList.add('hidden');
    }
  }

  destroy(): void {
    this.container = null;
  }
}
