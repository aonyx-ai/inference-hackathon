/**
 * Derive an {@link Architecture} from workspace package manifests, so rules are
 * checked against the real dependency graph rather than a hand-maintained model
 * that can drift. A dependency on another workspace package becomes an internal
 * edge; anything else is external.
 */

import type { Architecture, Component, Dependency } from "./model.ts";

export interface Manifest {
  /** A stable id, conventionally the package's directory name. */
  readonly id: string;
  /** The package.json `name`. */
  readonly name: string;
  readonly dependencies: Readonly<Record<string, string>>;
}

export function toArchitecture(manifests: readonly Manifest[]): Architecture {
  const idByName = new Map(manifests.map((m) => [m.name, m.id]));

  const components: Component[] = manifests.map((manifest) => {
    const dependsOn: Dependency[] = Object.keys(manifest.dependencies).map(
      (dep) => {
        const internalId = idByName.get(dep);
        return internalId === undefined
          ? { to: dep, kind: "external" }
          : { to: internalId, kind: "internal" };
      },
    );
    return { id: manifest.id, name: manifest.name, dependsOn };
  });

  return { components };
}
