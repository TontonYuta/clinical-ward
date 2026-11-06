/** Offline presentation tests explicitly opt into the server's demo-auth response. */
export async function mockDemoAuth(context) {
  await context.route(url => url.pathname === '/api/v1/auth/me', route => route.fulfill({
    status: 200,
    json: { enabled: false, authenticated: true, username: 'local', role: 'nurse' },
  }));
}
