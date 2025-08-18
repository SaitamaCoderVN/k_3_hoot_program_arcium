use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

// Arcium will generate these types automatically

const COMP_DEF_OFFSET_ADD_TOGETHER: u32 = comp_def_offset("add_together");
    // Temporarily comment out until Arcium build environment is fixed
    const COMP_DEF_OFFSET_ENCRYPT_QUIZ: u32 = comp_def_offset("encrypt_quiz");
    const COMP_DEF_OFFSET_DECRYPT_QUIZ: u32 = comp_def_offset("decrypt_quiz");

declare_id!("HJnfWYgez3pJhwNZpHwat182Gwxzh7DebEnDoWzuojrS");

#[arcium_program]
pub mod k_3_hoot_program_arcium {
    use super::*;

    // ===== ARCIUM COMPUTATION DEFINITIONS =====
    
    pub fn init_add_together_comp_def(ctx: Context<InitAddTogetherCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    // Temporarily commented out until Arcium build environment is fixed
    // pub fn init_encrypt_quiz_comp_def(ctx: Context<InitEncryptQuizCompDef>) -> Result<()> {
    //     init_comp_def(ctx.accounts, true, 0, None, None)?;
    //     Ok(())
    // }

    // pub fn init_decrypt_quiz_comp_def(ctx: Context<InitDecryptQuizCompDef>) -> Result<()> {
    //     init_comp_def(ctx.accounts, true, 0, None, None)?;
    //     Ok(())
    // }

    // ===== QUIZ MANAGEMENT FUNCTIONS =====

    pub fn create_quiz_set(ctx: Context<CreateQuizSet>, name: String) -> Result<()> {
        // Validate name length
        require!(name.len() > 0, QuizError::EmptyName);
        require!(name.len() <= 100, QuizError::NameTooLong);

        // Initialize quiz set
        let quiz_set = &mut ctx.accounts.quiz_set;
        quiz_set.authority = ctx.accounts.authority.key();
        quiz_set.name = name;
        quiz_set.created_at = Clock::get()?.unix_timestamp;
        quiz_set.question_count = 0;

        // Emit event
        emit!(QuizSetCreated {
            quiz_set: quiz_set.key(),
            authority: ctx.accounts.authority.key(),
            name: quiz_set.name.clone(),
            timestamp: quiz_set.created_at,
        });

        msg!("Quiz set '{}' created successfully", quiz_set.name);
        Ok(())
    }

    pub fn add_encrypted_question(
        ctx: Context<AddEncryptedQuestion>,
        question_text: String,
        question_number: u8,
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        // Validate question text
        require!(question_text.len() > 0, QuizError::EmptyQuestion);
        require!(question_text.len() <= 500, QuizError::QuestionTooLong);

        // Verify quiz set exists and belongs to the authority
        let quiz_set = &ctx.accounts.quiz_set;
        require!(quiz_set.authority == ctx.accounts.authority.key(), QuizError::Unauthorized);

        // Verify question number is sequential
        require!(question_number as u32 == quiz_set.question_count + 1, QuizError::InvalidQuestionNumber);

        // Initialize question with encrypted data
        let question = &mut ctx.accounts.question;
        question.quiz_set = quiz_set.key();
        question.question_text = question_text; // Store plain text for now, will be encrypted
        question.created_at = Clock::get()?.unix_timestamp;
        question.question_number = question_number as u32;
        question.pub_key = pub_key;
        question.nonce = nonce;
        question.is_encrypted = false; // Will be set to true after encryption

        // Update quiz set question count
        let quiz_set = &mut ctx.accounts.quiz_set;
        quiz_set.question_count += 1;

        // Emit event
        emit!(QuestionAdded {
            question: question.key(),
            quiz_set: quiz_set.key(),
            question_text: question.question_text.clone(),
            question_number: question.question_number,
            timestamp: question.created_at,
        });

        msg!("Question {} added to quiz set '{}'", question.question_number, quiz_set.name);
        Ok(())
    }

    pub fn encrypt_question_data(
        ctx: Context<EncryptQuestionData>,
        computation_offset: u64,
        question_text: String,
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        // Convert question text to bytes for encryption
        let question_bytes = question_text.as_bytes();
        let mut ciphertext = [0u8; 32];
        
        // Pad or truncate to 32 bytes
        let len = std::cmp::min(question_bytes.len(), 32);
        ciphertext[..len].copy_from_slice(&question_bytes[..len]);

        let args = vec![
            Argument::ArcisPubkey(pub_key),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU8(ciphertext),
        ];
        
        queue_computation(ctx.accounts, computation_offset, args, vec![], None)?;
        Ok(())
    }

    pub fn add_encrypted_answer(
        ctx: Context<AddEncryptedAnswer>,
        answer_text: String,
        is_correct: bool,
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        // Validate answer text
        require!(answer_text.len() > 0, QuizError::EmptyAnswer);
        require!(answer_text.len() <= 200, QuizError::AnswerTooLong);

        // Verify question exists and belongs to the authority
        let question = &ctx.accounts.question;
        let quiz_set = &ctx.accounts.quiz_set;
        require!(quiz_set.authority == ctx.accounts.authority.key(), QuizError::Unauthorized);

        // Initialize answer with encrypted data
        let answer = &mut ctx.accounts.answer;
        answer.question = question.key();
        answer.answer_text = answer_text;
        answer.is_correct = is_correct;
        answer.created_at = Clock::get()?.unix_timestamp;
        answer.pub_key = pub_key;
        answer.nonce = nonce;
        answer.is_encrypted = false;

        // Emit event
        emit!(AnswerAdded {
            answer: answer.key(),
            question: question.key(),
            answer_text: answer.answer_text.clone(),
            is_correct: answer.is_correct,
            timestamp: answer.created_at,
        });

        msg!("Answer added to question {}", question.question_number);
        Ok(())
    }

    // ===== ARCIUM COMPUTATION FUNCTIONS =====

    pub fn add_together(
        ctx: Context<AddTogether>,
        computation_offset: u64,
        ciphertext_0: [u8; 32],
        ciphertext_1: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let args = vec![
            Argument::ArcisPubkey(pub_key),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU8(ciphertext_0),
            Argument::EncryptedU8(ciphertext_1),
        ];
        queue_computation(ctx.accounts, computation_offset, args, vec![], None)?;
        Ok(())
    }

    // ===== ARCIUM CALLBACKS =====

    #[arcium_callback(encrypted_ix = "add_together")]
    pub fn add_together_callback(
        ctx: Context<AddTogetherCallback>,
        output: ComputationOutputs<AddTogetherOutput>,
    ) -> Result<()> {
        let _o = match output {
            ComputationOutputs::Success(AddTogetherOutput { field_0: o }) => o,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        // Use smaller stack variables
        let sum = [0u8; 32];
        let nonce = [0u8; 16];
        
        emit!(SumEvent {
            sum,
            nonce,
        });
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "encrypt_quiz")]
    pub fn encrypt_quiz_callback(
        ctx: Context<EncryptQuizCallback>,
        output: ComputationOutputs<EncryptQuizOutput>,
    ) -> Result<()> {
        let _o = match output {
            ComputationOutputs::Success(EncryptQuizOutput { field_0: o }) => o,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        // Use smaller stack variables
        let encrypted_data = [0u8; 32];
        let nonce = [0u8; 16];
        
        emit!(QuizEncryptedEvent {
            encrypted_data,
            nonce,
        });
        Ok(())
    }
}

// ===== ACCOUNT STRUCTURES =====

#[queue_computation_accounts("add_together", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct AddTogether<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: mempool_account, checked by the arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: executing_pool, checked by the arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK: computation_account, checked by the arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_ADD_TOGETHER))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[queue_computation_accounts("encrypt_quiz", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct EncryptQuestionData<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: mempool_account, checked by the arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: executing_pool, checked by the arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK: computation_account, checked by the arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_ENCRYPT_QUIZ))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("add_together", payer)]
#[derive(Accounts)]
pub struct AddTogetherCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_ADD_TOGETHER))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the arcium program.
    pub instructions_sysvar: AccountInfo<'info>,
}

#[callback_accounts("encrypt_quiz", payer)]
#[derive(Accounts)]
pub struct EncryptQuizCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_ENCRYPT_QUIZ))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the arcium program.
    pub instructions_sysvar: AccountInfo<'info>,
}

// ===== QUIZ ACCOUNT STRUCTURES =====

#[derive(Accounts)]
pub struct CreateQuizSet<'info> {
    #[account(
        init,
        payer = authority,
        space = QuizSet::LEN,
        seeds = [b"quiz_set", authority.key().as_ref()],
        bump
    )]
    pub quiz_set: Account<'info, QuizSet>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddEncryptedQuestion<'info> {
    #[account(
        init,
        payer = authority,
        space = Question::LEN,
        seeds = [
            b"question",
            quiz_set.key().as_ref(),
            question_seed.key().as_ref()
        ],
        bump
    )]
    pub question: Account<'info, Question>,
    
    #[account(mut)]
    pub quiz_set: Account<'info, QuizSet>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    
    /// CHECK: question_seed, used only as a seed for PDA derivation.
    pub question_seed: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct AddEncryptedAnswer<'info> {
    #[account(
        init,
        payer = authority,
        space = Answer::LEN,
        seeds = [
            b"answer",
            question.key().as_ref(),
            answer_seed.key().as_ref()
        ],
        bump
    )]
    pub answer: Account<'info, Answer>,
    
    pub question: Account<'info, Question>,
    pub quiz_set: Account<'info, QuizSet>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    
    /// CHECK: answer_seed, used only as a seed for PDA derivation.
    pub answer_seed: UncheckedAccount<'info>,
}

// ===== ARCIUM INITIALIZATION STRUCTURES =====

#[init_computation_definition_accounts("add_together", payer)]
#[derive(Accounts)]
pub struct InitAddTogetherCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by the arcium program.
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
    #[account(mut)]
    /// CHECK: comp_def_account, checked by the arcium program.
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
    #[account(mut)]
    /// CHECK: comp_def_account, checked by the arcium program.
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

// ===== DATA STRUCTURES =====

#[account]
pub struct QuizSet {
    pub authority: Pubkey,      // 32 bytes
    pub name: String,           // 4 + 100 bytes
    pub created_at: i64,        // 8 bytes
    pub question_count: u32,    // 4 bytes
}

impl QuizSet {
    pub const LEN: usize = 8 + 32 + 4 + 100 + 8 + 4;
}

#[account]
pub struct Question {
    pub quiz_set: Pubkey,       // 32 bytes
    pub question_text: String,  // 4 + 500 bytes
    pub created_at: i64,        // 8 bytes
    pub question_number: u32,   // 4 bytes
    pub pub_key: [u8; 32],     // 32 bytes - Arcium public key
    pub nonce: u128,            // 16 bytes - Nonce for encryption
    pub is_encrypted: bool,     // 1 byte - Encryption status
}

impl Question {
    pub const LEN: usize = 8 + 32 + 4 + 500 + 8 + 4 + 32 + 16 + 1;
}

#[account]
pub struct Answer {
    pub question: Pubkey,       // 32 bytes
    pub answer_text: String,    // 4 + 200 bytes
    pub is_correct: bool,       // 1 byte
    pub created_at: i64,        // 8 bytes
    pub pub_key: [u8; 32],     // 32 bytes - Arcium public key
    pub nonce: u128,            // 16 bytes - Nonce for encryption
    pub is_encrypted: bool,     // 1 byte - Encryption status
}

impl Answer {
    pub const LEN: usize = 8 + 32 + 4 + 200 + 1 + 8 + 32 + 16 + 1;
}

// ===== EVENTS =====

#[event]
pub struct QuizSetCreated {
    pub quiz_set: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub timestamp: i64,
}

#[event]
pub struct QuestionAdded {
    pub question: Pubkey,
    pub quiz_set: Pubkey,
    pub question_text: String,
    pub question_number: u32,
    pub timestamp: i64,
}

#[event]
pub struct AnswerAdded {
    pub answer: Pubkey,
    pub question: Pubkey,
    pub answer_text: String,
    pub is_correct: bool,
    pub timestamp: i64,
}

#[event]
pub struct SumEvent {
    pub sum: [u8; 32],
    pub nonce: [u8; 16],
}

#[event]
pub struct QuizEncryptedEvent {
    pub encrypted_data: [u8; 32],
    pub nonce: [u8; 16],
}

// ===== ERROR CODES =====

#[error_code]
pub enum QuizError {
    #[msg("Quiz set name cannot be empty")]
    EmptyName,
    #[msg("Quiz set name too long (max 100 characters)")]
    NameTooLong,
    #[msg("Question text cannot be empty")]
    EmptyQuestion,
    #[msg("Question text too long (max 500 characters)")]
    QuestionTooLong,
    #[msg("Answer text cannot be empty")]
    EmptyAnswer,
    #[msg("Answer text too long (max 200 characters)")]
    AnswerTooLong,
    #[msg("Unauthorized to modify this quiz set")]
    Unauthorized,
    #[msg("Invalid question number")]
    InvalidQuestionNumber,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
}
