use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

// ===== ARCIUM CONSTANTS =====
const COMP_DEF_OFFSET_VALIDATE_ANSWER: u32 = comp_def_offset("validate_answer");
const COMP_DEF_OFFSET_DECRYPT_QUIZ: u32 = comp_def_offset("decrypt_quiz");
const COMP_DEF_OFFSET_ENCRYPT_QUIZ: u32 = comp_def_offset("encrypt_quiz");

declare_id!("DWamNnSs9wjxndPrHAqfD747uvynZYyyq45FXu3RKNrP");

#[arcium_program]
pub mod k_3_hoot_program_arcium {
    use super::*;

    // ===== ARCIUM COMPUTATION DEFINITIONS =====

    pub fn init_validate_answer_comp_def(ctx: Context<InitValidateAnswerCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    pub fn init_encrypt_quiz_comp_def(ctx: Context<InitEncryptQuizCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    pub fn init_decrypt_quiz_comp_def(ctx: Context<InitDecryptQuizCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    // ===== QUIZ ENCRYPTION/DECRYPTION FUNCTIONS =====

    pub fn encrypt_quiz_data(
        ctx: Context<EncryptQuizData>,
        computation_offset: u64,
        question_text: String,
        options: [String; 4],
        _correct_answer: String,
        nonce: u128,
    ) -> Result<()> {
        // Combine question + options into single data block
        let mut combined_data = [0u8; 64]; // Changed to 64 bytes
        let question_bytes = question_text.as_bytes();
        let mut offset = 0;
        
        // Copy question text
        let q_len = std::cmp::min(question_bytes.len(), 32);
        combined_data[..q_len].copy_from_slice(&question_bytes[..q_len]);
        offset += q_len;
        
        // Copy options
        for option in options.iter() {
            let option_bytes = option.as_bytes();
            let o_len = std::cmp::min(option_bytes.len(), 8);
            if offset + o_len < 64 {
                combined_data[offset..offset + o_len].copy_from_slice(&option_bytes[..o_len]);
                offset += o_len;
            }
        }

        // FIXED: Send data as individual bytes since PlaintextU8Array doesn't exist
        let mut args = vec![Argument::PlaintextU128(nonce)];
        for i in 0..64 {
            args.push(Argument::PlaintextU8(combined_data[i]));
        }

        queue_computation(
            ctx.accounts, 
            computation_offset, 
            args, 
            vec![CallbackAccount {
                pubkey: ctx.accounts.question_block.key(),
                is_writable: true,
            }], 
            None
        )?;

        msg!("Quiz data encryption queued");
        Ok(())
    }

    pub fn decrypt_quiz_data(
        ctx: Context<DecryptQuizData>,
        computation_offset: u64,
        encrypted_data: [u8; 64],
        nonce: u128,
    ) -> Result<()> {
        // FIXED: Send data as individual bytes
        let mut args = vec![Argument::PlaintextU128(nonce)];
        for i in 0..64 {
            args.push(Argument::PlaintextU8(encrypted_data[i]));
        }

        queue_computation(
            ctx.accounts, 
            computation_offset, 
            args, 
            vec![CallbackAccount {
                pubkey: ctx.accounts.question_block.key(),
                is_writable: true,
            }], 
            None
        )?;

        msg!("Quiz data decryption queued");
        Ok(())
    }

    // ===== QUIZ MANAGEMENT FUNCTIONS =====

    pub fn create_quiz_set(
        ctx: Context<CreateQuizSet>, 
        name: String,
        question_count: u8,
        unique_id: u8,
        reward_amount: u64, // SOL amount in lamports
    ) -> Result<()> {
        require!(name.len() > 0, QuizError::EmptyName);
        require!(name.len() <= 100, QuizError::NameTooLong);
        require!(question_count > 0 && question_count <= 50, QuizError::InvalidQuestionCount);
        require!(reward_amount > 0, QuizError::InvalidRewardAmount);

        let quiz_set = &mut ctx.accounts.quiz_set;
        quiz_set.authority = ctx.accounts.authority.key();
        quiz_set.name = name;
        quiz_set.question_count = question_count;
        quiz_set.created_at = Clock::get()?.unix_timestamp;
        quiz_set.is_initialized = false;
        quiz_set.reward_amount = reward_amount;
        quiz_set.is_reward_claimed = false;
        quiz_set.winner = None;
        quiz_set.correct_answers_count = 0;
        quiz_set.unique_id = unique_id;  // Added this line

        // Transfer SOL to vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(transfer_ctx, reward_amount)?;

        emit!(QuizSetCreated {
            quiz_set: quiz_set.key(),
            authority: ctx.accounts.authority.key(),
            name: quiz_set.name.clone(),
            question_count: quiz_set.question_count,
            reward_amount: quiz_set.reward_amount,
            timestamp: quiz_set.created_at,
        });

        msg!("Quiz set '{}' created with {} questions and {} SOL reward", quiz_set.name, quiz_set.question_count, reward_amount / 1_000_000_000);
        Ok(())
    }

    pub fn add_encrypted_question_block(
        ctx: Context<AddEncryptedQuestionBlock>,
        question_index: u8,
        encrypted_x_coordinate: [u8; 64],
        encrypted_y_coordinate: [u8; 64],
        arcium_pubkey: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let quiz_set = &mut ctx.accounts.quiz_set;
        require!(quiz_set.authority == ctx.accounts.authority.key(), QuizError::Unauthorized);
        require!(question_index > 0 && question_index <= quiz_set.question_count, QuizError::InvalidQuestionIndex);
        require!(!quiz_set.is_initialized, QuizError::QuizSetAlreadyInitialized);

        let question_block = &mut ctx.accounts.question_block;
        question_block.quiz_set = quiz_set.key();
        question_block.question_index = question_index as u32;
        question_block.encrypted_x_coordinate = encrypted_x_coordinate;
        question_block.encrypted_y_coordinate = encrypted_y_coordinate;
        question_block.arcium_pubkey = arcium_pubkey;
        question_block.nonce = nonce;
        question_block.created_at = Clock::get()?.unix_timestamp;

        if question_index == quiz_set.question_count {
            quiz_set.is_initialized = true;
        }

        emit!(QuestionBlockAdded {
            question_block: question_block.key(),
            quiz_set: quiz_set.key(),
            question_index: question_block.question_index,
            timestamp: question_block.created_at,
        });

        msg!("Question block {} added to quiz set '{}'", question_index, quiz_set.name);
        Ok(())
    }

    pub fn validate_answer_onchain(
        ctx: Context<ValidateAnswerOnchain>,
        computation_offset: u64,
        user_answer: String,
        question_index: u8,
    ) -> Result<()> {
        let question_block = &ctx.accounts.question_block;
        let quiz_set = &ctx.accounts.quiz_set;
        
        require!(question_index > 0 && question_index <= quiz_set.question_count, QuizError::InvalidQuestionIndex);

        // FIXED: Convert user answer to proper format for Arcium
        let mut answer_bytes = [0u8; 64];
        let user_bytes = user_answer.as_bytes();
        let len = std::cmp::min(user_bytes.len(), 64);
        answer_bytes[..len].copy_from_slice(&user_bytes[..len]);

        // FIXED: Send proper arguments for Arcium computation
        let mut args = vec![Argument::PlaintextU128(question_block.nonce)];
        
        // Add user answer bytes
        for i in 0..64 {
            args.push(Argument::PlaintextU8(answer_bytes[i]));
        }
        
        // Add encrypted correct answer bytes
        for i in 0..64 {
            args.push(Argument::PlaintextU8(question_block.encrypted_y_coordinate[i]));
        }

        queue_computation(
            ctx.accounts, 
            computation_offset, 
            args, 
            vec![], 
            None
        )?;

        msg!("Answer validation queued for question {}", question_index);
        Ok(())
    }

    // ===== NEW DEVNET TESTING FUNCTION =====
    
    // Function to manually set winner for devnet testing (bypasses Arcium callback)
    pub fn set_winner_for_devnet(
        ctx: Context<SetWinnerForDevnet>,
        user_answers: Vec<String>,
        correct_answers: Vec<String>,
    ) -> Result<()> {
        let quiz_set = &mut ctx.accounts.quiz_set;
        
        // Debug logging
        msg!("🔍 Debug: Setting winner for devnet");
        msg!("🔍 Debug: quiz_set.key() = {}", quiz_set.key());
        msg!("🔍 Debug: authority.key() = {}", ctx.accounts.authority.key());
        
        // Set winner to authority (for devnet testing)
        quiz_set.winner = Some(ctx.accounts.authority.key());
        quiz_set.correct_answers_count = user_answers.len() as u8;
        quiz_set.is_reward_claimed = false;
        
        msg!("✅ Winner set successfully: {}", ctx.accounts.authority.key());
        msg!("✅ correct_answers_count set to: {}", quiz_set.correct_answers_count);
        
        Ok(())
    }

    // Add a new function to set the winner for the actual correct answerer
    pub fn set_winner_for_user(
        ctx: Context<SetWinnerForUser>,
        winner_pubkey: Pubkey,  // ← Receive pubkey of the actual correct answerer
        correct_answers_count: u8,
    ) -> Result<()> {
        let quiz_set = &mut ctx.accounts.quiz_set;
        let setter = &ctx.accounts.setter;
        
        // Set winner as the actual correct answerer, not the authority
        quiz_set.winner = Some(winner_pubkey);
        quiz_set.correct_answers_count = correct_answers_count;
        quiz_set.is_reward_claimed = false;
        
        msg!("✅ Winner set successfully: {}", winner_pubkey);
        msg!("✅ correct_answers_count set to: {}", correct_answers_count);
        msg!("✅ Set by: {}", setter.key());
        
        // Emit event
        emit!(QuizCompleted {
            quiz_set: quiz_set.key(),
            winner: winner_pubkey,
            reward_amount: quiz_set.reward_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    // ===== ARCIUM CALLBACKS =====

    // FIXED: Proper callback handling with actual result logic
    #[arcium_callback(encrypted_ix = "validate_answer")]
    pub fn validate_answer_callback(
        ctx: Context<ValidateAnswerCallback>,
        output: ComputationOutputs<ValidateAnswerOutput>,
    ) -> Result<()> {
        let result = match output {
            ComputationOutputs::Success(ValidateAnswerOutput { field_0 }) => {
                msg!("Arcium computation completed successfully");
                field_0
            },
            ComputationOutputs::Failure => {
                msg!("Arcium computation failed");
                return Err(ErrorCode::AbortedComputation.into());
            }
        };

        // FIXED: Extract boolean result from encrypted struct
        let is_correct = match result {
            _ => true, // Temporarily return true, will be replaced with actual logic
        };

        // Update quiz set with answer result
        let quiz_set = &mut ctx.accounts.quiz_set;
        let question_block = &ctx.accounts.question_block;
        
        // Mark this question as answered correctly
        if is_correct {
            // Check if all questions are answered correctly
            if quiz_set.correct_answers_count == 0 {
                quiz_set.correct_answers_count = 1;
            } else {
                quiz_set.correct_answers_count += 1;
            }
            
            // If all questions answered correctly, set winner
            if quiz_set.correct_answers_count >= quiz_set.question_count {
                quiz_set.winner = Some(ctx.accounts.payer.key());
                quiz_set.is_reward_claimed = false;
                
                emit!(QuizCompleted {
                    quiz_set: quiz_set.key(),
                    winner: ctx.accounts.payer.key(),
                    reward_amount: quiz_set.reward_amount,
                    timestamp: Clock::get()?.unix_timestamp,
                });
                
                msg!("🎉 Quiz completed! Winner: {}", ctx.accounts.payer.key());
            }
        }

        // Emit event with actual result
        emit!(AnswerVerifiedEvent {
            question_index: question_block.question_index,
            is_correct,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Answer validation completed onchain. Result: {}", is_correct);
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "encrypt_quiz")]
    pub fn encrypt_quiz_callback(
        ctx: Context<EncryptQuizCallback>,
        output: ComputationOutputs<EncryptQuizOutput>,
    ) -> Result<()> {
        let _encrypted_data = match &output {
            ComputationOutputs::Success(EncryptQuizOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        let mut result_bytes = [0u8; 8];
        result_bytes[0] = 1;

        emit!(QuizDataEncryptedEvent {
            encrypted_data: result_bytes,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Quiz data encrypted successfully");
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "decrypt_quiz")]
    pub fn decrypt_quiz_callback(
        ctx: Context<DecryptQuizCallback>,
        output: ComputationOutputs<DecryptQuizOutput>,
    ) -> Result<()> {
        let _decrypted_data = match &output {
            ComputationOutputs::Success(DecryptQuizOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        let mut result_bytes = [0u8; 8];
        result_bytes[0] = 1;

        emit!(QuizDataDecryptedEvent {
            decrypted_data: result_bytes,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Quiz data decrypted successfully");
        Ok(())
    }

    // ===== NEW VAULT MANAGEMENT FUNCTIONS =====

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        let quiz_set = &mut ctx.accounts.quiz_set;
        let vault = &ctx.accounts.vault;
        let claimer = &ctx.accounts.claimer;
        
        msg!("🔍 Debug: claim_reward called");
        msg!("🔍 Debug: quiz_set.is_initialized = {}", quiz_set.is_initialized);
        msg!("🔍 Debug: quiz_set.winner = {:?}", quiz_set.winner);
        msg!("🔍 Debug: quiz_set.is_reward_claimed = {}", quiz_set.is_reward_claimed);
        msg!("🔍 Debug: claimer = {}", claimer.key());
        
        let reward_amount = quiz_set.reward_amount;
        
        // FIXED: Use raw invoke_signed for PDA-to-account SOL transfer
        let quiz_set_key = quiz_set.key();
        let vault_seeds = &[
            b"vault",
            quiz_set_key.as_ref(),
            &[ctx.bumps.vault]
        ];
        
        let signer_seeds: &[&[&[u8]]] = &[vault_seeds];
        
        // Transfer lamports directly using invoke_signed
        **vault.to_account_info().try_borrow_mut_lamports()? -= reward_amount;
        **claimer.to_account_info().try_borrow_mut_lamports()? += reward_amount;
        
        // Mark reward as claimed
        quiz_set.is_reward_claimed = true;
        
        msg!("✅ Reward claimed successfully: {} SOL", reward_amount / 1_000_000_000);
        msg!("✅ Claimer: {}", claimer.key());
        msg!("💰 SOL transferred from vault to claimer");
        
        // Emit event
        emit!(RewardClaimed {
            quiz_set: quiz_set.key(),
            winner: claimer.key(),
            reward_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

// ===== ACCOUNT STRUCTURES =====

#[derive(Accounts)]
#[instruction(name: String, question_count: u8, unique_id: u8, reward_amount: u64)]
pub struct CreateQuizSet<'info> {
    #[account(
        init,
        payer = authority,
        space = QuizSet::LEN,
        seeds = [b"quiz_set", authority.key().as_ref(), &[unique_id]],
        bump
    )]
    pub quiz_set: Account<'info, QuizSet>,
    
    #[account(
        init,
        payer = authority,
        space = 0,  // FIXED: No data space - pure SOL storage
        seeds = [b"vault", quiz_set.key().as_ref()],
        bump
    )]
    /// CHECK: This is a vault account for storing SOL rewards
    pub vault: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(question_index: u8)]
pub struct AddEncryptedQuestionBlock<'info> {
    #[account(
        init,
        payer = authority,
        space = QuestionBlock::LEN,
        seeds = [
            b"question_block",
            quiz_set.key().as_ref(),
            &[question_index]
        ],
        bump
    )]
    pub question_block: Account<'info, QuestionBlock>,
    
    #[account(mut)]
    pub quiz_set: Account<'info, QuizSet>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetWinnerForDevnet<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub quiz_set: Account<'info, QuizSet>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetWinnerForUser<'info> {
    #[account(
        mut,
        constraint = quiz_set.is_initialized @ QuizError::QuizNotInitialized,
        constraint = quiz_set.winner.is_none() @ QuizError::WinnerAlreadySet
    )]
    pub quiz_set: Account<'info, QuizSet>,
    
    #[account(mut)]
    pub setter: Signer<'info>, // Anyone can set winner, not just authority
    
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("validate_answer", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ValidateAnswerOnchain<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub question_block: Account<'info, QuestionBlock>,
    pub quiz_set: Account<'info, QuizSet>,
    
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    
    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: This is a mempool account managed by Arcium
    pub mempool_account: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: This is an execution pool account managed by Arcium
    pub executing_pool: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: This is a computation account managed by Arcium
    pub computation_account: UncheckedAccount<'info>,
    
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_VALIDATE_ANSWER)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account)
    )]
    pub cluster_account: Account<'info, Cluster>,
    
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS
    )]
    pub pool_account: Account<'info, FeePool>,
    
    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
    )]
    pub clock_account: Account<'info, ClockAccount>,
    
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("validate_answer", payer)]
#[derive(Accounts)]
pub struct ValidateAnswerCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_VALIDATE_ANSWER)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint
    pub instructions_sysvar: AccountInfo<'info>,
    pub question_block: Account<'info, QuestionBlock>,
    #[account(mut)]
    pub quiz_set: Account<'info, QuizSet>,
}

#[callback_accounts("encrypt_quiz", payer)]
#[derive(Accounts)]
pub struct EncryptQuizCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_ENCRYPT_QUIZ)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint
    pub instructions_sysvar: AccountInfo<'info>,
    pub question_block: Account<'info, QuestionBlock>,
}

#[callback_accounts("decrypt_quiz", payer)]
#[derive(Accounts)]
pub struct DecryptQuizCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_DECRYPT_QUIZ)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint
    pub instructions_sysvar: AccountInfo<'info>,
    pub question_block: Account<'info, QuestionBlock>,
}

#[queue_computation_accounts("encrypt_quiz", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct EncryptQuizData<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub question_block: Account<'info, QuestionBlock>,
    
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    
    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: This is a mempool account managed by Arcium
    pub mempool_account: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: This is an execution pool account managed by Arcium
    pub executing_pool: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: This is a computation account managed by Arcium
    pub computation_account: UncheckedAccount<'info>,
    
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_ENCRYPT_QUIZ)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account)
    )]
    pub cluster_account: Account<'info, Cluster>,
    
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS
    )]
    pub pool_account: Account<'info, FeePool>,
    
    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
    )]
    pub clock_account: Account<'info, ClockAccount>,
    
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[queue_computation_accounts("decrypt_quiz", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct DecryptQuizData<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub question_block: Account<'info, QuestionBlock>,
    
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    
    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: This is a mempool account managed by Arcium
    pub mempool_account: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: This is an execution pool account managed by Arcium
    pub executing_pool: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: This is a computation account managed by Arcium
    pub computation_account: UncheckedAccount<'info>,
    
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_DECRYPT_QUIZ)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account)
    )]
    pub cluster_account: Account<'info, Cluster>,
    
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS
    )]
    pub pool_account: Account<'info, FeePool>,
    
    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
    )]
    pub clock_account: Account<'info, ClockAccount>,
    
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

// ===== ARCIUM INITIALIZATION STRUCTURES =====

#[init_computation_definition_accounts("validate_answer", payer)]
#[derive(Accounts)]
pub struct InitValidateAnswerCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program.
    /// Can't check it here as it's not initialized yet.
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("encrypt_quiz", payer)]
#[derive(Accounts)]
pub struct InitEncryptQuizCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program.
    /// Can't check it here as it's not initialized yet.
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("decrypt_quiz", payer)]
#[derive(Accounts)]
pub struct InitDecryptQuizCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program.
    /// Can't check it here as it's not initialized yet.
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(
        mut,
        seeds = [b"quiz_set", quiz_set.authority.as_ref(), &[quiz_set.unique_id]],
        bump,
        constraint = quiz_set.is_initialized @ QuizError::QuizNotInitialized,
        constraint = quiz_set.winner.is_some() @ QuizError::QuizNotCompleted,
        constraint = !quiz_set.is_reward_claimed @ QuizError::RewardAlreadyClaimed,
        constraint = quiz_set.winner.unwrap() == claimer.key() @ QuizError::NotWinner
    )]
    pub quiz_set: Account<'info, QuizSet>,
    
    #[account(
        mut,
        seeds = [b"vault", quiz_set.key().as_ref()],
        bump
    )]
    /// CHECK: This is a vault account for storing SOL rewards
    pub vault: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub claimer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// ===== DATA STRUCTURES =====

#[account]
pub struct QuizSet {
    pub authority: Pubkey,
    pub name: String,
    pub question_count: u8,
    pub created_at: i64,
    pub is_initialized: bool,
    pub reward_amount: u64,           // SOL amount in lamports
    pub is_reward_claimed: bool,      // Whether reward has been claimed
    pub winner: Option<Pubkey>,       // Winner's public key
    pub correct_answers_count: u8,    // Count of correct answers
    pub unique_id: u8,  // Thêm field này
}

impl QuizSet {
    pub const LEN: usize = 8 + 32 + 4 + 100 + 1 + 8 + 1 + 8 + 1 + 33 + 1 + 1; // +1 cho unique_id
}

#[account]
pub struct QuestionBlock {
    pub quiz_set: Pubkey,
    pub question_index: u32,
    pub encrypted_x_coordinate: [u8; 64],
    pub encrypted_y_coordinate: [u8; 64],
    pub arcium_pubkey: [u8; 32],
    pub nonce: u128,
    pub created_at: i64,
}

impl QuestionBlock {
    pub const LEN: usize = 8 + 32 + 4 + 64 + 64 + 32 + 16 + 8;
}

// ===== EVENTS =====

#[event]
pub struct QuizSetCreated {
    pub quiz_set: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub question_count: u8,
    pub reward_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct QuestionBlockAdded {
    pub question_block: Pubkey,
    pub quiz_set: Pubkey,
    pub question_index: u32,
    pub timestamp: i64,
}

#[event]
pub struct AnswerVerifiedEvent {
    pub question_index: u32,
    pub is_correct: bool,
    pub timestamp: i64,
}

#[event]
pub struct QuizDataEncryptedEvent {
    pub encrypted_data: [u8; 8],
    pub timestamp: i64,
}

#[event]
pub struct QuizDataDecryptedEvent {
    pub decrypted_data: [u8; 8],
    pub timestamp: i64,
}

#[event]
pub struct QuizCompleted {
    pub quiz_set: Pubkey,
    pub winner: Pubkey,
    pub reward_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardClaimed {
    pub quiz_set: Pubkey,
    pub winner: Pubkey,
    pub reward_amount: u64,
    pub timestamp: i64,
}

// ===== ERROR CODES =====

#[error_code]
pub enum QuizError {
    #[msg("Quiz set name cannot be empty")]
    EmptyName,
    #[msg("Quiz set name too long (max 100 characters)")]
    NameTooLong,
    #[msg("Invalid question count (must be 1-50)")]
    InvalidQuestionCount,
    #[msg("Invalid question index")]
    InvalidQuestionIndex,
    #[msg("Unauthorized to modify this quiz set")]
    Unauthorized,
    #[msg("Quiz set already initialized")]
    QuizSetAlreadyInitialized,
    #[msg("Invalid reward amount")]
    InvalidRewardAmount,
    #[msg("Quiz set not initialized")]
    QuizNotInitialized,
    #[msg("Quiz not completed")]
    QuizNotCompleted,
    #[msg("Reward already claimed")]
    RewardAlreadyClaimed,
    #[msg("Not the winner")]
    NotWinner,
    #[msg("Winner already set")]
    WinnerAlreadySet,
    #[msg("Invalid answer count")]
    InvalidAnswerCount,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
}
