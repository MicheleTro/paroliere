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
  <h1>Paroliere</h1>

  <div class="tabs">
    <button type="button" class:selected={mode === 'login'} onclick={() => switchMode('login')}>Accedi</button>
    <button type="button" class:selected={mode === 'register'} onclick={() => switchMode('register')}>
      Registrati
    </button>
  </div>

  <form onsubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
    {#if mode === 'login'}
      <label>
        Username o email
        <input type="text" bind:value={identifier} autocomplete="username" required />
      </label>
    {:else}
      <label>
        Username
        <input type="text" bind:value={username} autocomplete="username" required />
      </label>
      <label>
        Email
        <input type="email" bind:value={email} autocomplete="email" required />
      </label>
    {/if}

    <label>
      Password
      <input type="password" bind:value={password} autocomplete="current-password" required />
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button type="submit" class="primary" disabled={submitting}>
      {submitting ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Registrati'}
    </button>
  </form>
</div>

<style>
  .auth {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: min(90vw, 360px);
  }

  .tabs {
    display: flex;
    gap: 8px;
  }

  .tabs button {
    font-size: 1rem;
    padding: 8px 16px;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink);
    cursor: pointer;
  }

  .tabs button.selected {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.9rem;
    color: var(--color-ink);
  }

  input {
    font-size: 1rem;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .error {
    color: var(--color-danger);
    font-size: 0.9rem;
    margin: 0;
  }

  button.primary {
    font-size: 1.1rem;
    padding: 10px 20px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    cursor: pointer;
  }

  button.primary:disabled {
    background: var(--color-disabled);
    color: var(--color-ink-soft);
    cursor: default;
  }
</style>
