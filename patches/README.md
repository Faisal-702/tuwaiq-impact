# Dependency patches

Applied automatically after `npm install` by [patch-package](https://github.com/ds300/patch-package)
(`postinstall` script). If a dependency is upgraded and its patch no longer applies, the install
fails loudly. Re-check the patch against the new version and regenerate it with
`npx patch-package <name>`.

## `postgres+3.4.9.patch`: one round trip per query

The app connects through Supabase's transaction pooler, so prepared statements are disabled
(`prepare: false` in `src/server/db.ts`). In that mode postgres.js sent every query that has
parameters in **two** network round trips: first Parse + Describe, to ask the server for the
parameter types; then Bind + Execute. It also could not pipeline other queries on that connection
in the meantime. With the database in a remote region, that doubled the latency of almost every
database call (session checks, page data, server actions).

The patch sends Parse + Describe + Bind + Execute together, in **one** round trip, as other
drivers (e.g. node-postgres) do. It applies only when every parameter is sent the same whatever
type the server infers:

- `null`, or a string or number, sent as text. The server parses it for the column's type.
- A value with an explicit type: boolean, `Date`, bytes, `sql.json(...)`.

Arrays and plain objects need the server's types to be serialized. Queries with them keep the
original two-step path. The app passes JSON through `sql.json(...)`, as it must, and never passes
bare strings into JSON, boolean or date columns.
