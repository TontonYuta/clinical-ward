import assert from 'node:assert/strict';
import { resolveWebApiBaseUrl } from '../src/config/apiConfig';

assert.equal(resolveWebApiBaseUrl(undefined), '/api/v1', 'web deployment defaults to same-origin API proxy');
assert.equal(resolveWebApiBaseUrl('https://clinical-ward-api.onrender.com/api/v1'), '/api/v1', 'web deployment ignores cross-origin API URL so HttpOnly session cookies stay first-party');
assert.equal(resolveWebApiBaseUrl('https://other-api.example/api/v1'), '/api/v1', 'all web API calls remain same-origin');
console.log('auth API origin tests passed');
