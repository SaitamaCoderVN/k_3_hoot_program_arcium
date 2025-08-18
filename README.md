# K3 Hoot Program with Arcium Integration

A Solana smart contract that combines quiz management functionality with Arcium's homomorphic encryption capabilities for secure, privacy-preserving quiz applications.

## 🚀 Features

### Quiz Management
- **Create Quiz Sets**: Organize questions into themed collections
- **Add Questions**: Create questions with automatic numbering
- **Add Answers**: Associate correct/incorrect answers with questions
- **Authority Control**: Only authorized users can modify quiz content

### Arcium Encryption Integration
- **Homomorphic Encryption**: Perform computations on encrypted data
- **Question Encryption**: Encrypt question text before storing on-chain
- **Answer Encryption**: Encrypt answer text for privacy
- **Secure Validation**: Compare encrypted answers without revealing content

## 🏗️ Architecture

### Core Components

1. **QuizSet**: Container for related questions
2. **Question**: Individual quiz questions with encryption metadata
3. **Answer**: Question responses with encryption support
4. **Arcium Integration**: Computation definitions for encryption/decryption

### Data Flow

```
Plain Text → Arcium Encryption → On-chain Storage → Homomorphic Processing → Results
```

## 📋 Prerequisites

- Solana CLI tools
- Anchor Framework
- Arcium Framework
- Node.js and Yarn

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd k_3_hoot_program_arcium
```

2. **Install dependencies**
```bash
yarn install
```

3. **Build the program**
```bash
anchor build
```

4. **Build confidential instructions**
```bash
cd encrypted-ixs
cargo build
cd ..
```

## 🔧 Configuration

### Anchor.toml
```toml
[programs.localnet]
k_3_hoot_program_arcium = "6eRog6k9UkHsHxdQ9exg7yBjgMFPmRHhN2S4xTn4GBE7"

[registry]
url = "https://anchor.projectserum.com"

[provider]
cluster = "localnet"
wallet = "~/.config/solana/id.json"
```

### Arcium Configuration
The program uses Arcium's computation definition system for:
- `add_together`: Basic homomorphic addition
- `encrypt_quiz`: Question text encryption
- `decrypt_quiz`: Question text decryption

## 📚 Usage Examples

### 1. Create a Quiz Set

```typescript
const [quizSetPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("quiz_set"), authority.publicKey.toBuffer()],
  program.programId
);

await program.methods
  .createQuizSet("Math Quiz")
  .accounts({
    quizSet: quizSetPda,
    authority: authority.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([authority])
  .rpc();
```

### 2. Add an Encrypted Question

```typescript
const [questionPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("question"),
    quizSetPda.toBuffer(),
    questionSeed.publicKey.toBuffer()
  ],
  program.programId
);

const pubKey = new Uint8Array(32).fill(1); // Arcium public key
const nonce = BigInt(123456789);

await program.methods
  .addEncryptedQuestion(
    "What is 2 + 2?",
    1,
    Array.from(pubKey),
    nonce
  )
  .accounts({
    question: questionPda,
    quizSet: quizSetPda,
    authority: authority.publicKey,
    systemProgram: SystemProgram.programId,
    questionSeed: questionSeed.publicKey,
  })
  .signers([authority, questionSeed])
  .rpc();
```

### 3. Add an Encrypted Answer

```typescript
const [answerPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("answer"),
    questionPda.toBuffer(),
    answerSeed.publicKey.toBuffer()
  ],
  program.programId
);

await program.methods
  .addEncryptedAnswer(
    "4",
    true, // is_correct
    Array.from(pubKey),
    nonce
  )
  .accounts({
    answer: answerPda,
    question: questionPda,
    quizSet: quizSetPda,
    authority: authority.publicKey,
    systemProgram: SystemProgram.programId,
    answerSeed: answerSeed.publicKey,
  })
  .signers([authority, answerSeed])
  .rpc();
```

### 4. Encrypt Question Data

```typescript
await program.methods
  .encryptQuestionData(
    computationOffset,
    "What is 2 + 2?",
    Array.from(pubKey),
    nonce
  )
  .accounts({
    // ... Arcium accounts
  })
  .rpc();
```

## 🔐 Security Features

### Encryption
- **Homomorphic Encryption**: Perform computations on encrypted data
- **Nonce-based Security**: Unique nonce for each encryption operation
- **Public Key Management**: Secure key distribution through Arcium

### Access Control
- **Authority Verification**: Only authorized users can modify content
- **Sequential Question Numbers**: Prevents question manipulation
- **PDA-based Storage**: Deterministic account addresses

## 🧪 Testing

Run the test suite:

```bash
anchor test
```

The tests cover:
- Quiz set creation
- Question addition
- Answer management
- Arcium integration functions

## 🌐 Deployment

### Local Development
```bash
anchor deploy
```

### Testnet Deployment
```bash
anchor deploy --provider.cluster testnet
```

### Mainnet Deployment
```bash
anchor deploy --provider.cluster mainnet
```

## 📊 Account Structures

### QuizSet
```rust
pub struct QuizSet {
    pub authority: Pubkey,      // 32 bytes
    pub name: String,           // 4 + 100 bytes
    pub created_at: i64,        // 8 bytes
    pub question_count: u32,    // 4 bytes
}
```

### Question
```rust
pub struct Question {
    pub quiz_set: Pubkey,       // 32 bytes
    pub question_text: String,  // 4 + 500 bytes
    pub created_at: i64,        // 8 bytes
    pub question_number: u32,   // 4 bytes
    pub pub_key: [u8; 32],     // 32 bytes - Arcium public key
    pub nonce: u128,            // 16 bytes - Nonce for encryption
    pub is_encrypted: bool,     // 1 byte - Encryption status
}
```

### Answer
```rust
pub struct Answer {
    pub question: Pubkey,       // 32 bytes
    pub answer_text: String,    // 4 + 200 bytes
    pub is_correct: bool,       // 1 byte
    pub created_at: i64,        // 8 bytes
    pub pub_key: [u8; 32],     // 32 bytes - Arcium public key
    pub nonce: u128,            // 16 bytes - Nonce for encryption
    pub is_encrypted: bool,     // 1 byte - Encryption status
}
```

## 🔍 Events

The program emits events for:
- Quiz set creation
- Question addition
- Answer addition
- Encryption operations
- Computation results

## 🚨 Error Handling

### Quiz Errors
- `EmptyName`: Quiz set name cannot be empty
- `NameTooLong`: Quiz set name exceeds 100 characters
- `EmptyQuestion`: Question text cannot be empty
- `QuestionTooLong`: Question text exceeds 500 characters
- `EmptyAnswer`: Answer text cannot be empty
- `AnswerTooLong`: Answer text exceeds 200 characters
- `Unauthorized`: User not authorized to modify quiz set
- `InvalidQuestionNumber`: Question number not sequential

### Arcium Errors
- `AbortedComputation`: Computation was aborted
- `ClusterNotSet`: Arcium cluster not configured

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For questions and support:
- Open an issue on GitHub
- Check the Arcium documentation
- Review Solana and Anchor guides

## 🔗 Related Links

- [Solana Documentation](https://docs.solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Arcium Framework](https://arcium.com/)
- [Homomorphic Encryption](https://en.wikipedia.org/wiki/Homomorphic_encryption)
