# Vinculivo Evidence Adapter Contract v1

This is a **neutral integration format**, not an assertion that other ArmoTuSitio extensions already implement it.

## Manual import

Select **Evidence → Import JSON report**. The JSON file must be inside the trusted workspace, max 100 KB, UTF-8, with this schema:

```json
{
  "schema": "vinculivo-evidence-v1",
  "provider": "Probato PR",
  "title": "PR #125 verified review",
  "summary": "No P0 vulnerabilities found in verified scope",
  "sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

Required: `schema`, `provider`, `title`, `summary`. Optional: `sha` (exact 40/64 hexadecimal characters).

All data is treated as **user-provided, unverified**. The original report should be checked before merging or trusting decisions. The file is never executed.

## In-process opt-in adapter

A future integration in another installed VS Code extension can activate Vinculivo and register a provider:

```ts
const extension = vscode.extensions.getExtension('armotusitio.vinculivo');
if (extension) {
  const api = await extension.activate() as {
    registerEvidenceProvider(name: string, collect: () => Promise<unknown[]>): vscode.Disposable;
  };
  const registration = api.registerEvidenceProvider('My extension', async () => [{
    schema: 'vinculivo-evidence-v1', provider: 'My extension',
    title: 'Read-only check', summary: 'Verified a bounded, referenced finding'
  }]);
  context.subscriptions.push(registration);
}
```

Vinculivo does not call the provider automatically. The user must explicitly select a provider via **Vinculivo: Collect Registered Evidence**. Malformed or excessive reports are rejected. Actual direct adapters for Probato PR, Indizivo, Orquestivo, Saturivo, Noditrivo and Vestigivo RCA require stable verified APIs and should be introduced in separate reviews.
