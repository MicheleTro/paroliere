<script lang="ts">
  import { adminLogin } from '../lib/admin.svelte.js';
  import { login, register } from '../lib/auth.svelte.js';

  type Mode = 'login' | 'register';

  let mode: Mode = $state('login');
  let identifier = $state('');
  let username = $state('');
  let email = $state('');
  let password = $state('');
  let error: string | undefined = $state();
  let submitting = $state(false);

  function switchMode(next: Mode): void {
    mode = next;
    error = undefined;
  }

  async function handleSubmit(): Promise<void> {
    error = undefined;
    submitting = true;
    try {
      if (mode === 'login' && identifier === 'admin') {
        await adminLogin(identifier, password);
      } else if (mode === 'login') {
        await login(identifier, password);
      } else {
        await register(username, email, password);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="auth">
  <div class="brand">
    <span class="logo">🔤</span>
    <h1>Paroliere</h1>
    <p class="tagline">Trova tutte le parole, batti i tuoi amici</p>
  </div>

  <div class="card">
    <div class="tabs">
      <button type="button" class:selected={mode === 'login'} onclick={() => switchMode('login')}>Accedi</button>
      <button type="button" class:selected={mode === 'register'} onclick={() => switchMode('register')}>
        Registrati
      </button>
    </div>

    <form onsubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
      {#if mode === 'login'}
        <label class="field">
          Username o email
          <input type="text" bind:value={identifier} autocomplete="username" required />
        </label>
      {:else}
        <label class="field">
          Username
          <input type="text" bind:value={username} autocomplete="username" required />
        </label>
        <label class="field">
          Email
          <input type="email" bind:value={email} autocomplete="email" required />
        </label>
      {/if}

      <label class="field">
        Password
        <input type="password" bind:value={password} autocomplete="current-password" required />
      </label>

      {#if error}
        <p class="error-text">{error}</p>
      {/if}

      <button type="submit" class="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Registrati'}
      </button>
    </form>
  </div>
</div>

<style>
  .auth {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    width: min(90vw, 380px);
    padding-top: 8vh;
  }

  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
  }

  .logo {
    font-size: 2.4rem;
    line-height: 1;
    margin-bottom: 4px;
  }

  .brand h1 {
    font-size: 1.8rem;
  }

  .tagline {
    font-size: 0.9rem;
    color: var(--color-ink-soft);
    font-weight: 500;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .tabs {
    display: flex;
    gap: 6px;
    padding: 4px;
    border-radius: var(--radius-pill);
    background: var(--color-surface-alt);
  }

  .tabs button {
    flex: 1;
    font-size: 0.92rem;
    font-weight: 700;
    padding: 9px 0;
    border-radius: var(--radius-pill);
    border: none;
    background: transparent;
    color: var(--color-ink-soft);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .tabs button.selected {
    background: var(--color-surface);
    color: var(--color-accent);
    box-shadow: var(--shadow-float);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
</style>
