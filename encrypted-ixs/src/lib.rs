use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    // ===== QUIZ ENCRYPTION CIRCUIT =====
    // Encrypt question + 4 choices (x-coordinate)
    
    pub struct QuizEncryptInput {
        question_text: [u8; 32],  // Question + 4 choices
        nonce: u128,
    }

    #[instruction]
    pub fn encrypt_quiz(input_ctxt: Enc<Shared, QuizEncryptInput>) -> Enc<Shared, [u8; 32]> {
        let input = input_ctxt.to_arcis();
        
        // Encryption: Add with nonce
        let mut encrypted = [0u8; 32];
        let nonce_bytes = input.nonce.to_le_bytes();
        
        for i in 0..32 {
            encrypted[i] = input.question_text[i] + nonce_bytes[i % 16];
        }
        
        input_ctxt.owner.from_arcis(encrypted)
    }

    // ===== QUIZ DECRYPTION CIRCUIT =====
    // Decrypt question + 4 choices (x-coordinate)
    
    pub struct QuizDecryptInput {
        encrypted_data: [u8; 32],
        nonce: u128,
    }

    #[instruction]
    pub fn decrypt_quiz(input_ctxt: Enc<Shared, QuizDecryptInput>) -> Enc<Shared, [u8; 32]> {
        let input = input_ctxt.to_arcis();
        
        // Decryption: Subtract with nonce
        let mut decrypted = [0u8; 32];
        let nonce_bytes = input.nonce.to_le_bytes();
        
        for i in 0..32 {
            decrypted[i] = input.encrypted_data[i] - nonce_bytes[i % 16];
        }
        
        input_ctxt.owner.from_arcis(decrypted)
    }

    // ===== ANSWER VALIDATION CIRCUIT =====
    // Compare user answer with correct answer (y-coordinate)
    
    pub struct AnswerValidationInput {
        user_answer: [u8; 32],      // User answer
        correct_answer: [u8; 32],   // Correct answer encrypted
        nonce: u128,
    }

    #[instruction]
    pub fn validate_answer(input_ctxt: Enc<Shared, AnswerValidationInput>) -> Enc<Shared, bool> {
        let input = input_ctxt.to_arcis();
        
        // Compare user answer with correct answer
        // Use nonce to decrypt the correct answer before comparing
        let mut is_correct = true;
        
        // Decrypt correct answer using nonce
        let mut decrypted_correct = [0u8; 32];
        let nonce_bytes = input.nonce.to_le_bytes();
        
        for i in 0..32 {
            decrypted_correct[i] = input.correct_answer[i] - nonce_bytes[i % 16];
        }
        
        // Compare user answer with decrypted correct answer
        for i in 0..32 {
            if input.user_answer[i] != decrypted_correct[i] {
                is_correct = false;
            }
        }
        
        input_ctxt.owner.from_arcis(is_correct)
    }
}
