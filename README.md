# K3 Hoot Program with Arcium Integration

A secure quiz application built on Solana using the Arcium framework for encrypted computations.

## 🚀 Features

- **On-Chain Quiz Management**: Create and manage quiz sets directly on Solana blockchain
- **Secure Encryption**: Questions and answers are encrypted using unique nonces
- **Arcium Integration**: Leverage Arcium's encrypted computation capabilities
- **No External Dependencies**: All data stored directly on-chain (no IPFS required)

## 🔐 Security Architecture

### Encryption Method
- **X-coordinate**: Question text + choices encrypted together using addition-based encryption
- **Y-coordinate**: Correct answer encrypted separately using the same nonce
- **Nonce**: Unique random value for each question ensuring security
- **On-Chain Storage**: All encrypted data stored directly on Solana blockchain

### Data Flow
1. **Creation**: Question data is combined and encrypted on-chain
2. **Storage**: Encrypted data stored in QuestionBlock accounts
3. **Validation**: Arcium circuits handle answer validation without decryption
4. **Verification**: Results verified on-chain using encrypted computations

## 🏗️ Project Structure

```
├── programs/k_3_hoot_program_arcium/     # Main Solana program
├── encrypted-ixs/                        # Arcium encrypted instructions
├── examples/                             # TypeScript examples
│   ├── quiz-encryption.ts               # Quiz creation and encryption
│   └── quiz-encryption-test.ts          # Encryption test suite
├── tests/                                # Program tests
└── migrations/                           # Deployment scripts
```

## 🛠️ Setup & Installation

### Prerequisites
- Rust 1.70+
- Solana CLI 1.16+
- Node.js 18+
- Anchor CLI

### Installation
```bash
# Clone repository
git clone <repository-url>
cd k_3_hoot_program_arcium

# Install dependencies
yarn install

# Build program
anchor build

# Run tests
anchor test
```

## 📚 Usage Examples

### Creating a Quiz
```typescript
import { SecureQuizEncryptor } from './examples/quiz-encryption';

const encryptor = new SecureQuizEncryptor(program, authority, connection);

const questions = [
  {
    question: "What is the derivative of x²?",
    choices: ["x", "2x", "x²", "2x²"],
    correctAnswer: "2x"
  }
];

const { quizSetPda } = await encryptor.createCompleteQuiz("Math Quiz", questions);
```

### Testing Encryption
```bash
# Test encryption/decryption logic
npx ts-node examples/quiz-encryption-test.ts

# Run full quiz creation
npx ts-node examples/quiz-encryption.ts
```

## 🔧 Technical Details

### Encryption Algorithm
- **Method**: Addition-based encryption with nonce
- **Block Size**: 32 bytes (fixed size for on-chain storage)
- **Nonce**: 128-bit random value for each question
- **Padding**: Zero-padding for data shorter than 32 bytes

### Arcium Circuits
- `encrypt_quiz`: Encrypts question data on-chain
- `decrypt_quiz`: Decrypts question data on-chain  
- `validate_answer`: Validates user answers without decryption

### Solana Accounts
- **QuizSet**: Stores quiz metadata and configuration
- **QuestionBlock**: Stores encrypted question data and Arcium pubkeys

## 🚀 Deployment

### Devnet
```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# Initialize computation definitions
anchor run init-computation-definitions
```

### Mainnet
```bash
# Deploy to mainnet
anchor deploy --provider.cluster mainnet-beta
```

## 🔍 Testing

```bash
# Run all tests
anchor test

# Test specific functionality
anchor test --skip-lint

# Run with specific cluster
anchor test --provider.cluster devnet
```

## 📖 API Reference

### Core Functions
- `createQuizSet(name, questionCount, uniqueId)`: Create new quiz set
- `addEncryptedQuestionBlock(...)`: Add encrypted question to quiz
- `validateAnswerOnchain(...)`: Validate user answer on-chain

### Events
- `QuizSetCreated`: Emitted when quiz set is created
- `QuestionBlockAdded`: Emitted when question is added
- `AnswerVerifiedEvent`: Emitted when answer is validated

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes and test thoroughly
4. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For questions and support:
- Open an issue on GitHub
- Check the documentation
- Review the test examples

---

**Note**: This implementation stores all quiz data directly on-chain using encrypted storage, eliminating the need for external IPFS dependencies while maintaining security through Arcium's encrypted computation framework.
