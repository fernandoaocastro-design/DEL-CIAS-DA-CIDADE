import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Redireciona chamadas da API (/.netlify) para o servidor do Netlify (porta 8888)
    proxy: {
      '/.netlify': 'http://localhost:8888'
    }
  }
});