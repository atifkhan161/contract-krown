import '@tests/setup.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegistrationView } from '@src/ui/registration-view.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const isJsdom = typeof document !== 'undefined';

(isJsdom ? describe : describe.skip)('RegistrationView (Task 18.4)', () => {
  let view: RegistrationView;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    view = new RegistrationView();
  });

  (isJsdom ? it : it.skip)('should render registration form with required fields', () => {
    const container = view.render();

    expect(container.querySelector('#register-username')).not.toBeNull();
    expect(container.querySelector('#register-password')).not.toBeNull();
    expect(container.querySelector('#register-btn')).not.toBeNull();
    expect(container.querySelector('#back-to-login-link')).not.toBeNull();
  });

  (isJsdom ? it : it.skip)('should display password hint about minimum 4 characters', () => {
    const container = view.render();
    const passwordInput = container.querySelector('#register-password') as HTMLInputElement;

    expect(passwordInput.placeholder).toContain('4 characters');
  });

  (isJsdom ? it : it.skip)('should have error and success message containers', () => {
    const container = view.render();

    expect(container.querySelector('#register-error')).not.toBeNull();
    expect(container.querySelector('#register-success')).not.toBeNull();
  });

  (isJsdom ? it : it.skip)('should hide error and success messages by default', () => {
    const container = view.render();

    expect(container.querySelector('#register-error')?.classList.contains('hidden')).toBe(true);
    expect(container.querySelector('#register-success')?.classList.contains('hidden')).toBe(true);
  });

  (isJsdom ? it : it.skip)('should show error for empty username', () => {
    const container = view.render();
    const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
    const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

    usernameInput.value = '';
    passwordInput.value = 'validpass';

    registerBtn.click();

    const errorEl = container.querySelector('#register-error');
    expect(errorEl?.textContent).toBe('Username is required');
    expect(errorEl?.classList.contains('hidden')).toBe(false);
  });

  (isJsdom ? it : it.skip)('should show error for password less than 4 characters', () => {
    const container = view.render();
    const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
    const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

    usernameInput.value = 'testuser';
    passwordInput.value = 'abc';

    registerBtn.click();

    const errorEl = container.querySelector('#register-error');
    expect(errorEl?.textContent).toBe('Password must be at least 4 characters');
    expect(errorEl?.classList.contains('hidden')).toBe(false);
  });

  (isJsdom ? it : it.skip)('should call registration API with correct payload on valid form submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        userId: 'user-123',
        username: 'testuser',
        token: 'abc123',
        expiresAt: Date.now() + 86400000
      })
    });

    const container = view.render();
    const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
    const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

    usernameInput.value = 'testuser';
    passwordInput.value = 'validpass';

    registerBtn.click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockFetch).toHaveBeenCalledWith('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'validpass' })
    });
  });

  (isJsdom ? it : it.skip)('should show error on duplicate username (409)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ message: 'Username is already taken' })
    });

    const container = view.render();
    const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
    const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

    usernameInput.value = 'existinguser';
    passwordInput.value = 'validpass';

    registerBtn.click();

    await new Promise(resolve => setTimeout(resolve, 100));

    const errorEl = container.querySelector('#register-error');
    expect(errorEl?.textContent).toBe('Username is already taken');
    expect(errorEl?.classList.contains('hidden')).toBe(false);
  });

  (isJsdom ? it : it.skip)('should show error on validation failure (400)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid input' })
    });

    const container = view.render();
    const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
    const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

    usernameInput.value = 'testuser';
    passwordInput.value = 'validpass';

    registerBtn.click();

    await new Promise(resolve => setTimeout(resolve, 100));

    const errorEl = container.querySelector('#register-error');
    expect(errorEl?.textContent).toBe('Invalid input');
  });

  (isJsdom ? it : it.skip)('should show error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const container = view.render();
    const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
    const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

    usernameInput.value = 'testuser';
    passwordInput.value = 'validpass';

    registerBtn.click();

    await new Promise(resolve => setTimeout(resolve, 100));

    const errorEl = container.querySelector('#register-error');
    expect(errorEl?.textContent).toBe('Network error. Please check your connection.');
  });

  (isJsdom ? it : it.skip)('should re-enable register button after submission completes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        userId: 'user-123',
        username: 'testuser',
        token: 'abc123',
        expiresAt: Date.now() + 86400000
      })
    });

    const container = view.render();
    const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
    const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

    usernameInput.value = 'testuser';
    passwordInput.value = 'validpass';

    registerBtn.click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(registerBtn.disabled).toBe(false);
    expect(registerBtn.textContent).toBe('Register');
  });

  (isJsdom ? it : it.skip)('should clear container reference on destroy', () => {
    view.render();
    view.destroy();

    expect((view as any).container).toBeNull();
  });
});
