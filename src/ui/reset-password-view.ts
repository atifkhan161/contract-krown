// Contract Crown Reset Password View
// Sets new password after clicking email reset link

const API_BASE = '';

export interface ResetPasswordViewConfig {
  onResetSuccess?: () => void;
}

export class ResetPasswordView {
  private container: HTMLElement | null = null;
  private config: ResetPasswordViewConfig;
  private accessToken: string = '';
  private isLoading: boolean = false;

  constructor(config: ResetPasswordViewConfig = {}) {
    this.config = config;
    this.accessToken = this.extractAccessTokenFromHash();
  }

  private extractAccessTokenFromHash(): string {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token') || '';
  }

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'login-view';

    if (!this.accessToken) {
      container.innerHTML = `
        <div class="login-container">
          <div class="app-title">Invalid Link</div>
          <div class="app-subtitle">This reset link is invalid or has expired</div>
          <div class="back-link mt-4">
            <a href="/login">&larr; Go to Login</a>
          </div>
        </div>
      `;
      this.attachEventListeners();
      this.container = container;
      return container;
    }

    container.innerHTML = `
      <div class="login-container">
        <div class="app-title">New Password</div>
        <div class="app-subtitle">Enter your new password</div>
        <div class="form-group">
          <input class="form-input" type="password" placeholder="New Password (min 6 chars)" id="reset-password" minlength="6" />
        </div>
        <div class="form-group">
          <input class="form-input" type="password" placeholder="Confirm Password" id="reset-password-confirm" />
        </div>
        <button class="btn btn-primary w-full" id="reset-btn">Reset Password</button>
        <div class="success-message hidden" id="success-message">
          <span>Password updated! Redirecting...</span>
        </div>
        <div class="error-message hidden" id="error-message"></div>
        <div class="back-link mt-4">
          <a href="/login">&larr; Back to Login</a>
        </div>
      </div>
    `;

    this.container = container;
    this.attachEventListeners();
    return container;
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    if (!this.accessToken) {
      return;
    }

    const passwordInput = this.container.querySelector('#reset-password') as HTMLInputElement;
    const confirmInput = this.container.querySelector('#reset-password-confirm') as HTMLInputElement;
    const submitBtn = this.container.querySelector('#reset-btn') as HTMLButtonElement;
    const backLink = this.container.querySelector('.back-link a') as HTMLAnchorElement;

    submitBtn?.addEventListener('click', () => {
      this.handleSubmit(passwordInput.value, confirmInput.value);
    });

    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        this.handleSubmit(passwordInput.value, confirmInput.value);
      }
    };

    passwordInput?.addEventListener('keypress', handleEnter);
    confirmInput?.addEventListener('keypress', handleEnter);

    backLink?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/login';
    });
  }

  private async handleSubmit(password: string, confirmPassword: string): Promise<void> {
    this.hideError();
    this.hideSuccess();

    if (!password) {
      this.showError('Please enter a password');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      this.showError('Passwords do not match');
      return;
    }

    this.setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: this.accessToken,
          password: password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        this.showError(data.message || 'Failed to reset password');
        return;
      }

      this.showSuccess();
      window.history.replaceState(null, '', '/reset-password');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (error) {
      this.showError('Network error. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  private setLoading(loading: boolean): void {
    if (!this.container) return;
    this.isLoading = loading;
    const passwordInput = this.container.querySelector('#reset-password') as HTMLInputElement;
    const confirmInput = this.container.querySelector('#reset-password-confirm') as HTMLInputElement;
    const submitBtn = this.container.querySelector('#reset-btn') as HTMLButtonElement;

    if (passwordInput) passwordInput.disabled = loading;
    if (confirmInput) confirmInput.disabled = loading;
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Resetting...' : 'Reset Password';
    }
  }

  private showError(message: string): void {
    if (!this.container) return;
    const errorEl = this.container.querySelector('#error-message') as HTMLElement;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  private hideError(): void {
    if (!this.container) return;
    const errorEl = this.container.querySelector('#error-message') as HTMLElement;
    if (errorEl) {
      errorEl.classList.add('hidden');
    }
  }

  private showSuccess(): void {
    if (!this.container) return;
    const successEl = this.container.querySelector('#success-message') as HTMLElement;
    const formGroups = this.container.querySelectorAll('.form-group');
    const submitBtn = this.container.querySelector('#reset-btn') as HTMLButtonElement;

    formGroups.forEach(el => el.classList.add('hidden'));
    if (submitBtn) submitBtn.classList.add('hidden');
    if (successEl) successEl.classList.remove('hidden');
  }

  private hideSuccess(): void {
    if (!this.container) return;
    const successEl = this.container.querySelector('#success-message') as HTMLElement;
    if (successEl) {
      successEl.classList.add('hidden');
    }
  }
}