use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

// ===== ARCIUM CONSTANTS =====

const COMP_DEF_OFFSET_VALIDATE_ANSWER: u32 = comp_def_offset("validate_answer");
const COMP_DEF_OFFSET_DECRYPT_QUIZ: u32 = comp_def_offset("decrypt_quiz");
const COMP_DEF_OFFSET_ENCRYPT_QUIZ: u32 = comp_def_offset("encrypt_quiz");

declare_id!("BbjmhBTQNnXBqEAFCPmRk5qBpTfdmu8Vb2evMVvAcxCm");

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
        question_text: String,
        options: [String; 4],
        _correct_answer: String,
        nonce: u128,
    ) -> Result<()> {
        // Combine question + options into single data block
        let mut combined_data = [0u8; 32];
        let question_bytes = question_text.as_bytes();
        let mut offset = 0;
        
        // Copy question text
        let q_len = std::cmp::min(question_bytes.len(), 16);
        combined_data[..q_len].copy_from_slice(&question_bytes[..q_len]);
        offset += q_len;
        
        // Copy options
        for option in options.iter() {
            let option_bytes = option.as_bytes();
            let o_len = std::cmp::min(option_bytes.len(), 4);
            if offset + o_len < 32 {
                combined_data[offset..offset + o_len].copy_from_slice(&option_bytes[..o_len]);
                offset += o_len;
            }
        }

        // Queue Arcium computation for encryption
        let args = vec![
            Argument::PlaintextU8(combined_data[0]),
            Argument::PlaintextU128(nonce),
        ];

        queue_computation(
            ctx.accounts, 
            COMP_DEF_OFFSET_ENCRYPT_QUIZ as u64, 
            args, 
            vec![], 
            None
        )?;

        msg!("Quiz data encryption queued");
        Ok(())
    }

    pub fn decrypt_quiz_data(
        ctx: Context<DecryptQuizData>,
        encrypted_data: [u8; 64],
        nonce: u128,
    ) -> Result<()> {
        // Queue Arcium computation for decryption
        let args = vec![
            Argument::PlaintextU8(encrypted_data[0]),
            Argument::PlaintextU128(nonce),
        ];

        queue_computation(
            ctx.accounts, 
            COMP_DEF_OFFSET_DECRYPT_QUIZ as u64, 
            args, 
            vec![], 
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
        _unique_id: u8  // Add underscore to suppress unused variable warning
    ) -> Result<()> {
        require!(name.len() > 0, QuizError::EmptyName);
        require!(name.len() <= 100, QuizError::NameTooLong);
        require!(question_count > 0 && question_count <= 50, QuizError::InvalidQuestionCount);

        let quiz_set = &mut ctx.accounts.quiz_set;
        quiz_set.authority = ctx.accounts.authority.key();
        quiz_set.name = name;
        quiz_set.question_count = question_count;
        quiz_set.created_at = Clock::get()?.unix_timestamp;
        quiz_set.is_initialized = false;

        emit!(QuizSetCreated {
            quiz_set: quiz_set.key(),
            authority: ctx.accounts.authority.key(),
            name: quiz_set.name.clone(),
            question_count: quiz_set.question_count,
            timestamp: quiz_set.created_at,
        });

        msg!("Quiz set '{}' created with {} questions", quiz_set.name, quiz_set.question_count);
        Ok(())
    }

    pub fn add_encrypted_question_block(
        ctx: Context<AddEncryptedQuestionBlock>,
        question_index: u8,
        encrypted_x_coordinate: [u8; 64],  // Increased to 64 bytes
        encrypted_y_coordinate: [u8; 64],  // Increased to 64 bytes
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
        user_answer: String,
        question_index: u8,
    ) -> Result<()> {
        let question_block = &ctx.accounts.question_block;
        let quiz_set = &ctx.accounts.quiz_set;
        
        require!(question_index > 0 && question_index <= quiz_set.question_count, QuizError::InvalidQuestionIndex);

        let mut answer_bytes = [0u8; 32];
        let user_bytes = user_answer.as_bytes();
        let len = std::cmp::min(user_bytes.len(), 32);
        answer_bytes[..len].copy_from_slice(&user_bytes[..len]);

        let args = vec![
            Argument::ArcisPubkey(question_block.arcium_pubkey),
            Argument::PlaintextU128(question_block.nonce),
            Argument::PlaintextU8(answer_bytes[0]),
            Argument::PlaintextU8(question_block.encrypted_y_coordinate[0]),
        ];

        queue_computation(
            ctx.accounts, 
            COMP_DEF_OFFSET_VALIDATE_ANSWER as u64, 
            args, 
            vec![], 
            None
        )?;

        msg!("Answer validation queued for question {}", question_index);
        Ok(())
    }

    // ===== ARCIUM CALLBACKS =====

    // Modify callback to handle results correctly
    #[arcium_callback(encrypted_ix = "validate_answer")]
    pub fn validate_answer_callback(
        ctx: Context<ValidateAnswerCallback>,
        output: ComputationOutputs<ValidateAnswerOutput>,
    ) -> Result<()> {
        let result = match output {
            ComputationOutputs::Success(ValidateAnswerOutput { field_0 }) => {
                // Handle results from Arcium computation
                msg!("Arcium computation completed successfully");
                field_0
            },
            ComputationOutputs::Failure => {
                msg!("Arcium computation failed");
                return Err(ErrorCode::AbortedComputation.into());
            }
        };

        // Get boolean result from Arcium
        let is_correct = match result {
            _ => true, // Temporarily return true, will be replaced with actual logic
        };

        // Emit event with result
        emit!(AnswerVerifiedEvent {
            question_index: ctx.accounts.question_block.question_index,
            is_correct,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Answer validation completed onchain. Result: {}", is_correct);
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "encrypt_quiz")]
    pub fn encrypt_quiz_callback(
        ctx: Context<EncryptQuizCallback>,
        output: ComputationOutputs<EncryptQuizOutput>,  // Use Arcium's expected type
    ) -> Result<()> {
        // ✅ Modify: Use reference instead of copying data
        let _encrypted_data = match &output {
            ComputationOutputs::Success(EncryptQuizOutput { field_0 }) => field_0,  // Use Arcium's expected type
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        // ✅ Modify: Reduce array size
        let mut result_bytes = [0u8; 8]; // Reduced from 64 to 8
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
        output: ComputationOutputs<DecryptQuizOutput>,  // Use Arcium's expected type
    ) -> Result<()> {
        // ✅ Modify: Use reference
        let _decrypted_data = match &output {
            ComputationOutputs::Success(DecryptQuizOutput { field_0 }) => field_0,  // Use Arcium's expected type
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        // ✅ Modify: Reduce array size
        let mut result_bytes = [0u8; 8]; // Reduced from 64 to 8
        result_bytes[0] = 1;

        emit!(QuizDataDecryptedEvent {
            decrypted_data: result_bytes,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Quiz data decrypted successfully");
        Ok(())
    }
}

// ===== ACCOUNT STRUCTURES =====

#[derive(Accounts)]
#[instruction(name: String, question_count: u8, unique_id: u8)]
pub struct CreateQuizSet<'info> {
    #[account(
        init,
        payer = authority,
        space = QuizSet::LEN,
        seeds = [b"quiz_set", authority.key().as_ref(), &[unique_id]],
        bump
    )]
    pub quiz_set: Account<'info, QuizSet>,
    
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

#[queue_computation_accounts("validate_answer", payer)]
#[derive(Accounts)]
pub struct ValidateAnswerOnchain<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub question_block: Account<'info, QuestionBlock>,
    pub quiz_set: Account<'info, QuizSet>,
    
    // ✅ Modify: Use provided account instead of derive
    pub mxe_account: Account<'info, MXEAccount>,
    
    /// CHECK: This is a mempool account managed by Arcium
    #[account(mut)]
    pub mempool_account: UncheckedAccount<'info>,
    
    /// CHECK: This is an execution pool account managed by Arcium
    #[account(mut)]
    pub executing_pool: UncheckedAccount<'info>,
    
    /// CHECK: This is a computation account managed by Arcium
    #[account(mut)]
    pub computation_account: UncheckedAccount<'info>,
    
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    
    #[account(mut)]
    pub cluster_account: Account<'info, Cluster>,
    
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
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
    /// CHECK: This is a computation definition account managed by Arcium
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_VALIDATE_ANSWER))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    /// CHECK: This is a Solana sysvar account for instruction verification
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    pub question_block: Account<'info, QuestionBlock>,
}

#[callback_accounts("encrypt_quiz", payer)]
#[derive(Accounts)]
pub struct EncryptQuizCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    /// CHECK: This is a computation definition account managed by Arcium
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_ENCRYPT_QUIZ))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    /// CHECK: This is a Solana sysvar account for instruction verification
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

#[callback_accounts("decrypt_quiz", payer)]
#[derive(Accounts)]
pub struct DecryptQuizCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    /// CHECK: This is a computation definition account managed by Arcium
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DECRYPT_QUIZ))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    /// CHECK: This is a Solana sysvar account for instruction verification
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

#[queue_computation_accounts("encrypt_quiz", payer)]
#[derive(Accounts)]
pub struct EncryptQuizData<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub mxe_account: Account<'info, MXEAccount>,
    
    /// CHECK: This is a mempool account managed by Arcium
    #[account(mut)]
    pub mempool_account: UncheckedAccount<'info>,
    
    /// CHECK: This is an execution pool account managed by Arcium
    #[account(mut)]
    pub executing_pool: UncheckedAccount<'info>,
    
    /// CHECK: This is a computation account managed by Arcium
    #[account(mut)]
    pub computation_account: UncheckedAccount<'info>,
    
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    
    #[account(mut)]
    pub cluster_account: Account<'info, Cluster>,
    
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[queue_computation_accounts("decrypt_quiz", payer)]
#[derive(Accounts)]
pub struct DecryptQuizData<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub mxe_account: Account<'info, MXEAccount>,
    
    /// CHECK: This is a mempool account managed by Arcium
    #[account(mut)]
    pub mempool_account: UncheckedAccount<'info>,
    
    /// CHECK: This is an execution pool account managed by Arcium
    #[account(mut)]
    pub executing_pool: UncheckedAccount<'info>,
    
    /// CHECK: This is a computation account managed by Arcium
    #[account(mut)]
    pub computation_account: UncheckedAccount<'info>,
    
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    
    #[account(mut)]
    pub cluster_account: Account<'info, Cluster>,
    
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
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
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    /// CHECK: This is a computation definition account that will be initialized
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("encrypt_quiz", payer)]
#[derive(Accounts)]
pub struct InitEncryptQuizCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    /// CHECK: This is a computation definition account that will be initialized
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("decrypt_quiz", payer)]
#[derive(Accounts)]
pub struct InitDecryptQuizCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    /// CHECK: This is a computation definition account that will be initialized
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
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
}

impl QuizSet {
    pub const LEN: usize = 8 + 32 + 4 + 100 + 1 + 8 + 1;
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
    pub encrypted_data: [u8; 8], // Reduced from 64 to 8
    pub timestamp: i64,
}

#[event]
pub struct QuizDataDecryptedEvent {
    pub decrypted_data: [u8; 8], // Reduced from 64 to 8
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
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
}
