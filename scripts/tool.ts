import {clusterApiUrl, Connection, Keypair, PublicKey, Signer} from "@solana/web3.js";
import {ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID, u64} from "@solana/spl-token";
import { program } from 'commander';
import fs from "fs";
import {AnchorProvider, Program} from '@project-serum/anchor';
import {getAssocTokenAddress, loadWalletKey, toPublicKey} from "./solana";
import { IDL, LaunchpadDemo } from '../target/types/launchpad_demo';
import * as anchor from "@project-serum/anchor";

program.version('0.0.1');

const LAUNCHPAD_PROGRAM_ID = 'n7g1A1RFUJNSUdfvgWE7dqf7G9QoBbBguTZdUM94HdL';

const USDC_TOKEN_ADDRESS_DEV = 'AjKhs96eeQaif33HM9EkJSu8xzShbEW6VAGksBiP5qBH'; // Test USDC
const USDC_TOKEN_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

program
  .command('approve')
  .requiredOption('-k, --keypair <path>', `Solana wallet location`)
  .option(
    '-e, --env <string>',
    'Solana cluster env name. One of: mainnet-beta, testnet, devnet',
    'mainnet-beta',
  )
  .requiredOption('-t --token <string>', 'Government Token address')
  .requiredOption('-d --distributor <string>', 'Distributor address')
  .requiredOption('-a --amount <string>', 'Delegate amount e.g.) 20_000 for 20,000 SHARDS')
  .action(async (_directory: any, cmd: any) => {
    const {
      keypair,
      env,
      token,
      distributor,
      amount: approveAmount,
    } = cmd.opts();
    // const accountService = loadWalletKey(keypair);
    // if (!accountService.publicKey.equals(SERVICE_ACCOUNT)) {
    //   throw new Error('Keypair is invalid for service!');
    // }

    let amount = approveAmount.replace(/_/g, '');

    const isDev = env != 'mainnet-beta';
    const serviceKeypair = loadWalletKey(keypair);
    const provideOptions = AnchorProvider.defaultOptions();
    const connection = new Connection(
      clusterApiUrl(env),
      provideOptions.commitment,
    );
    console.log(`Token Address: <${token}>, Amount: ${amount}`);


    const mintPubkeyGOV = new PublicKey(token);
    let mint = new Token(
      connection,
      mintPubkeyGOV,
      TOKEN_PROGRAM_ID,
      serviceKeypair as Signer,
    );

    const tokenVaulterAcc = await getAssocTokenAddress(
      mintPubkeyGOV,
      serviceKeypair.publicKey,
    );

    let uAmount: u64 = new u64(
      new u64(amount).mul(new u64(1_000_000_000)).toString(),
    );

    const delegateKey = toPublicKey(distributor.trim());

    console.log('Service Token account', tokenVaulterAcc.toString());
    console.log('Delegate amount', amount);
    console.log('Delegate address', delegateKey.toString());
    try {
      await mint.approve(
        tokenVaulterAcc,
        delegateKey,
        serviceKeypair as Signer,
        [],
        uAmount,
      );
      console.log('success');
    } catch (e) {
      console.log('error', e);
    }
  });

program
  .command('create-pool')
  .requiredOption('-k, --keypair <path>', `Solana wallet location`)
  .option(
    '-e, --env <string>',
    'Solana cluster env name. One of: mainnet-beta, testnet, devnet',
    'mainnet-beta',
  )
  .requiredOption('-n --name <string>', 'IDO pool name')
  .requiredOption('--price_in_sol <number>', '1 Token price in SOL')
  .requiredOption('--price_in_usdc <number>', '1 Token price in USDC')
  .requiredOption('-t --token <string>', 'Government Token address')
  .action(async (_directory: any, cmd: any) => {
    const {
      keypair,
      env,
      name,
      token,
      price_in_sol,
      price_in_usdc
    } = cmd.opts();

    const serviceKeypair = loadWalletKey(keypair);
    const provideOptions = AnchorProvider.defaultOptions();
    const connection = new Connection(
      clusterApiUrl(env),
      provideOptions.commitment,
    );

    const walletWrapper = new anchor.Wallet(serviceKeypair);
    const provider = new AnchorProvider(connection, walletWrapper, {
      preflightCommitment: 'recent',
    });
    const programId = new PublicKey(LAUNCHPAD_PROGRAM_ID);
    const program = new Program<LaunchpadDemo>(
      IDL,
      programId,
      provider,
    );

    const idoName = name.trim();
    const [idoAccountKey, idoAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from(idoName)],
      program.programId
    );

    let bumps = {
      idoAccount: idoAccountBump
    };

    const isDev = env != 'mainnet-beta';
    const mintKeyUSDC = new PublicKey(isDev? USDC_TOKEN_ADDRESS_DEV:USDC_TOKEN_ADDRESS);
    const mintKeyGOV = new PublicKey(token);
    const tokenVaulter = serviceKeypair.publicKey;
    let priceInSol = price_in_sol.replace(/_/g, '');
    let priceInUsdc = price_in_usdc.replace(/_/g, '');

    const tx = await program.methods
      .initialize(
        idoName,
        bumps,
        tokenVaulter,
        tokenVaulter,
        tokenVaulter,
        new anchor.BN(priceInSol),
        new anchor.BN(priceInUsdc),
      )
      .accounts({
        idoAuthority: provider.wallet.publicKey,
        idoAccount: idoAccountKey,
        govMint: mintKeyGOV,
        usdcMint: mintKeyUSDC,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log(`Tx: ${tx}`);
    console.log(`Token Distributor: ${idoAccountKey.toString()}`);
  });

program.parse(process.argv);