use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    // ===== QUIZ ENCRYPTION CIRCUIT =====
    // Encrypt question + choices (x-coordinate) with variable size support
    
    pub struct QuizEncryptInput {
        question_data: [u8; 64],  // Increased to 64 bytes for more data
        nonce: u128,
    }

    #[instruction]
    pub fn encrypt_quiz(input_ctxt: Enc<Shared, QuizEncryptInput>) -> Enc<Shared, [u8; 64]> {
        let input = input_ctxt.to_arcis();
        
        // Addition-based encryption with nonce
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
        
        // Subtraction-based decryption with nonce
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
        user_answer: [u8; 64],      // User answer
        correct_answer: [u8; 64],   // Correct answer encrypted
        nonce: u128,
    }

    #[instruction]
    pub fn validate_answer(input_ctxt: Enc<Shared, AnswerValidationInput>) -> Enc<Shared, bool> {
        let input = input_ctxt.to_arcis();
        
        // Decrypt correct answer using nonce
        let mut decrypted_correct = [0u8; 64];
        let nonce_bytes = input.nonce.to_le_bytes();
        
        for i in 0..64 {
            decrypted_correct[i] = input.correct_answer[i] - nonce_bytes[i % 16];
        }
        
        // Simple comparison - check if first few bytes match
        let mut is_correct = true;
        for i in 0..8 {
            if input.user_answer[i] != decrypted_correct[i] {
                is_correct = false;
            }
        }
        
        input_ctxt.owner.from_arcis(is_correct)
    }
}
