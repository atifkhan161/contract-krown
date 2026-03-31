// Contract Crown Registration View Tests
// Task 18.4: User Registration View

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegistrationView } from '@src/ui/registration-view.js';
import { sessionManager } from '@src/session/index.js';
import { router } from '@src/ui/router.js';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock router
vi.mock('@src/ui/router.js', () => ({
  router: {
    navigate: vi.fn(),
    handleLoginRedirect: vi.fn(),
  },
}));

// Mock session/index.js to export a mockable sessionManager
vi.mock('@src/session/index.js', () => {
  const mockSessionManager = {
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: vi.fn(() => false),
    getSession: vi.fn(() => null),
  };
  return {
    sessionManager: mockSessionManager,
    SessionManager: class SessionManager {
      login = mockSessionManager.login;
      logout = mockSessionManager.logout;
      isAuthenticated = mockSessionManager.isAuthenticated;
      getSession = mockSessionManager.getSession;
    },
  };
});

describe('RegistrationView (Task 18.4)', () => {
  let view: RegistrationView;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    view = new RegistrationView();
  });

  describe('18.4.1: RegistrationView Component', () => {
    it('should render registration form with required fields', () => {
      const container = view.render();

      expect(container.querySelector('#register-username')).not.toBeNull();
      expect(container.querySelector('#register-password')).not.toBeNull();
      expect(container.querySelector('#register-btn')).not.toBeNull();
      expect(container.querySelector('#back-to-login-link')).not.toBeNull();
    });

    it('should display password hint about minimum 4 characters', () => {
      const container = view.render();
      const passwordInput = container.querySelector('#register-password') as HTMLInputElement;

      expect(passwordInput.placeholder).toContain('4 characters');
    });

    it('should have error and success message containers', () => {
      const container = view.render();

      expect(container.querySelector('#register-error')).not.toBeNull();
      expect(container.querySelector('#register-success')).not.toBeNull();
    });

    it('should hide error and success messages by default', () => {
      const container = view.render();

      expect(container.querySelector('#register-error')?.classList.contains('hidden')).toBe(true);
      expect(container.querySelector('#register-success')?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('18.4.3: Registration Form Submission', () => {
    it('should show error for empty username', async () => {
      const container = view.render();
      const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
      const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
      const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

      usernameInput.value = '';
      passwordInput.value = 'validpass';

      registerBtn.click();

      await vi.waitFor(() => {
        const errorEl = container.querySelector('#register-error');
        expect(errorEl?.textContent).toBe('Username is required');
        expect(errorEl?.classList.contains('hidden')).toBe(false);
      });
    });

    it('should show error for password less than 4 characters', async () => {
      const container = view.render();
      const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
      const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
      const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

      usernameInput.value = 'testuser';
      passwordInput.value = 'abc';

      registerBtn.click();

      await vi.waitFor(() => {
        const errorEl = container.querySelector('#register-error');
        expect(errorEl?.textContent).toBe('Password must be at least 4 characters');
        expect(errorEl?.classList.contains('hidden')).toBe(false);
      });
    });

    it('should call registration API with correct payload on valid form submission', async () => {
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

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'validpass' })
        });
      });
    });

    it('should save session and redirect on successful registration', async () => {
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

      await vi.waitFor(() => {
        expect(sessionManager.login).toHaveBeenCalledWith('user-123', 'testuser', 'abc123', expect.any(Number));
        expect(router.handleLoginRedirect).toHaveBeenCalled();
      });
    });

    it('should show error on duplicate username (409)', async () => {
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

      await vi.waitFor(() => {
        const errorEl = container.querySelector('#register-error');
        expect(errorEl?.textContent).toBe('Username is already taken');
        expect(errorEl?.classList.contains('hidden')).toBe(false);
      });
    });

    it('should show error on validation failure (400)', async () => {
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

      await vi.waitFor(() => {
        const errorEl = container.querySelector('#register-error');
        expect(errorEl?.textContent).toBe('Invalid input');
      });
    });

    it('should show error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const container = view.render();
      const usernameInput = container.querySelector('#register-username') as HTMLInputElement;
      const passwordInput = container.querySelector('#register-password') as HTMLInputElement;
      const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

      usernameInput.value = 'testuser';
      passwordInput.value = 'validpass';

      registerBtn.click();

      await vi.waitFor(() => {
        const errorEl = container.querySelector('#register-error');
        expect(errorEl?.textContent).toBe('Network error. Please check your connection.');
      });
    });

    it('should re-enable register button after submission completes', async () => {
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

      await vi.waitFor(() => {
        expect(registerBtn.disabled).toBe(false);
        expect(registerBtn.textContent).toBe('Register');
      });
    });
  });

  describe('18.4.4: Navigation', () => {
    it('should navigate to login when "Back to Login" link is clicked', () => {
      const container = view.render();
      const backLink = container.querySelector('#back-to-login-link') as HTMLAnchorElement;

      const event = new Event('click');
      event.preventDefault = vi.fn();
      backLink.dispatchEvent(event);

      expect(router.navigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Destroy', () => {
    it('should clear container reference on destroy', () => {
      view.render();
      view.destroy();

      expect((view as any).container).toBeNull();
    });
  });
});
