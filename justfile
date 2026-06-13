# Run all recipes inside the Flox environment
set shell := ["flox", "activate", "--", "sh", "-cu"]

[private]
default:
    @just --list

# Install JavaScript dependencies
install:
    bun install

# Run a subset of checks as pre-commit hooks
pre-commit:
    #!/usr/bin/env -S parallel --shebang --ungroup --jobs {{ num_cpus() }}
    just prettier true
    just format-toml true
    just format-ts true
    just format-rust true
    just lint-ts
    just check-types
    just lint-github-actions
    just lint-markdown
    just lint-yaml

# Type-check every package with the native (Go) TypeScript compiler
check-types:
    for cfg in packages/*/tsconfig.json apps/*/tsconfig.json; do echo "→ $cfg"; bunx tsgo -p "$cfg" || exit 1; done

# Format JSON files
format-json fix="false": (prettier fix "{json,json5}")

# Format Markdown files
format-markdown fix="false": (prettier fix "md")

# Format TOML files
format-toml fix="false":
    taplo fmt {{ if fix != "true" { "--diff" } else { "" } }}

# Format Rust code with rustfmt
format-rust fix="false":
    cd apps/desktop/src-tauri && cargo fmt {{ if fix != "true" { "-- --check" } else { "" } }}

# Format TypeScript and JavaScript with oxfmt (prettier owns JSON/YAML/Markdown)
format-ts fix="false":
    bunx oxfmt --ignore-path .gitignore {{ if fix != "true" { "--check" } else { "" } }} '**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'

# Format YAML files
format-yaml fix="false": (prettier fix "{yaml,yml}")

# Lint GitHub Actions workflows
lint-github-actions:
    zizmor -p .

# Lint Markdown files
lint-markdown:
    markdownlint **/*.md

# Lint TOML files
lint-toml:
    taplo check

# Lint Rust code with clippy
lint-rust:
    cd apps/desktop/src-tauri && cargo clippy --all-targets --locked -- -D warnings

# Lint TypeScript and JavaScript with oxlint
lint-ts:
    bunx oxlint

# Lint YAML files
lint-yaml:
    yamllint .

# Regenerate the domain model diagram in docs/domain-model.md
render-domain:
    cd packages/domain && bun run render

# Run all fast tests (Rust unit + frontend unit)
test: test-rust test-ts

# Run frontend unit tests with bun
test-ts:
    bun test

# Run Rust unit tests
test-rust:
    cd apps/desktop/src-tauri && cargo test --locked

# Run the Tauri desktop app in development
tauri-dev:
    cd apps/desktop && bun run tauri dev

# Build the Tauri desktop app
tauri-build:
    cd apps/desktop && bun run tauri build

# Print Tauri environment diagnostics
tauri-info:
    cd apps/desktop && bun run tauri info

# Auto-format files with prettier
prettier fix="false" extension="*":
    prettier {{ if fix == "true" { "--write" } else { "--list-different" } }} --ignore-unknown "**/*.{{ extension }}"
