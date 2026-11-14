import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import './ui.css';
import { playTap } from './lib/sound.js';

// Un suono a ogni tocco di bottone o pulsante (le caselle della griglia hanno i loro suoni)
document.addEventListener(
  'click',
  (event) => {
    const target = (event.target as Element | null)?.closest('button, [role="button"], [data-node], a[href], .btn');
    if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return;
    playTap();
  },
  true,
);

mount(App, { target: document.getElementById('app')! });
