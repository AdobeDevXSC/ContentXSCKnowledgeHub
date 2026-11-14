/// <reference types="@fastly/js-compute" />

import { SecretStore } from 'fastly:secret-store';

export class SecretStoreManager {
  static instance = null;

  constructor() {
    this.store = null;
    this.secretsMap = null;
    this.secretsMapLoaded = false;
  }

  static getInstance() {
    if (!SecretStoreManager.instance) {
      SecretStoreManager.instance = new SecretStoreManager();
    }
    return SecretStoreManager.instance;
  }

  async getSecret(key) {
    if (!this.store) this.store = new SecretStore('secret_default');

    if (!this.secretsMapLoaded) {
      this.secretsMapLoaded = true;
      try {
        const entry = await this.store.get('secrets');
        if (entry) this.secretsMap = JSON.parse(entry.plaintext());
      } catch {
        this.secretsMap = null;
      }
    }

    if (this.secretsMap && key in this.secretsMap) return this.secretsMap[key];

    const secret = await this.store.get(key);
    if (!secret) {
      const error = new Error(`Secret '${key}' not found in store`);
      error.name = 'MissingSecretError';
      throw error;
    }
    return secret.plaintext();
  }

  static async getSecret(key) {
    return SecretStoreManager.getInstance().getSecret(key);
  }
}
