# Test agent rules

Purpose: ensure tests are as close to production behaviour as possible while remaining deterministic and fast.

Core rule (must be followed by this agent):
- Never stub or replace runtime objects/instances (no partial object stubs or method monkey-patching). Instead, stub/mask only external APIs and I/O boundaries (network calls, browser.storage, external services).

Guidelines:
- Mock APIs, not objects
  - Use network mocking (Vitest fetch mocks, msw, or Playwright route interception) to return realistic mocked responses.
  - For browser platform APIs (tabs, storage, runtime), provide a small test double that implements the same API surface and delegates to in-memory behavior; do not replace internal service objects used by components.

- Keep services and logic real
  - Prefer to use the existing service implementations (e.g. `StorageService`, `ExtensionCleanupService`, `TabDots`) in tests, but supply mocked network or browser dependencies so the service operates as in production.
  - If a service performs network I/O, mock the network layer rather than replacing the service.

- Use dependency injection or test helpers
  - Where a component depends on a service, prefer wiring a test helper that configures the real service with mocked backends. Avoid injecting hand-crafted stub objects with incomplete behavior.

- Provide realistic mocked data
  - Mock data should resemble production payloads and cover edge cases (404s, empty bodies, small images) so rendering and logic behave correctly.

- Keep tests isolated and deterministic
  - Reset mocked network state between tests, restore global browser mocks, and persist only the minimal snapshot needed for the scenario.

Why
- Stubbing objects often results in brittle tests that pass due to the stub's limited shape but fail in production where the real object exposes more behavior.
- Mocking external boundaries preserves internal logic execution and surfaces regressions earlier.

Examples
- Good: Use `msw` or Vitest fetch mock to return a realistic favicon PNG for `fetch` and let `TabDots` process it.
- Bad: Replace `TabDots.renderLBracketDataUrl` with a stub that returns a placeholder string — this hides canvas rendering bugs and injection issues.

If a test requires a small, fully-controlled environment (E2E), prefer Playwright with route interception for network, and a disposable browser profile for storage/tabs rather than heavy stubbing.

When generating tests, follow these rules automatically and add a short rationale comment in the generated test explaining which boundary was mocked and why.
