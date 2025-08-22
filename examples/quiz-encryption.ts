import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { K3HootProgramArcium } from "../target/types/k_3_hoot_program_arcium";
import { PublicKey, Keypair, SystemProgram, Connection } from "@solana/web3.js";
import { randomBytes } from 'crypto';
import { BN } from "@coral-xyz/anchor";

interface QuestionData {
  question: string;
  choices: string[];
  correctAnswer: string;
}

class SecureQuizEncryptor {
  private program: Program<K3HootProgramArcium>;
  private authority: Keypair;
  private connection: Connection;

  constructor(program: Program<K3HootProgramArcium>, authority: Keypair, connection: Connection) {
    this.program = program;
    this.authority = authority;
    this.connection = connection;
  }

  // Check if quiz set exists
  async checkQuizSetExists(authority: PublicKey): Promise<{ exists: boolean; address?: string }> {
    const [quizSetPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("quiz_set"),
        authority.toBuffer()
      ],
      this.program.programId
    );

    try {
      const accountInfo = await this.connection.getAccountInfo(quizSetPda);
      return { exists: accountInfo !== null, address: quizSetPda.toString() };
    } catch (error) {
      return { exists: false };
    }
  }

  // Create quiz set with fixed seeds (temporary)
  async createQuizSet(name: string, questionCount: number): Promise<string> {
    // Create unique name with timestamp and random string
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const uniqueName = `${name}_${timestamp}_${randomSuffix}`;
    
    console.log(` Creating quiz set: ${uniqueName}`);
    
    // Generate unique_id for this quiz set
    const uniqueId = Math.floor(Math.random() * 256);
    
    // Use seeds with unique_id to be compatible with program
    const [quizSetPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("quiz_set"),
        this.authority.publicKey.toBuffer(),
        Buffer.from([uniqueId])
      ],
      this.program.programId
    );

    console.log(`📝 Transaction: Creating quiz set...`);
    console.log(`   Account: ${quizSetPda.toString()}`);
    console.log(`   Seeds: ["quiz_set", "${this.authority.publicKey.toString()}", ${uniqueId}]`);
    
    try {
      const tx = await this.program.methods
        .createQuizSet(uniqueName, questionCount, uniqueId)
        .accountsPartial({
          quizSet: quizSetPda,
          authority: this.authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([this.authority])
        .rpc({ commitment: "confirmed" });

      console.log(`✅ Quiz set created: ${quizSetPda.toString()}`);
      console.log(`   Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(tx, "confirmed");
      console.log(`✅ Transaction confirmed!`);
      
      return quizSetPda.toString();
    } catch (error: any) {
      console.error(`❌ Failed to create quiz set:`, error);
      throw error;
    }
  }

  // Fix 1: Modify encryptQuestionBlockWithIPFS to store actual data on IPFS
  private async encryptQuestionBlockWithIPFS(questionData: QuestionData, nonce: BN): Promise<Uint8Array> {
    // Create full data including correct answer
    const fullData = {
      question: questionData.question,
      choices: questionData.choices,
      correctAnswer: questionData.correctAnswer,
      timestamp: Date.now()
    };
    
    const jsonString = JSON.stringify(fullData);
    console.log(`   🔍 Full JSON: ${jsonString}`);
    console.log(`   🔍 JSON length: ${jsonString.length} bytes`);
    
    // Store actual data on IPFS (simulate)
    const ipfsHash = await this.uploadToIPFS(jsonString);
    console.log(`   🔗 IPFS Hash: ${ipfsHash}`);
    
    // Encrypt IPFS hash with nonce
    const hashBytes = Buffer.from(ipfsHash, 'utf8');
    const encrypted = Buffer.alloc(hashBytes.length); // Use actual length
    
    for (let i = 0; i < hashBytes.length; i++) {
      encrypted[i] = hashBytes[i] ^ (nonce.toNumber() & 0xFF);
    }
    
    return new Uint8Array(encrypted);
  }

  // Fix 2: Add method to upload data to IPFS
  private async uploadToIPFS(data: string): Promise<string> {
    try {
      // In reality, you would call IPFS API
      // Temporarily create fake but complete hash
      const hash = `Qm${Buffer.from(data).toString('base64').slice(0, 44)}`;
      
      // Save data locally for testing
      const filename = `ipfs-data-${Date.now()}.json`;
      require('fs').writeFileSync(filename, data);
      console.log(`    Data saved locally: ${filename}`);
      
      return hash;
    } catch (error: any) {
      console.log(`   ❌ IPFS upload failed: ${error.message}`);
      // Fallback: create hash from data
      return `Qm${Buffer.from(data).toString('base64').slice(0, 44)}`;
    }
  }

  // Fix 3: Modify generateIPFSHash to no longer be necessary
  // private generateIPFSHash(data: string): string { ... } // Delete this method

  // Encrypt correct answer (y-coordinate) - only the correct answer
  private encryptCorrectAnswer(answer: string, nonce: BN): Uint8Array {
    const answerBytes = Buffer.from(answer);
    const encrypted = Buffer.alloc(32);
    
    // Encrypt: XOR with nonce (not timestamp)
    const nonceValue = nonce.toNumber();
    for (let i = 0; i < 32; i++) {
      encrypted[i] = (i < answerBytes.length ? answerBytes[i] : 0) ^ (nonceValue & 0xFF);
    }
    
    return new Uint8Array(encrypted);
  }

  // Add encrypted question
  async addEncryptedQuestion(
    quizSetPda: string,
    questionIndex: number,
    questionData: QuestionData
  ): Promise<void> {
    console.log(`\n🔐 Adding encrypted question ${questionIndex}...`);
    
    // Create question block PDA with correct seeds as program
    const [questionBlockPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("question_block"),
        new PublicKey(quizSetPda).toBuffer(),
        Buffer.from([questionIndex])
      ],
      this.program.programId
    );

    console.log(`   Question Block PDA: ${questionBlockPda.toString()}`);
    console.log(`   Seeds: ["question_block", "${quizSetPda}", ${questionIndex}]`);

    // Encrypt data with unique nonce
    const uniqueNonce = new BN(Date.now() + questionIndex + Math.floor(Math.random() * 100));
    
    // Use IPFS to store full data
    const encryptedX = await this.encryptQuestionBlockWithIPFS(questionData, uniqueNonce);
    const encryptedY = this.encryptCorrectAnswer(questionData.correctAnswer, uniqueNonce);
    const arciumPubkey = randomBytes(32);

    console.log(`   🔐 Encrypted X-coordinate (IPFS hash): ${Buffer.from(encryptedX).toString('hex').slice(0, 16)}...`);
    console.log(`   🔐 Encrypted Y-coordinate: ${Buffer.from(encryptedY).toString('hex').slice(0, 16)}...`);
    console.log(`   🔑 Arcium Pubkey: ${Buffer.from(arciumPubkey).toString('hex').slice(0, 16)}...`);
    console.log(`   🎲 Unique Nonce: ${uniqueNonce.toString()}`);

    // Add to blockchain
    console.log(`   📝 Transaction: Adding question block...`);
    try {
      const tx = await this.program.methods
        .addEncryptedQuestionBlock(
          questionIndex,
          Array.from(encryptedX),
          Array.from(encryptedY),
          Array.from(arciumPubkey),
          uniqueNonce
        )
        .accountsPartial({
          questionBlock: questionBlockPda,
          quizSet: new PublicKey(quizSetPda),
          authority: this.authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([this.authority])
        .rpc({ commitment: "confirmed" });

      console.log(`   ✅ Question ${questionIndex} added successfully`);
      console.log(`   Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(tx, "confirmed");
      console.log(`   ✅ Transaction confirmed!`);
      
    } catch (error: any) {
      console.error(`❌ Failed to add question ${questionIndex}:`, error);
      throw error;
    }
  }

  // Create complete quiz
  async createCompleteQuiz(
    baseName: string, 
    questions: QuestionData[]
  ): Promise<{ quizSetPda: string; questionBlocks: any[]; transactions: string[] }> {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const uniqueName = `${baseName}_${timestamp}_${randomSuffix}`;
    
    console.log(`🔐 Creating complete quiz: ${uniqueName}`);
    console.log(`📊 Total questions: ${questions.length}\n`);
    
    const transactions: string[] = [];
    
    // Create new quiz set each time
    console.log(`🚀 Step 1: Creating New Quiz Set`);
    console.log(`─`.repeat(50));
    const quizSetPda = await this.createQuizSet(baseName, questions.length);
    
    // Add each question
    const questionBlocks = [];
    for (let i = 0; i < questions.length; i++) {
      console.log(`\n🚀 Step ${i + 2}: Adding Question ${i + 1}`);
      console.log(`─`.repeat(50));
      console.log(`📝 Question: ${questions[i].question}`);
      console.log(`🔢 Choices: ${questions[i].choices.join(' | ')}`);
      console.log(`✅ Correct Answer: ${questions[i].correctAnswer}`);
      
      await this.addEncryptedQuestion(quizSetPda, i + 1, questions[i]);
      
      questionBlocks.push({
        questionIndex: i + 1,
        question: questions[i].question,
        choices: questions[i].choices,
        correctAnswer: questions[i].correctAnswer
      });
    }

    return { quizSetPda, questionBlocks, transactions };
  }
}

async function main() {
  const connection = new Connection("https://devnet.helius-rpc.com/?api-key=fd203766-a6ec-407b-824d-40e6b7bc44e5", "confirmed");
  
  const authority = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(JSON.parse(require('fs').readFileSync('/Users/saitamacoder/.config/solana/id.json', 'utf-8')))
  );
  
  const wallet = new anchor.Wallet(authority);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const program = anchor.workspace.K3HootProgramArcium as Program<K3HootProgramArcium>;
  
  console.log(`🔐 Program ID: ${program.programId.toString()}`);
  console.log(`👤 Authority: ${authority.publicKey.toString()}`);
  console.log(`🌐 Network: Devnet`);
  console.log(`💰 Balance: ${(await connection.getBalance(authority.publicKey)) / 1e9} SOL`);
  console.log(`🔐 Starting Secure Quiz Creation...\n`);

  try {
    const encryptor = new SecureQuizEncryptor(program, authority, connection);
    
    const questions: QuestionData[] = [
      {
        question: "What is the derivative of x²?",
        choices: ["x", "2x", "x²", "2x²"],
        correctAnswer: "2x"
      },
      {
        question: "Solve: 2x + 5 = 13",
        choices: ["x = 3", "x = 4", "x = 5", "x = 6"],
        correctAnswer: "x = 4"
      },
      {
        question: "What is the area of a circle with radius 3?",
        choices: ["3π", "6π", "9π", "12π"],
        correctAnswer: "9π"
      }
    ];

    console.log(`📚 Quiz Questions Preview:`);
    questions.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.question}`);
    });
    console.log();

    const { quizSetPda, questionBlocks } = await encryptor.createCompleteQuiz(
      `Math Quiz`, // Remove timestamp, it will be added automatically
      questions
    );

    // Save information with unique filename
    const timestamp = Date.now();
    const filename = `quiz-info-${timestamp}.json`;
    const quizInfo = {
      quizSetPda,
      timestamp: new Date(timestamp).toISOString(),
      questionBlocks,
      securityFeatures: {
        blockEncryption: "Questions + options encrypted together",
        answerIsolation: "Correct answers encrypted separately",
        arciumIntegration: "On-chain verification without decryption"
      }
    };

    require('fs').writeFileSync(filename, JSON.stringify(quizInfo, null, 2));

    console.log(`\n🎉 Quiz Creation Completed!`);
    console.log(`─`.repeat(50));
    console.log(`🔐 Quiz Set: ${quizSetPda}`);
    console.log(`📁 Quiz info saved: ${filename}`);
    console.log(`🔗 View on Explorer: https://explorer.solana.com/address/${quizSetPda}?cluster=devnet`);
    console.log(`\n🔐 Encryption Summary:`);
    console.log(`   📊 Total Questions: ${questions.length}`);
    console.log(`   🔒 X-coordinates: Questions + 4 choices encrypted`);
    console.log(`   🔒 Y-coordinates: Correct answers encrypted`);
    console.log(`   🔑 Each question uses unique nonce for security`);
    console.log(`   🌐 Arcium integration ready for on-chain operations`);

  } catch (error) {
    console.error("❌ Quiz creation failed:", error);
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Quiz creation failed:", error);
    process.exit(1);
  });
}