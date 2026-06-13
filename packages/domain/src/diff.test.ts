import { describe, expect, test } from "bun:test";

import { diff, formatChangeset, summarize } from "./diff.ts";
import { lontra } from "./lontra.ts";
import type { DomainEntity, DomainModel } from "./model.ts";

function m(...entities: DomainEntity[]): DomainModel {
  return { contexts: [{ id: "c", name: "Ctx" }], entities };
}

const order = (...fields: DomainEntity["fields"]): DomainEntity => ({
  id: "order",
  name: "Order",
  kind: "Entity",
  context: "c",
  fields,
});

const total = {
  id: "order.total",
  name: "total",
  type: { kind: "Scalar", name: "number" },
} as const;

test("a model diffed against itself yields no operations", () => {
  expect(diff(lontra, lontra).operations).toEqual([]);
  expect(formatChangeset(diff(lontra, lontra))).toBe("No changes.");
});

describe("field operations", () => {
  test("a new optional field is additive, a required one is breaking", () => {
    const before = m(order(total));
    const optional = m(
      order(total, {
        id: "order.note",
        name: "note",
        type: { kind: "Scalar", name: "string" },
        optional: true,
      }),
    );
    const required = m(
      order(total, {
        id: "order.note",
        name: "note",
        type: { kind: "Scalar", name: "string" },
      }),
    );

    expect(diff(before, optional).operations).toMatchObject([
      { kind: "AddField", compat: "Additive" },
    ]);
    expect(diff(before, required).operations).toMatchObject([
      { kind: "AddField", compat: "Breaking" },
    ]);
  });

  test("removing a field is breaking", () => {
    expect(diff(m(order(total)), m(order())).operations).toMatchObject([
      { kind: "RemoveField", compat: "Breaking" },
    ]);
  });

  test("a stable id makes a rename cosmetic, not a remove plus add", () => {
    const renamed = { ...total, name: "amount" };
    expect(diff(m(order(total)), m(order(renamed))).operations).toMatchObject([
      { kind: "RenameField", compat: "Cosmetic", field: "total", to: "amount" },
    ]);
  });

  test("retyping a field is breaking and reports both types", () => {
    const retyped = {
      ...total,
      type: { kind: "Scalar", name: "Money" },
    } as const;
    expect(diff(m(order(total)), m(order(retyped))).operations).toMatchObject([
      { kind: "RetypeField", compat: "Breaking", from: "number", to: "Money" },
    ]);
  });

  test("loosening optionality is additive, tightening is breaking", () => {
    const optional = { ...total, optional: true };
    expect(diff(m(order(total)), m(order(optional))).operations).toMatchObject([
      { kind: "ChangeFieldOptionality", compat: "Additive" },
    ]);
    expect(diff(m(order(optional)), m(order(total))).operations).toMatchObject([
      { kind: "ChangeFieldOptionality", compat: "Breaking" },
    ]);
  });

  test("changing arity or identity role is breaking", () => {
    const collection = { ...total, collection: true };
    expect(
      diff(m(order(total)), m(order(collection))).operations,
    ).toMatchObject([{ kind: "ChangeFieldArity", compat: "Breaking" }]);

    const identity = { ...total, role: "Identity" } as const;
    expect(diff(m(order(total)), m(order(identity))).operations).toMatchObject([
      { kind: "ChangeFieldRole", compat: "Breaking", to: "Identity" },
    ]);
  });
});

describe("entity operations", () => {
  test("adding an entity is additive, removing one is breaking", () => {
    expect(diff(m(), m(order(total))).operations).toMatchObject([
      { kind: "AddEntity", compat: "Additive" },
    ]);
    expect(diff(m(order(total)), m()).operations).toMatchObject([
      { kind: "RemoveEntity", compat: "Breaking" },
    ]);
  });

  test("renaming an entity is cosmetic; changing its kind or context is breaking", () => {
    const base = order(total);
    expect(
      diff(m(base), m({ ...base, name: "PurchaseOrder" })).operations,
    ).toMatchObject([
      { kind: "RenameEntity", compat: "Cosmetic", to: "PurchaseOrder" },
    ]);
    expect(
      diff(m(base), m({ ...base, kind: "AggregateRoot" })).operations,
    ).toMatchObject([
      { kind: "ChangeEntityKind", compat: "Breaking", to: "AggregateRoot" },
    ]);
  });
});

describe("invariants", () => {
  const withRules = (...invariants: string[]): DomainEntity => ({
    ...order(total),
    invariants,
  });

  test("adding an invariant is breaking, dropping one is additive", () => {
    expect(
      diff(m(withRules()), m(withRules("total >= 0"))).operations,
    ).toMatchObject([
      { kind: "AddInvariant", compat: "Breaking", text: "total >= 0" },
    ]);
    expect(
      diff(m(withRules("total >= 0")), m(withRules())).operations,
    ).toMatchObject([{ kind: "RemoveInvariant", compat: "Additive" }]);
  });
});

test("summarize counts operations by compatibility", () => {
  const before = m(order(total));
  const after = m(
    { ...order(total), name: "PurchaseOrder" },
    { id: "x", name: "Extra", kind: "ValueObject", context: "c", fields: [] },
  );

  expect(summarize(diff(before, after))).toEqual({
    Additive: 1,
    Breaking: 0,
    Cosmetic: 1,
  });
});
