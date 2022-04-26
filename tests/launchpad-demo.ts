import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { LaunchpadDemo } from "../target/types/launchpad_demo";

describe("launchpad-demo", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.LaunchpadDemo as Program<LaunchpadDemo>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
