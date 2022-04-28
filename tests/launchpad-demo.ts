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
const E9 = 1_000_000_000;
const E6 = 1_000_000;

const gov_token = anchor.web3.Keypair.generate();
const usdc_token = anchor.web3.Keypair.generate();

let mintKeyGOV;
let mintObjectGOV;
let mintPubkeyGOV;
let token_vaulter_acc;
let vaulter_usdc_acc;

let mintKeyUSDC;
let mintObjectUSDC;
let mintPubkeyUSDC;

let user1_tkn_acc;
let user1_usdc_acc;

const idoName = 'pool1';

const amount_GOV = 1000_000_000_000;
const amount_USDC = 1000_000_000;

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

    mintKeyGOV = gov_token;
    mintObjectGOV = await utils.createMint(
      mintKeyGOV,
      provider,
      provider.wallet.publicKey,
      null,
      9,
      TOKEN_PROGRAM_ID
    );
    mintPubkeyGOV = mintObjectGOV.publicKey;

    mintKeyUSDC = usdc_token;
    mintObjectUSDC = await utils.createMint(
      mintKeyUSDC,
      provider,
      provider.wallet.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID
    );
    mintPubkeyUSDC = mintObjectUSDC.publicKey;

    token_vaulter_acc = await mintObjectGOV.createAssociatedTokenAccount(token_vaulter.publicKey);
    await utils.mintToAccount(
      provider,
      mintPubkeyGOV,
      token_vaulter_acc,
      amount_GOV
    );
    const vaulter_amount = await getTokenBalance(token_vaulter_acc);
    assert.equal(vaulter_amount, amount_GOV)

    vaulter_usdc_acc = await mintObjectUSDC.createAssociatedTokenAccount(usdc_vaulter.publicKey);
    user1_tkn_acc = await mintObjectGOV.createAssociatedTokenAccount(user1.publicKey);
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

  const approve = async (amount: number, distributor: PublicKey) => {
    let uAmount: u64 = new u64(
      new u64(amount).mul(new u64(1_000_000_000)).toString(),
    );

    await mintObjectGOV.approve(
      token_vaulter_acc,
      distributor,
      token_vaulter as Signer,
      [],
      uAmount,
    );
  }

  const old_price_in_sol = 5_000_000;
  const old_price_in_usdc = 100_000;
  const price_in_sol = 10_000_000;
  const price_in_usdc = 200_000;

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
        new anchor.BN(old_price_in_sol), // 0.01 SOL per 1 token
        new anchor.BN(old_price_in_usdc), // 0.2 USDC per 1 token
      )
      .accounts({
        idoAuthority: provider.wallet.publicKey,
        idoAccount: ido_account_key,
        govMint: mintKeyGOV.publicKey,
        usdcMint: mintKeyUSDC.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const tx2 = await program.methods.updatePool(
      token_vaulter.publicKey,
      usdc_vaulter.publicKey,
      sol_vaulter.publicKey,
      new anchor.BN(price_in_sol), // 0.01 SOL per 1 token
      new anchor.BN(price_in_usdc), // 0.2 USDC per 1 token
    )
      .accounts({
        idoAuthority: provider.wallet.publicKey,
        idoAccount: ido_account_key,
        govMint: mintKeyGOV.publicKey,
        usdcMint: mintKeyUSDC.publicKey,
      })
      .rpc();

    await approve(1000, ido_account_key);
    console.log("Your transaction signature", tx2);
  });

  it("Exchange Usdc", async () => {
    const [ido_account_key, ido_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(idoName)],
      program.programId
    );

    const before_user1_usdc_amount = await getTokenBalance(user1_usdc_acc);

    const token_amount = 100;
    const tx = await program.methods.exchangeUsdc(
      getBnTokenAmount(token_amount),
    )
      .accounts({
        userAuthority: user1.publicKey,
        userUsdc: user1_usdc_acc,
        idoAccount: ido_account_key,
        usdcMint: mintKeyUSDC.publicKey,
        usdcVaultAccount: vaulter_usdc_acc,
        tokenMint: mintKeyGOV.publicKey,
        tokenFrom: token_vaulter_acc,
        userTokenAccount: user1_tkn_acc,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user1])
      .rpc();

    const after_user1_usdc_amount = await getTokenBalance(user1_usdc_acc);
    const vaulter_usdc_amount = await getTokenBalance(vaulter_usdc_acc);

    assert.equal(before_user1_usdc_amount - after_user1_usdc_amount, token_amount * price_in_usdc);
    console.log(vaulter_usdc_amount);

    const user1_tkn_amount = await getTokenBalance(user1_tkn_acc);
    assert.equal(user1_tkn_amount, token_amount * E9);

    console.log("Your transaction signature", tx);
  });

  it("Exchange Sol", async () => {
    const [ido_account_key, ido_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(idoName)],
      program.programId
    );

    const token_amount = 300;

    const before_user1_tkn_amount = await getTokenBalance(user1_tkn_acc);

    const tx = await program.methods.exchangeSol(
      getBnTokenAmount(token_amount),
    )
      .accounts({
        userAuthority: user1.publicKey,
        idoAccount: ido_account_key,
        solVault: sol_vaulter.publicKey,
        tokenMint: mintKeyGOV.publicKey,
        tokenFrom: token_vaulter_acc,
        userTokenAccount: user1_tkn_acc,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user1])
      .rpc();

    const new_user1_tkn_amount = await getTokenBalance(user1_tkn_acc);
    assert.equal(new_user1_tkn_amount - before_user1_tkn_amount, token_amount * E9);

    const solAmount = await getSolanaBalance(sol_vaulter.publicKey);
    assert.equal(solAmount, token_amount * price_in_sol);
    console.log(solAmount);

    console.log("Your transaction signature", tx);
  });
});

async function getSolanaBalance(pubkey) {
  return await anchor.getProvider().connection.getBalance(pubkey);
}

async function getTokenBalance(pubkey) {
  return parseInt(
    (await anchor.getProvider().connection.getTokenAccountBalance(pubkey)).value.amount
  );
}

function getBnTokenAmount(tokenAmount: number) {
  return new anchor.BN(tokenAmount).mul(new anchor.BN(1_000_000_000));
}

function getBnUSDCAmount(tokenAmount: number) {
  return new anchor.BN(tokenAmount).mul(new anchor.BN(1_000_000));
}