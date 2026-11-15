import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicOrigin, withPublicOrigin } from '../src/lib/public-origin.js';
import { PUBLIC_ORIGIN } from '../src/sites.js';

test('uses the Stage site origin instead of the Edge Function request origin', () => {
  const env = withPublicOrigin({ OKTA_CLIENT_ID: 'client-id' }, { PUBLIC_ORIGIN });
  const edgeFunctionUrl = new URL(
    'https://edgefunction-p153659-d524473-knowledge-hub-stage-cug.adobeaemcloud.com/auth/login',
  );

  assert.equal(publicOrigin(env, edgeFunctionUrl), 'https://stage.xscknowledgehub.adobe.com');
});
