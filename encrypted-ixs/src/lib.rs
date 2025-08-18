use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    // ===== ADD TOGETHER CIRCUIT =====
    
    pub struct InputValues {
        v1: u8,
        v2: u8,
    }

    #[instruction]
    pub fn add_together(input_ctxt: Enc<Shared, InputValues>) -> Enc<Shared, u16> {
        let input = input_ctxt.to_arcis();
        let sum = input.v1 as u16 + input.v2 as u16;
        input_ctxt.owner.from_arcis(sum)
    }

    // ===== QUIZ ENCRYPTION CIRCUIT =====
    
    pub struct QuizEncryptInput {
        question_text: [u8; 32],  // Padded question text
        nonce: u128,
    }

    #[instruction]
    pub fn encrypt_quiz(input_ctxt: Enc<Shared, QuizEncryptInput>) -> Enc<Shared, [u8; 32]> {
        let input = input_ctxt.to_arcis();
        
        // Simple encryption: Add nonce bytes
        let mut encrypted = [0u8; 32];
        let nonce_bytes = input.nonce.to_le_bytes();
        
        for i in 0..32 {
            encrypted[i] = input.question_text[i] + nonce_bytes[i % 16];
        }
        
        input_ctxt.owner.from_arcis(encrypted)
    }

    // ===== QUIZ DECRYPTION CIRCUIT =====
    
    pub struct QuizDecryptInput {
        encrypted_data: [u8; 32],
        nonce: u128,
    }

    #[instruction]
    pub fn decrypt_quiz(input_ctxt: Enc<Shared, QuizDecryptInput>) -> Enc<Shared, [u8; 32]> {
        let input = input_ctxt.to_arcis();
        
        // Simple decryption: Subtract nonce bytes
        let mut decrypted = [0u8; 32];
        let nonce_bytes = input.nonce.to_le_bytes();
        
        for i in 0..32 {
            decrypted[i] = input.encrypted_data[i] - nonce_bytes[i % 16];
        }
        
        input_ctxt.owner.from_arcis(decrypted)
    }

    // ===== ANSWER VALIDATION CIRCUIT =====
    
    pub struct AnswerValidationInput {
        user_answer: [u8; 32],
        correct_answer: [u8; 32],
        nonce: u128,
    }

    #[instruction]
    pub fn validate_answer(input_ctxt: Enc<Shared, AnswerValidationInput>) -> Enc<Shared, bool> {
        let input = input_ctxt.to_arcis();
        
        // Compare encrypted answers without revealing the actual answers
        let mut is_correct = true;
        for i in 0..32 {
            if input.user_answer[i] != input.correct_answer[i] {
                is_correct = false;
            }
        }
        
        input_ctxt.owner.from_arcis(is_correct)
    }
}
