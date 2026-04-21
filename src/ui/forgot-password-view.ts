// Contract Crown Forgot Password View
// Password reset request form

const API_BASE = '';

export interface ForgotPasswordViewConfig {
  onBackToLogin?: () => void;
}

export class ForgotPasswordView {
  private container: HTMLElement | null = null;
  private config: ForgotPasswordViewConfig;
  private isLoading: boolean = false;

  constructor(config: ForgotPasswordViewConfig = {}) {
    this.config = config;
  }

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'login-view';
    container.innerHTML = `
      <div class="login-container">
        <div class="app-title">Reset Password</div>
        <div class="app-subtitle">Enter your email to receive a reset link</div>
        <div class="form-group">
          <input class="form-input" type="email" placeholder="Email" id="forgot-email" />
        </div>
        <button class="btn btn-primary w-full" id="forgot-btn">Send Reset Link</button>
        <div class="success-message hidden" id="success-message">
          <span>Check your email for the reset link</span>
        </div>
        <div class="error-message hidden" id="error-message"></div>
        <div class="back-link mt-4">
          <a href="#" id="back-link">&larr; Back to Login</a>
        </div>
      </div>
    `;

    this.container = container;
    this.attachEventListeners();
    return container;
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const emailInput = this.container.querySelector('#forgot-email') as HTMLInputElement;
    const submitBtn = this.container.querySelector('#forgot-btn') as HTMLButtonElement;
    const backLink = this.container.querySelector('#back-link') as HTMLAnchorElement;

    submitBtn?.addEventListener('click', () => this.handleSubmit(emailInput.value));

    emailInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSubmit(emailInput.value);
      }
    });

    backLink?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.config.onBackToLogin) {
        this.config.onBackToLogin();
      }
    });
  }

  private async handleSubmit(email: string): Promise<void> {
    this.hideError();
    this.hideSuccess();

    if (!email.trim()) {
      this.showError('Please enter your email');
      return;
    }

    this.setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        this.showError(data.message || 'Failed to send reset email');
        return;
      }

      this.showSuccess();
    } catch (error) {
      this.showError('Network error. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  private setLoading(loading: boolean): void {
    if (!this.container) return;
    this.isLoading = loading;
    const emailInput = this.container.querySelector('#forgot-email') as HTMLInputElement;
    const submitBtn = this.container.querySelector('#forgot-btn') as HTMLButtonElement;

    if (emailInput) emailInput.disabled = loading;
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Sending...' : 'Send Reset Link';
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
    const formGroup = this.container.querySelector('.form-group') as HTMLElement;
    const submitBtn = this.container.querySelector('#forgot-btn') as HTMLButtonElement;

    if (formGroup) formGroup.classList.add('hidden');
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