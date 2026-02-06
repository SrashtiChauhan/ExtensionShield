import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AuthCallbackPage from '../AuthCallbackPage';
import { supabase } from '../../../services/supabaseClient';

// Mock supabase
vi.mock('../../../services/supabaseClient', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: vi.fn(),
    },
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => {
      const params = new URLSearchParams(window.location.search);
      return [params];
    },
  };
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    window.location.search = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
  });

  const renderComponent = (searchParams = '') => {
    window.location.search = searchParams;
    return render(
      <BrowserRouter>
        <AuthCallbackPage />
      </BrowserRouter>
    );
  };

  describe('successful authentication', () => {
    it('exchanges code and redirects to stored returnTo', async () => {
      sessionStorageMock.setItem('auth:returnTo', '/scan?x=1');
      const mockSession = {
        session: {
          access_token: 'token123',
          user: { id: 'user123', email: 'test@example.com' },
        },
      };
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: mockSession, error: null });

      renderComponent('?code=abc123');

      await waitFor(() => {
        expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/scan?x=1', { replace: true });
      });

      expect(sessionStorageMock.getItem('auth:returnTo')).toBeNull();
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('auth:returnTo');
    });

    it('redirects to home when no returnTo stored', async () => {
      const mockSession = {
        session: {
          access_token: 'token123',
          user: { id: 'user123', email: 'test@example.com' },
        },
      };
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: mockSession, error: null });

      renderComponent('?code=abc123');

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    });
  });

  describe('missing code handling', () => {
    it('shows friendly error when code is missing', async () => {
      renderComponent('');

      await waitFor(() => {
        expect(screen.getByText(/missing authorization code/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('?authError=missing_code'), { replace: true });
      });
    });

    it('redirects home with error when code is missing', async () => {
      renderComponent('');

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  describe('OAuth provider errors', () => {
    it('handles error from provider', async () => {
      renderComponent('?error=access_denied&error_description=User%20cancelled');

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('shows error description when provided', async () => {
      renderComponent('?error=access_denied&error_description=User%20cancelled');

      await waitFor(() => {
        const errorText = screen.getByText(/user cancelled/i);
        expect(errorText).toBeInTheDocument();
      });
    });
  });

  describe('PKCE verifier errors', () => {
    it('shows retry message for PKCE verifier errors', async () => {
      sessionStorageMock.setItem('auth:returnTo', '/');
      const pkceError = {
        message: 'both auth code and code verifier should be non-empty',
      };
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: null, error: pkceError });

      renderComponent('?code=abc123');

      await waitFor(() => {
        expect(screen.getByText(/please retry sign-in/i)).toBeInTheDocument();
      });
    });

    it('shows retry message for code verifier errors', async () => {
      sessionStorageMock.setItem('auth:returnTo', '/');
      const pkceError = {
        message: 'code verifier is missing',
      };
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: null, error: pkceError });

      renderComponent('?code=abc123');

      await waitFor(() => {
        expect(screen.getByText(/please retry sign-in/i)).toBeInTheDocument();
      });
    });
  });

  describe('StrictMode double-mount protection', () => {
    it('calls exchangeCodeForSession only once', async () => {
      sessionStorageMock.setItem('auth:returnTo', '/');
      const mockSession = {
        session: {
          access_token: 'token123',
          user: { id: 'user123', email: 'test@example.com' },
        },
      };
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: mockSession, error: null });

      const { rerender } = renderComponent('?code=abc123');

      // Simulate React StrictMode double render
      rerender(
        <BrowserRouter>
          <AuthCallbackPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('session creation failures', () => {
    it('handles exchange error gracefully', async () => {
      sessionStorageMock.setItem('auth:returnTo', '/');
      const error = { message: 'Invalid code' };
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: null, error });

      renderComponent('?code=invalid');

      await waitFor(() => {
        expect(screen.getByText(/invalid code/i)).toBeInTheDocument();
      });
    });

    it('handles missing session in response', async () => {
      sessionStorageMock.setItem('auth:returnTo', '/');
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

      renderComponent('?code=abc123');

      await waitFor(() => {
        expect(screen.getByText(/session creation failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('sessionStorage usage', () => {
    it('uses sessionStorage instead of localStorage', async () => {
      sessionStorageMock.setItem('auth:returnTo', '/scan');
      const mockSession = {
        session: {
          access_token: 'token123',
          user: { id: 'user123', email: 'test@example.com' },
        },
      };
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: mockSession, error: null });

      renderComponent('?code=abc123');

      await waitFor(() => {
        expect(sessionStorageMock.getItem).toHaveBeenCalledWith('auth:returnTo');
        expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('auth:returnTo');
      });
    });

    it('clears sessionStorage on error', async () => {
      sessionStorageMock.setItem('auth:returnTo', '/scan');
      const error = { message: 'Invalid code' };
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: null, error });

      renderComponent('?code=invalid');

      await waitFor(() => {
        expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('auth:returnTo');
      });
    });
  });
});

