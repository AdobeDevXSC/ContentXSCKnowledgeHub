/// <reference types="@fastly/js-compute" />

import { SecretStore } from 'fastly:secret-store';
import { getSecretsMap } from './secret-map.js';

export class SecretStoreManager {
  static instance = null;

  constructor() {
    this.store = null;
    this.secretMapState = {};
  }

  static getInstance() {
    if (!SecretStoreManager.instance) {
      SecretStoreManager.instance = new SecretStoreManager();
    }
    return SecretStoreManager.instance;
  }

  async getSecret(key) {
    if (!this.store) this.store = new SecretStore('secret_default');

    const secretsMap = await getSecretsMap(this.store, this.secretMapState);
    if (secretsMap && Object.prototype.hasOwnProperty.call(secretsMap, key)) {
      return secretsMap[key];
    }

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
