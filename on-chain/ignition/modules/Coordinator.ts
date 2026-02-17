import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HumVerifier", (m) => {
  const hum = m.contract("Coordinator.sol");
  return { hum };
});