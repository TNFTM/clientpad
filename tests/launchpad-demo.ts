import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { LaunchpadDemo } from "../target/types/launchpad_demo";
const fs = require('fs');
const assert = require('assert');
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction, Signer,
} from "@solana/web3.js";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from '@solana/spl-token';
const utils = require('./utils');

const token_vaulter = anchor.web3.Keypair.generate();
const usdc_vaulter = anchor.web3.Keypair.generate();
const sol_vaulter = anchor.web3.Keypair.generate();
const user1 = anchor.web3.Keypair.generate();
const one = 1_000_000_000;

let mintKeyTKN;
let mintObjectTKN;
let mintPubkeyTKN;
let token_vaulter_acc;
let vaulter_usdc_acc;

let mintKeyUSDC;
let mintObjectUSDC;
let mintPubkeyUSDC;

let user1_tkn_acc;
let user1_usdc_acc;

const idoName = 'pool1';

const amount_TKN = 1000_000_000_000;
const amount_USDC = 100_000_000;

describe("launchpad-demo", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.LaunchpadDemo as Program<LaunchpadDemo>;

  let provider = anchor.AnchorProvider.env();
  console.log('program.programId', program.programId.toBase58());

  it('Prepare', async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(token_vaulter.publicKey, 10_000_000_000), // 10 sol
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, 10_000_000_000), // 10 sol
      "confirmed"
    );

    let rawdata = fs.readFileSync(
      'tests/keys/step-teST1ieLrLdr4MJPZ7i8mgSCLQ7rTrPRjNnyFdHFaz9.json'
    );
    let keyData = JSON.parse(rawdata);
    mintKeyTKN = anchor.web3.Keypair.fromSecretKey(new Uint8Array(keyData));
    mintObjectTKN = await utils.createMint(
      mintKeyTKN,
      provider,
      provider.wallet.publicKey,
      null,
      9,
      TOKEN_PROGRAM_ID
    );
    mintPubkeyTKN = mintObjectTKN.publicKey;

    let usdc_rawdata = fs.readFileSync(
      'tests/keys/xstep-TestZ4qmw6fCo1uK9oJbobWDgj1sME6hR1ssWQnyjxM.json'
    );
    let usdcKeyData = JSON.parse(usdc_rawdata);
    mintKeyUSDC = anchor.web3.Keypair.fromSecretKey(new Uint8Array(usdcKeyData));
    mintObjectUSDC = await utils.createMint(
      mintKeyUSDC,
      provider,
      provider.wallet.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID
    );
    mintPubkeyUSDC = mintObjectUSDC.publicKey;

    token_vaulter_acc = await mintObjectTKN.createAssociatedTokenAccount(token_vaulter.publicKey);
    await utils.mintToAccount(
      provider,
      mintPubkeyTKN,
      token_vaulter_acc,
      amount_TKN
    );
    const vaulter_amount = await getTokenBalance(token_vaulter_acc);
    assert.equal(vaulter_amount, amount_TKN)

    vaulter_usdc_acc = await mintObjectUSDC.createAssociatedTokenAccount(token_vaulter.publicKey);
    user1_tkn_acc = await mintObjectTKN.createAssociatedTokenAccount(user1.publicKey);
    user1_usdc_acc = await mintObjectUSDC.createAssociatedTokenAccount(user1.publicKey);

    await utils.mintToAccount(
      provider,
      mintPubkeyUSDC,
      user1_usdc_acc,
      amount_USDC
    );

    const user1_usdc_amount = await getTokenBalance(user1_usdc_acc);
    assert.equal(user1_usdc_amount, amount_USDC)

  });

  it("Is initialized!", async () => {
    const [ido_account_key, ido_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(idoName)],
      program.programId
    );

    let bumps = {
      idoAccount: ido_account_bump
    };
    const tx = await program.methods.initialize(
        idoName,
        bumps,
        token_vaulter.publicKey,
        usdc_vaulter.publicKey,
        sol_vaulter.publicKey,
        new anchor.BN(10),
        new anchor.BN(20),
      )
      .accounts({
        idoAuthority: provider.wallet.publicKey,
        idoAccount: ido_account_key,
        usdcMint: mintKeyUSDC.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });
});

async function getTokenBalance(pubkey) {
  return parseInt(
    (await anchor.getProvider().connection.getTokenAccountBalance(pubkey)).value.amount
  );
}
