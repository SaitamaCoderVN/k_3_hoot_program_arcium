use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    // ===== QUIZ ENCRYPTION CIRCUIT =====
    // Encrypt question + choices (x-coordinate) with variable size support
    
    pub struct QuizEncryptInput {
        question_data: [u8; 64],  // 64 bytes for question + choices
        nonce: u128,
    }

    #[instruction]
    pub fn encrypt_quiz(input_ctxt: Enc<Shared, QuizEncryptInput>) -> Enc<Shared, [u8; 64]> {
        let input = input_ctxt.to_arcis();
        
        // Use addition-based encryption instead of XOR
        let mut encrypted = [0u8; 64];
        let nonce_bytes = input.nonce.to_le_bytes();
        
        for i in 0..64 {
            encrypted[i] = input.question_data[i] + nonce_bytes[i % 16];
        }
        
        input_ctxt.owner.from_arcis(encrypted)
    }

    // ===== QUIZ DECRYPTION CIRCUIT =====
    // Decrypt question + choices (x-coordinate) with variable size support
    
    pub struct QuizDecryptInput {
        encrypted_data: [u8; 64],
        nonce: u128,
    }

    #[instruction]
    pub fn decrypt_quiz(input_ctxt: Enc<Shared, QuizDecryptInput>) -> Enc<Shared, [u8; 64]> {
        let input = input_ctxt.to_arcis();
        
        // Use subtraction-based decryption
        let mut decrypted = [0u8; 64];
        let nonce_bytes = input.nonce.to_le_bytes();
        
        for i in 0..64 {
            decrypted[i] = input.encrypted_data[i] - nonce_bytes[i % 16];
        }
        
        input_ctxt.owner.from_arcis(decrypted)
    }

    // ===== ANSWER VALIDATION CIRCUIT =====
    // Compare user answer with correct answer (y-coordinate)
    
    pub struct AnswerValidationInput {
        user_answer: [u8; 64],      // User answer (64 bytes)
        correct_answer: [u8; 64],   // Correct answer encrypted (64 bytes)
        nonce: u128,                // Nonce for decryption
    }

    #[instruction]
    pub fn validate_answer(input_ctxt: Enc<Shared, AnswerValidationInput>) -> Enc<Shared, bool> {
        let input = input_ctxt.to_arcis();
        
        // Use subtraction-based decryption
        let mut decrypted_correct = [0u8; 64];
        let nonce_bytes = input.nonce.to_le_bytes();
        
        for i in 0..64 {
            decrypted_correct[i] = input.correct_answer[i] - nonce_bytes[i % 16];
        }
        
        // FIXED: Better comparison logic without break statement
        let mut is_correct = true;
        
        // Find the end of the actual answer text (before null bytes)
        let mut user_answer_end = 0;
        let mut correct_answer_end = 0;
        
        for i in 0..64 {
            if input.user_answer[i] != 0 {
                user_answer_end = i + 1;
            }
            if decrypted_correct[i] != 0 {
                correct_answer_end = i + 1;
            }
        }
        
        // Compare only the meaningful parts
        let max_len = if user_answer_end > correct_answer_end {
            user_answer_end
        } else {
            correct_answer_end
        };
        
        // FIXED: Use constant loop bound and flag-based logic
        for i in 0..64 {
            if i < max_len && input.user_answer[i] != decrypted_correct[i] {
                is_correct = false;
            }
        }
        
        input_ctxt.owner.from_arcis(is_correct)
    }
}
