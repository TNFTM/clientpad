use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::{
        invoke,
    },
    system_instruction::{
        transfer,
    },
    sysvar::{
        rent::Rent
    },
};

use std::ops::Deref;

use anchor_spl::{
    token::{self, Mint, Token, TokenAccount},
};
use std::convert::TryInto;

pub mod constants {
    pub const VAULT_PDA_SEED: &[u8] = b"vault";
    pub const LAUNCHPAD_PDA_SEED: &[u8] = b"launchpad";
}

declare_id!("n7g1A1RFUJNSUdfvgWE7dqf7G9QoBbBguTZdUM94HdL");

#[cfg(not(feature = "local-testing"))]
pub mod token_constants {
    pub const TKN_TOKEN_MINT_PUBKEY: &str = "teST1ieLrLdr4MJPZ7i8mgSCLQ7rTrPRjNnyFdHFaz9";
    // pub const TKN_TOKEN_MINT_PUBKEY: &str = "teST1ieLrLdr4MJPZ7i8mgSCLQ7rTrPRjNnyFdHFaz9";
}

#[cfg(feature = "local-testing")]
pub mod token_constants {
    pub const TKN_TOKEN_MINT_PUBKEY: &str = "teST1ieLrLdr4MJPZ7i8mgSCLQ7rTrPRjNnyFdHFaz9";
}

const USDC_DECIMALS: u8 = 6;
const SOL_DECIMALS: u8 = 9;

#[program]
pub mod launchpad_demo {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        ido_name: String,
        _bumps: PoolBumps,
        tkn_vault: Pubkey,
        usdc_vault: Pubkey,
        sol_vault: Pubkey,
        sol_amount_for_token: u64,
        usdc_amount_for_token: u64,
    ) -> Result<()> {
        msg!("INITIALIZE {}", ido_name);
        let ido_account = &mut ctx.accounts.ido_account;
        let name_bytes = ido_name.as_bytes();
        let mut name_data = [b' '; 10];
        name_data[..name_bytes.len()].copy_from_slice(name_bytes);
        ido_account.ido_name = name_data;

        ido_account.bumps = PoolBumps {
            ido_account: *ctx.bumps.get("ido_account").unwrap(),
        };
        ido_account.ido_authority = ctx.accounts.ido_authority.key();
        ido_account.tkn_vault = tkn_vault;
        ido_account.usdc_mint = ctx.accounts.usdc_mint.key();
        ido_account.usdc_vault = usdc_vault;
        ido_account.sol_vault = sol_vault;

        ido_account.usdc_amount_for_token = usdc_amount_for_token;
        ido_account.sol_amount_for_token = sol_amount_for_token;
        Ok(())
    }

    pub fn exchange_usdc(
        ctx: Context<ExchangeUsdc>,
        token_amount: u64,
    ) -> Result<()> {
        // todo fix usdc amount
        let usdc_amount: u64 = 100 * 1_000_000;

        let cpi_accounts = token::Transfer {
            from: ctx.accounts.user_usdc.to_account_info(),
            to: ctx.accounts.usdc_vault_account.to_account_info(),
            authority: ctx.accounts.user_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, usdc_amount)?;

        // transfer TKN token
        let ido_name = ctx.accounts.ido_account.ido_name.as_ref();
        let seeds = &[
            ido_name.trim_ascii_whitespace(),
            &[ctx.accounts.ido_account.bumps.ido_account],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_from.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.ido_account.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, token_amount)?;

        Ok(())
    }


    pub fn exchange_sol(
        ctx: Context<ExchangeSol>,
        token_amount: u64,
    ) -> Result<()> {
        // todo fix sol amount
        let sol_amount: u64 = 2 * 1_000_000_000;

        invoke(
            &transfer(
                ctx.accounts.user_authority.to_account_info().key,
                ctx.accounts.sol_vault.key,
                sol_amount,
            ),
            &[
                ctx.accounts.user_authority.to_account_info(),
                ctx.accounts.sol_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // transfer TKN token
        let ido_name = ctx.accounts.ido_account.ido_name.as_ref();
        let seeds = &[
            ido_name.trim_ascii_whitespace(),
            &[ctx.accounts.ido_account.bumps.ido_account],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_from.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.ido_account.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, token_amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(ido_name: String, bumps: PoolBumps)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub ido_authority: Signer<'info>,
    #[account(init,
    seeds = [ido_name.as_bytes()],
    bump,
    payer = ido_authority,
    space = IdoAccount::LEN + 8
    )]
    pub ido_account: Box<Account<'info, IdoAccount>>,

    #[account(constraint = usdc_mint.decimals == USDC_DECIMALS)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ExchangeUsdc<'info> {
    #[account(mut)]
    pub user_authority: Signer<'info>,

    #[account(mut,
    constraint = user_usdc.owner == user_authority.key(),
    constraint = user_usdc.mint == usdc_mint.key())]
    pub user_usdc: Box<Account<'info, TokenAccount>>,

    #[account(seeds = [ido_account.ido_name.as_ref().trim_ascii_whitespace()],
    bump = ido_account.bumps.ido_account,
    has_one = usdc_mint)]
    pub ido_account: Box<Account<'info, IdoAccount>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = usdc_vault_account.owner == ido_account.usdc_vault,
    )]
    pub usdc_vault_account: Box<Account<'info, TokenAccount>>,

    #[account(
    address = token_constants::TKN_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
    )]
    pub token_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = token_from.owner == ido_account.tkn_vault,
    constraint = token_from.mint == token_mint.key()
    )]
    pub token_from: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = user_token_account.owner == user_authority.key(),
    constraint = user_token_account.mint == token_mint.key()
    )]
    //the token account to send token
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ExchangeSol<'info> {
    #[account(mut)]
    pub user_authority: Signer<'info>,

    #[account(seeds = [ido_account.ido_name.as_ref().trim_ascii_whitespace()],
    bump = ido_account.bumps.ido_account,
    has_one = sol_vault
    )]
    pub ido_account: Box<Account<'info, IdoAccount>>,

    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub sol_vault: UncheckedAccount<'info>,

    #[account(
    address = token_constants::TKN_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
    )]
    pub token_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = token_from.owner == ido_account.tkn_vault,
    constraint = token_from.mint == token_mint.key()
    )]
    pub token_from: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = user_token_account.owner == user_authority.key(),
    constraint = user_token_account.mint == token_mint.key()
    )]
    //the token account to send token
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct IdoAccount {
    pub ido_name: [u8; 10], // Setting an arbitrary max of ten characters in the ido name. // 10
    pub bumps: PoolBumps,   // 1

    pub ido_authority: Pubkey, // 32
    pub tkn_vault: Pubkey,      // 32

    pub usdc_mint: Pubkey,       // 32
    pub usdc_vault: Pubkey,       // 32
    pub sol_vault: Pubkey,       // 32

    pub amount_usdc: u64, // 8
    pub amount_sol: u64, // 8
    pub usdc_amount_for_token: u64, // 8
    pub sol_amount_for_token: u64,  // 8
}

impl IdoAccount {
    pub const LEN: usize = 10 + 1 + 32 + 32 + 3 * 32 + 8 + 8 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Clone)]
pub struct PoolBumps {
    pub ido_account: u8, // 1
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid request")]
    InvalidRequest,
    #[msg("Insufficient USDC")]
    LowUsdc,
}

/// Trait to allow trimming ascii whitespace from a &[u8].
pub trait TrimAsciiWhitespace {
    /// Trim ascii whitespace (based on `is_ascii_whitespace()`) from the
    /// start and end of a slice.
    fn trim_ascii_whitespace(&self) -> &[u8];
}

impl<T: Deref<Target = [u8]>> TrimAsciiWhitespace for T {
    fn trim_ascii_whitespace(&self) -> &[u8] {
        let from = match self.iter().position(|x| !x.is_ascii_whitespace()) {
            Some(i) => i,
            None => return &self[0..0],
        };
        let to = self.iter().rposition(|x| !x.is_ascii_whitespace()).unwrap();
        &self[from..=to]
    }
}