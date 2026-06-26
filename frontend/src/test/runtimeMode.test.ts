import { expect, it } from "vitest";

import { managesLocalAccounts, runtimeTopology } from "../features/runtimeMode/runtimeMode";

it("classifies controller as the account-owning gateway", () => {
  const topology = runtimeTopology("controller", null);

  expect(topology).toBe("controller");
  expect(managesLocalAccounts(topology)).toBe(true);
});

it("classifies agent without controller url as standalone account owner", () => {
  const topology = runtimeTopology("agent", null);

  expect(topology).toBe("standalone_agent");
  expect(managesLocalAccounts(topology)).toBe(true);
});

it("classifies agent with controller url as node agent without local user accounts", () => {
  const topology = runtimeTopology("agent", "http://controller.local:9137");

  expect(topology).toBe("node_agent");
  expect(managesLocalAccounts(topology)).toBe(false);
});
