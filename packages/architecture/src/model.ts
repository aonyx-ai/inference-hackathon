/**
 * The architecture substrate: the system's components and the dependencies
 * between them. This is the graph that architectural rules are checked against,
 * the architecture-surface analogue of the domain model's entity graph.
 *
 * A component is a workspace package or app. A dependency points either at
 * another component (`internal`) or at an npm package (`external`), because
 * rules care about both — "core imports no Tauri" is about an external edge,
 * "libraries never depend on the app shell" about an internal one.
 */

export type ComponentId = string;

export interface Dependency {
  /** A component id when `kind` is internal, otherwise an npm package name. */
  readonly to: string;
  readonly kind: "internal" | "external";
}

export interface Component {
  readonly id: ComponentId;
  readonly name: string;
  readonly dependsOn: readonly Dependency[];
}

export interface Architecture {
  readonly components: readonly Component[];
}

/**
 * Check the architecture is internally consistent: component ids are unique and
 * every internal dependency resolves to a component that exists. Returns a list
 * of problems, empty when the model is sound.
 */
export function validate(architecture: Architecture): readonly string[] {
  const problems: string[] = [];
  const ids = new Set<ComponentId>();

  for (const component of architecture.components) {
    if (ids.has(component.id))
      problems.push(`duplicate component id: ${component.id}`);
    ids.add(component.id);
  }

  for (const component of architecture.components) {
    for (const dep of component.dependsOn) {
      if (dep.kind === "internal" && !ids.has(dep.to)) {
        problems.push(
          `${component.id} depends on unknown component: ${dep.to}`,
        );
      }
    }
  }

  return problems;
}
