<script lang="ts">
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
      if (mode === 'login') {
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
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: #1c2b3a;
    color: #f5f5f5;
    cursor: pointer;
  }

  .tabs button.selected {
    border-color: #4a90d9;
    background: #4a90d9;
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
    color: #1c2b3a;
  }

  input {
    font-size: 1rem;
    padding: 8px 12px;
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: white;
    color: #1c2b3a;
  }

  .error {
    color: #e06c6c;
    font-size: 0.9rem;
    margin: 0;
  }

  button.primary {
    font-size: 1.1rem;
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: #4a90d9;
    color: white;
    cursor: pointer;
  }

  button.primary:disabled {
    background: #7a8a99;
    cursor: default;
  }
</style>
