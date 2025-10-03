# sails-hook-waterline-safe-criteria

Guard Sails/Waterline queries from silently matching *everything* when unsafe criteria slip through (e.g. `undefined` in a `where` clause or calling `Model.destroy()` with no filters).


**Key points**
- Secure by default: once installed the guard is active unless you explicitly disable it.
- Per-model overrides let you keep legacy behaviour where needed.
- Per-query bypass is available by including `meta: { allowUndefinedWhere: true }` alongside your criteria.

## Why this hook exists

Waterline 0.15 keeps backwards compatibility by stripping undefined values from criteria. In destructive operations that turns this:

```javascript
await User.destroy({ where: { status: undefined } });
```

into `User.destroy({})` and deletes every record.

`sails-hook-waterline-safe-criteria` adds a guard without forking Waterline. The hook is secure by default; you can opt out globally, per model, or on individual queries when you really need the legacy behaviour.

## Requirements

| Dependency | Requirement |
|------------|-------------|
| Sails      | ≥ 1.0.0 |
| Waterline  | 0.15.x (bundled with Sails 1.x) |
| Node.js    | ≥ 14 (tests run on 16+) |

The hook inspects stage-one criteria, so it works with any adapter (sails-disk, sails-mongo, sails-postgresql, custom adapters, etc.).

## Local development

1. Install dependencies: `npm install`.
2. Run the unit/integration suite with `npm test`.
3. Ensure Docker is available if you plan to exercise the adapter matrix (`npm run test:adapters`).
4. Use `npm run test:all` before sending changes to cover every scenario.

## Installation

```bash
npm install sails-hook-waterline-safe-criteria --save
```

Sails auto-loads any dependency named `sails-hook-*`. If you prefer to be explicit (or to customise the config key) add the hook to `config/hooks.js`:

```javascript
module.exports.hooks = {
  'waterline-safe-criteria': require('sails-hook-waterline-safe-criteria')
};
```

## Configuration

| Scope | Setting | Effect |
|-------|---------|--------|
| Global | `config/models.js` → `rejectUndefinedWhere` (default: `true`) | Secure-by-default. Set to `false` if you intentionally want legacy behaviour. |
| Per model | `api/models/Order.js` → `rejectUndefinedWhere: true` | Opt in for specific models only (inherits the global default otherwise). |
| Hook defaults | `config/waterline-safe-criteria.js` → `{ enabled: false }` | Optional: explicitly opt out of the default guard for the whole app. |

### Per-query bypass

Legacy code paths can still opt in to the old behaviour (or you can disable the guard globally by setting `config.models.rejectUndefinedWhere = false`). Add a `meta` object to your stage-one criteria when you really need to bypass the undefined check:

```javascript
await Order.destroy({
  where: criteria,
  meta: { allowUndefinedWhere: true }
});
```

The guard still requires criteria to exist, but it ignores undefined values when that meta flag is present. The original meta object is reattached to Waterline’s Deferred so adapter-level features (`.meta({ fetch: true })`, etc.) keep working.

## What the guard does

After `sails-hook-orm` loads, the hook wraps these helpers on every guarded model:

`find`, `findOne`, `destroy`, `destroyOne`, `update`, `updateOne`, `count`, `sum`, `avg`

Each call goes through the following checks:

1. Criteria must be supplied (no bare `Model.destroy()` / `Model.update()`).
2. Any `undefined` inside the `where` clause—including nested `and`/`or`/`in` structures—is rejected.
3. Criteria objects are not mutated; the hook works with Promises or old-school Deferreds alike.

If an unsafe pattern is detected the guard throws a `flaverr` with code **`E_UNDEFINED_WHERE`**. Example messages:

```
Unsafe DESTROY on `user` would hit every record. Pass an explicit WHERE or include `meta: { allowUndefinedWhere: true }` to bypass intentionally.
```

```
Unsafe UPDATE on `order` detected undefined inside WHERE clause. Undefined values cause Waterline to remove predicates and match everything. Scrub the criteria first, or bypass with `meta: { allowUndefinedWhere: true }`.
```

### Migration tips

1. **Enable in staging first.** Turn on `rejectUndefinedWhere` globally and run your test suite. Any unsafe queries now fail early.
2. **Fix or bypass intentionally.** Clean up the criteria or add `meta: { allowUndefinedWhere: true }` where the behaviour is desired.
3. **Roll out per model if needed.** Leave legacy models unguarded (`rejectUndefinedWhere: false`) while protecting everything else.

### Behaviour summary

- Throws when criteria are missing (even with bypass meta).
- Accepts primary-key shorthand (`Model.find(7)` or `Model.destroy([1,2])`).
- Catches undefined inside nested predicates and arrays.
- Supports `meta: { allowUndefinedWhere: true }` to bypass only the undefined-value check.
- Keeps Deferred helpers (`.meta`, `.fetch`) intact.

## Example

```javascript
// Before (legacy behaviour wipes everything)
await User.destroy({ where: { status: undefined } });

// After enabling the hook (throws E_UNDEFINED_WHERE)
await User.destroy({ where: { status: undefined } });

// If you really need the legacy behaviour:
await User.destroy({ where: { status: undefined }, meta: { allowUndefinedWhere: true } });
```

## Testing

Run the core unit + integration suite:

```bash
npm test
```

Adapter coverage (MySQL, PostgreSQL, MongoDB) lives in a separate job because it depends on Docker:

```bash
npm run test:adapters
```

For everything at once, use:

```bash
npm run test:all
```

The suites verify the guard on every Waterline helper, nested criteria detection, meta bypass behaviour, and three integration scenarios (guarded app, baseline app, per-model configuration). The adapter matrix re-runs the critical happy/sad paths against real adapters.

## Adapter test matrix

A docker-compose file is included for local adapter testing, and the helper script bootstraps/tears down everything automatically:

```bash
npm run test:adapters
```

Under the hood the script starts the compose stack, waits for each service to be ready, exports the expected connection strings, runs the adapter spec, and shuts everything down. Nothing to configure.

> Tip: `npm run test:all` chains the full suite. `npm run test:adapters:raw` runs just the adapter spec when you already have databases running.

| Variable | Description |
|----------|-------------|
| `TEST_MYSQL_URL` | Override MySQL connection string (defaults to compose stack). |
| `TEST_POSTGRES_URL` | Override PostgreSQL connection string (defaults to compose stack). |
| `TEST_MONGO_URL` | Override Mongo connection string (defaults to compose stack). |

## Limitations

- Only stage-one criteria are inspected. Raw adapter calls or stage-two tweaks are unaffected.
- The guard doesn’t attempt to rewrite unsafe queries; it simply throws so you can decide how to fix or bypass.
- `allowUndefinedWhere` bypasses undefined checks but *not* the “criteria required” rule.

## License

MIT © Luis Lobo Borobia
