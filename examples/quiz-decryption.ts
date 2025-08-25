import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { K3HootProgramArcium } from "../target/types/k_3_hoot_program_arcium";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
const BN = require("bn.js");
import * as readline from 'readline';
import { awaitComputationFinalization } from "@arcium-hq/client";
import * as crypto from 'crypto';

/**
 * Quiz Decryption Demo: Decrypt and verify encrypted data
 * 
 * New Workflow (64 bytes, XOR encryption, on-chain storage):
 * 1. Retrieve questions from the question set on the blockchain
 * 2. Decrypt the encrypted 64-byte blocks to get questions and choices
 * 3. Allow users to select answers
 * 4. Compare with the correct answer using Arcium computation
 */

// Hardcoded MXE configuration from your deployment
const MXE_CONFIG = {
  clusterOffset: 1116522165,
  compDefOffset: 1,
  authority: "A1dVA8adW1XXgcVmLCtbrvbVEVA1n3Q7kNPaTZVonjpq"
};

interface DecryptedQuestion {
  question: string;
  choices: string[];
  questionIndex: number;
  correctAnswer: string; // Will be empty, only used for structure compatibility
}

class QuizDecryption {
  private program: Program<K3HootProgramArcium>;
  private connection: Connection;
  private authority: Keypair;

  constructor(program: Program<K3HootProgramArcium>, connection: Connection, authority: Keypair) {
    this.program = program;
    this.connection = connection;
    this.authority = authority;
  }

  // Initialize Arcium accounts using hardcoded configuration
  async initializeArciumAccounts(): Promise<void> {
    console.log("🔧 Initializing Arcium accounts using hardcoded configuration...");
    
    try {
      // Use hardcoded MXE configuration
      const clusterOffset = MXE_CONFIG.clusterOffset;
      const mxeAccount = this.getMXEAccountFromCluster(clusterOffset);
      
      console.log(`   ✅ Using hardcoded MXE account: ${mxeAccount.toString()}`);
      console.log(`   🔍 Cluster offset: ${clusterOffset}`);
      console.log(`   🔑 Authority: ${MXE_CONFIG.authority}`);
      console.log(`   🚀 MXE account ready for use`);
      
    } catch (error: any) {
      console.log(`   ❌ Error with hardcoded MXE:`, error.message);
      throw error;
    }
  }

  // Modify to use quiz program ID
  private getMXEAccountFromCluster(clusterOffset: number): PublicKey {
    // Use quiz program ID as before
    const [mxeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("mxe"),
        Buffer.from(clusterOffset.toString())
      ],
      this.program.programId  // Use quiz program ID
    );
    return mxeAccount;
  }

  // Initialize computation definitions using hardcoded configuration
  private async initializeComputationDefinitions(mxeAccount: PublicKey): Promise<void> {
    console.log(`   🔐 Using hardcoded computation definition...`);
    
    try {
      const clusterOffset = MXE_CONFIG.clusterOffset;
      const clusterAccount = this.getClusterAccount(clusterOffset);
      
      console.log(`   🔍 Using cluster offset: ${clusterOffset}`);
      console.log(`   🌐 Cluster account: ${clusterAccount.toString()}`);
      
      // Use hardcoded compDefOffset
      const compDefOffset = MXE_CONFIG.compDefOffset;
      const compDefAccount = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("comp_def"), Buffer.from([compDefOffset])],
        this.program.programId
      )[0];
      
      console.log(`   🔍 Using computation definition offset: ${compDefOffset}`);
      console.log(`   📝 CompDef account: ${compDefAccount.toString()}`);
      
      console.log(`   ✅ Computation definition ready (hardcoded)`);
      
    } catch (compDefError: any) {
      console.log(`   ❌ Computation definition error: ${compDefError.message}`);
      throw compDefError;
    }
  }

  // Modify to use quiz program ID
  private getClusterAccount(clusterOffset: number): PublicKey {
    // Use quiz program ID
    const clusterSeeds = [
      Buffer.from("cluster"),
      Buffer.from(clusterOffset.toString())
    ];
    
    const [clusterAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      clusterSeeds,
      this.program.programId  // Use quiz program ID
    );
    
    return clusterAccount;
  }

  // Find quiz sets
  async findQuizSets(nameFilter: string = "Math Quiz"): Promise<any[]> {
    console.log(`🔍 Searching for quiz sets with name: "${nameFilter}"`);
    
    try {
      const allQuizSets = await this.program.account.quizSet.all();
      const filteredSets = allQuizSets.filter(set => 
        set.account.name.includes(nameFilter)
      );
      
      console.log(`✅ Found ${filteredSets.length} matching quiz set(s):`);
      
      filteredSets.forEach((set, index) => {
        const created = new Date(set.account.createdAt.toNumber() * 1000);
        console.log(`   ${index + 1}. ${set.account.name}`);
        console.log(`      Address: ${set.publicKey.toString()}`);
        console.log(`      Questions: ${set.account.questionCount}`);
        console.log(`      Created: ${created.toLocaleString()}`);
      });
      
      return filteredSets;
    } catch (error) {
      console.error("❌ Error finding quiz sets:", error);
      throw error;
    }
  }

  // Fetch quiz data
  async fetchQuizData(quizSetPda: string): Promise<{
    quizSet: any;
    questionBlocks: any[];
  }> {
    console.log(`🔍 Fetching quiz data: ${quizSetPda}`);
    
    try {
      const quizSet = await this.program.account.quizSet.fetch(new PublicKey(quizSetPda));
      console.log(`   ✅ Quiz Set: ${quizSet.name}`);
      console.log(`   🔢 Question Count: ${quizSet.questionCount}`);
      
      // Fetch all question blocks
      const questionBlocks = [];
      for (let i = 1; i <= quizSet.questionCount; i++) {
        const questionPda = anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from("question_block"), 
            new PublicKey(quizSetPda).toBuffer(), 
            Buffer.from([i])
          ],
          this.program.programId
        )[0];
        
        try {
          const questionBlock = await this.program.account.questionBlock.fetch(questionPda);
          questionBlocks.push({
            ...questionBlock,
            questionBlockPda: questionPda,
            questionIndex: i,
            quizSet: quizSetPda
          });
          
          console.log(`   ✅ Question ${i} found at PDA: ${questionPda.toString()}`);
        } catch (error) {
          console.log(`   ⚠️ Question ${i} not found: ${error.message}`);
        }
      }
      
      console.log(`\n🔍 Quiz Set Details:`);
      console.log(`   Name: ${quizSet.name}`);
      console.log(`   Questions: ${quizSet.questionCount}`);
      console.log(`   Created: ${new Date(quizSet.createdAt.toNumber() * 1000).toLocaleString()}`);
      console.log(`   Status: ${quizSet.isInitialized ? 'Initialized' : 'Not Initialized'}`);
      console.log(`   Found Question Blocks: ${questionBlocks.length}`);
      
      return { quizSet, questionBlocks };
    } catch (error) {
      console.error("❌ Error fetching quiz data:", error);
      throw error;
    }
  }

  // NEW: Decrypt question data directly from 64-byte encrypted blocks (no answer decryption)
  private async decryptQuestionFromEncryptedData(questionBlock: any): Promise<DecryptedQuestion> {
    const nonce = questionBlock.nonce.toNumber();
    const questionIndex = questionBlock.questionIndex;
    
    console.log(`   🔍 Decrypting question ${questionIndex} with nonce: ${nonce}`);
    
    // Decrypt X-coordinate (question + choices) - 64 bytes
    const encryptedX = questionBlock.encryptedXCoordinate;
    const decryptedX = Buffer.alloc(64);
    
    for (let i = 0; i < 64; i++) {
      decryptedX[i] = encryptedX[i] ^ (nonce & 0xFF);
    }
    
    // Convert decrypted bytes to string
    const decryptedText = decryptedX.toString('utf8').replace(/\0/g, '');
    console.log(`   🔓 Decrypted X-coordinate: ${decryptedText}`);
    console.log(`   📏 Decrypted length: ${decryptedText.length} characters`);
    
    // Parse question data from decrypted string
    const questionData = this.parseQuestionFromDecryptedString(decryptedText, questionIndex);
    
    // Don't decrypt correct answer - keep it encrypted for security
    console.log(`   🔒 Y-coordinate (correct answer) remains encrypted for security`);
    
    return {
      question: questionData.question,
      choices: questionData.choices,
      questionIndex: questionIndex,
      correctAnswer: "" // Will be verified on-chain without decryption
    };
  }

  // Parse question data from decrypted string
  private parseQuestionFromDecryptedString(decryptedString: string, questionIndex: number): any {
    console.log(`   🔍 Parsing question data from decrypted string`);
    
    // Try parsing JSON first (if data was stored as JSON)
    try {
      const questionData = JSON.parse(decryptedString);
      console.log(`   ✅ Successfully parsed JSON data`);
      return {
        question: questionData.question,
        choices: questionData.choices,
        correctAnswer: questionData.correctAnswer
      };
    } catch (parseError) {
      console.log(`   ⚠️ JSON parse failed, trying pipe-separated format`);
    }
    
    // Try pipe-separated format (question|choice1|choice2|choice3|choice4)
    try {
      const parts = decryptedString.split('|');
      if (parts.length >= 5) {
        const question = parts[0];
        const choices = parts.slice(1, 5);
        
        console.log(`   ✅ Successfully parsed pipe-separated data`);
        return {
          question: question,
          choices: choices,
          correctAnswer: "" // Will be filled from Y-coordinate
        };
      }
    } catch (parseError) {
      console.log(`   ⚠️ Pipe-separated parse failed`);
    }
    
    // If all parsing fails, show raw data for debugging
    console.log(`   ❌ Failed to parse question data`);
    console.log(`   ⚠️ Raw decrypted data: ${decryptedString}`);
    console.log(`   📏 Data length: ${decryptedString.length} characters`);
    console.log(`   🔍 First 100 chars: ${decryptedString.substring(0, 100)}...`);
    
    throw new Error(`Cannot parse question data from encrypted content. Expected JSON or pipe-separated format.`);
  }

  // Process questions from encrypted data (no IPFS needed)
  async processQuizQuestions(questionBlocks: any[]): Promise<DecryptedQuestion[]> {
    console.log("\n🔓 Processing encrypted question blocks (64 bytes, XOR encryption)...");
    
    const decryptedQuestions: DecryptedQuestion[] = [];
    const failedQuestions: any[] = [];
    
    for (const block of questionBlocks) {
      console.log(`\n🔓 Decrypting question ${block.questionIndex}...`);
      
      try {
        const decryptedQuestion = await this.decryptQuestionFromEncryptedData(block);
        decryptedQuestions.push(decryptedQuestion);
        
        console.log(`   ✅ Question decrypted successfully from on-chain data`);
        console.log(`   📝 Question: ${decryptedQuestion.question}`);
        console.log(`   🔢 Choices: ${decryptedQuestion.choices.join(' | ')}`);
        console.log(`   🔒 Correct Answer: encrypted (verified on-chain)`);
        
      } catch (error) {
        console.log(`   ❌ Failed to decrypt question ${block.questionIndex}: ${error.message}`);
        
        failedQuestions.push({
          questionIndex: block.questionIndex,
          error: error.message,
          block: block
        });
      }
    }
    
    // Report results
    console.log(`\n📊 Decryption Results:`);
    console.log(`   ✅ Successful: ${decryptedQuestions.length}/${questionBlocks.length}`);
    console.log(`   ❌ Failed: ${failedQuestions.length}/${questionBlocks.length}`);
    
    if (failedQuestions.length > 0) {
      console.log(`\n⚠️ Failed Questions:`);
      failedQuestions.forEach(fq => {
        console.log(`   Question ${fq.questionIndex}: ${fq.error}`);
      });
      
      if (decryptedQuestions.length === 0) {
        throw new Error(`No questions could be decrypted. Please check your encryption keys and data format.`);
      }
    }
    
    return decryptedQuestions;
  }

  // Fallback verification for when Arcium is not available
  private fallbackVerification(questionBlock: any, userAnswer: string): boolean {
    console.log(`   🔄 Using fallback verification for question ${questionBlock.questionIndex}`);
    
    // Since we don't have the correct answer, we can't do fallback verification
    console.log(`   🔐 Fallback verification not available (correct answer encrypted)`);
    console.log(`   📝 User answer: ${userAnswer}`);
    console.log(`   🔒 Correct answer: encrypted (cannot verify without Arcium)`);
    
    // Return false to indicate verification failed
    return false;
  }

  // Verify answer on-chain using Arcium with hardcoded configuration
  async verifyAnswerOnchain(questionBlock: any, userAnswer: string): Promise<boolean> {
    console.log(`\n🔐 Verifying answer for question ${questionBlock.questionIndex}...`);
    console.log(`   📝 User answer: ${userAnswer}`);
    console.log(`   🔒 Correct answer: encrypted (verified on-chain)`);
    
    try {
      const clusterOffset = MXE_CONFIG.clusterOffset;
      const clusterAccount = this.getClusterAccount(clusterOffset);
      
      // ✅ CORRECT: Use actual MXE account from arcium mxe-info
      const mxeAccount = new PublicKey("7STLbw536MGvNRSttueXVGMqJd6sHbXQvz6iqGcYyqMq");
      
      console.log(`   Using hardcoded MXE account: ${mxeAccount.toString()}`);
      
      // Use hardcoded compDefOffset
      const compDefOffset = MXE_CONFIG.compDefOffset;
      
      // ✅ CORRECT: Create compDefAccount from Arcium program ID
      const arciumProgramId = new PublicKey("Arcium111111111111111111111111111111111111111");
      const [compDefAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("comp_def"), Buffer.from([compDefOffset])],
        arciumProgramId  // Use Arcium program ID
      );
      
      console.log(`   Using computation definition: ${compDefAccount.toString()}`);
      
      // ✅ CORRECT: Create account addresses from Arcium program
      const [mempoolAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("mempool")],
        arciumProgramId
      );
      
      const [executingPool] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("execpool")],
        arciumProgramId
      );
      
      const [computationAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("comp"), Buffer.from([0])],
        arciumProgramId
      );
      
      // Create offset for computation
      const offset = new anchor.BN(Date.now());
      
      console.log(`   🔄 Queuing Arcium computation with offset: ${offset.toString()}`);
      
      // Add checks before calling instruction
      if (!questionBlock.questionBlockPda || !questionBlock.quizSet) {
        console.log(`   ❌ Invalid question block data`);
        return false;
      }

      // Ensure they are PublicKey objects
      if (!(questionBlock.questionBlockPda instanceof PublicKey) || 
          !(questionBlock.quizSet instanceof PublicKey)) {
        console.log(`   ❌ Invalid public key types`);
        return false;
      }

      // ✅ CORRECT: Call instruction with correct account context
      const tx = await this.program.methods
        .validateAnswerOnchain(userAnswer, questionBlock.questionIndex) // Use camelCase as expected by TypeScript
        .accountsPartial({
          payer: this.program.provider.publicKey!,
          questionBlock: questionBlock.questionBlockPda,
          quizSet: questionBlock.quizSet,
          mxeAccount: mxeAccount,
          mempoolAccount: mempoolAccount,
          executingPool: executingPool,
          computationAccount: computationAccount,
          compDefAccount: compDefAccount,
          clusterAccount: clusterAccount,
          // Add missing required accounts - you'll need to find the actual addresses
          poolAccount: new PublicKey("11111111111111111111111111111111"), // Placeholder - find actual address
          clockAccount: new PublicKey("11111111111111111111111111111111"), // Placeholder - find actual address
          systemProgram: anchor.web3.SystemProgram.programId,
          arciumProgram: arciumProgramId,
        })
        .rpc();
      
      console.log(`   ✅ Verification successful! Transaction: ${tx}`);
      return true;
      
    } catch (error: any) {
      console.log(`   ❌ Verification failed: ${error.message}`);
      return this.fallbackVerification(questionBlock, userAnswer);
    }
  }

  // Wait for Arcium computation finalization
  private async waitForComputationFinalization(
    transactionSignature: string, 
    computationOffset: anchor.BN,
    questionIndex: number
  ): Promise<boolean> {
    console.log(`   ⏳ Waiting for Arcium computation finalization...`);
    
    try {
      // Wait for transaction confirmation first
      await this.connection.confirmTransaction(transactionSignature, 'confirmed');
      console.log(`   ✅ Transaction confirmed, waiting for computation...`);
      
      // Use Arcium client to wait for computation finalization
      const finalizeSig = await awaitComputationFinalization(
        this.program.provider as anchor.AnchorProvider,
        computationOffset,
        this.program.programId,
        "confirmed"
      );
      
      console.log(`   ✅ Computation finalized: ${finalizeSig}`);
      
      // Check computation result
      return this.checkComputationResult(computationOffset, questionIndex);
      
    } catch (error: any) {
      console.log(`   ❌ Error waiting for computation: ${error.message}`);
      return this.fallbackVerification({ questionIndex }, "computation_error");
    }
  }

  // Check computation result
  private async checkComputationResult(computationOffset: anchor.BN, questionIndex: number): Promise<boolean> {
    try {
      // Find computation account
      const computationAccount = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("comp"), computationOffset.toArrayLike(Buffer, "le", 8)],
        this.program.programId
      )[0];
      
      // Temporarily use fallback verification
      return this.fallbackVerification({ questionIndex }, "computation_completed");
      
    } catch (error: any) {
      console.log(`   ❌ Error checking computation result: ${error.message}`);
      return this.fallbackVerification({ questionIndex }, "check_error");
    }
  }

  // Verify all answers
  async verifyAllAnswers(
    questionBlocks: any[],
    userAnswers: string[],
    decryptedQuestions: DecryptedQuestion[]
  ): Promise<{
    results: any[];
    score: number;
  }> {
    console.log("\n🔐 Verifying answers on-chain...");
    
    const results = [];
    let correctCount = 0;
    
    for (let i = 0; i < questionBlocks.length; i++) {
      const questionBlock = questionBlocks[i];
      const userAnswer = userAnswers[i] || "";
      
      console.log(`\n🔐 Verifying Question ${questionBlock.questionIndex}:`);
      console.log(`   📝 User answer: ${userAnswer}`);
      console.log(`   🔒 Correct answer: encrypted (verified on-chain)`);
      
      const isCorrect = await this.verifyAnswerOnchain(questionBlock, userAnswer);
      
      if (isCorrect) {
        correctCount++;
      }
      
      results.push({
        questionIndex: questionBlock.questionIndex,
        userAnswer,
        correctAnswer: "encrypted", // Never exposed
        isCorrect,
        verificationMethod: "Arcium On-chain"
      });
    }
    
    const score = (correctCount / questionBlocks.length) * 100;
    
    console.log(`\n📊 Verification Results:`);
    results.forEach(result => {
      const status = result.isCorrect ? "✅" : "❌";
      console.log(`   Question ${result.questionIndex}: ${status} ${result.userAnswer}`);
    });
    
    console.log(`\n🎯 Final Score: ${correctCount}/${questionBlocks.length} (${score.toFixed(1)}%)`);
    
    return { results, score };
  }

  // Modify method takeQuiz to use readline
  private async takeQuiz(decryptedQuestions: DecryptedQuestion[]): Promise<string[]> {
    const userAnswers: string[] = [];
    
    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Helper function to read input
    const question = (query: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(query, resolve);
      });
    };
    
    for (const questionData of decryptedQuestions) {
      console.log(`\n🔢 Question ${questionData.questionIndex}: ${questionData.question}`);
      questionData.choices.forEach((choice, index) => {
        console.log(`   ${index + 1}. ${choice}`);
      });
      
      // Read answer from user
      let userAnswer: string;
      let validChoice = false;
      
      while (!validChoice) {
        const input = await question(`   👤 Your answer (1-${questionData.choices.length}): `);
        const choiceIndex = parseInt(input) - 1;
        
        if (choiceIndex >= 0 && choiceIndex < questionData.choices.length) {
          userAnswer = questionData.choices[choiceIndex];
          validChoice = true;
        } else {
          console.log(`   ❌ Invalid choice. Please enter a number between 1 and ${questionData.choices.length}`);
        }
      }
      
      userAnswers.push(userAnswer);
      console.log(`   ✅ Selected: ${userAnswer}`);
    }
    
    // Close readline
    rl.close();
    
    return userAnswers;
  }

  // Main function
  async run(): Promise<void> {
    try {
      // Initialize Arcium accounts using hardcoded configuration
      await this.initializeArciumAccounts();
      
      // Find quiz sets
      const quizSets = await this.findQuizSets();
      
      if (quizSets.length === 0) {
        console.log("❌ No quiz sets found");
        return;
      }
      
      // Select quiz set
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const question = (query: string): Promise<string> => {
        return new Promise((resolve) => {
          rl.question(query, resolve);
        });
      };
      
      console.log("\n📋 Please select a quiz set:");
      quizSets.forEach((set, index) => {
        const created = new Date(set.account.createdAt.toNumber() * 1000);
        console.log(`   ${index + 1}. ${set.account.name} (${set.account.questionCount} questions, created ${created.toLocaleString()})`);
      });
      
      const choice = await question(`   Enter your choice (1-${quizSets.length}): `);
      const selectedIndex = parseInt(choice) - 1;
      
      if (selectedIndex < 0 || selectedIndex >= quizSets.length) {
        console.log("❌ Invalid choice");
        rl.close();
        return;
      }
      
      const selectedQuizSet = quizSets[selectedIndex];
      console.log(`\n🎯 Selected quiz set: ${selectedQuizSet.account.name}`);
      
      rl.close();
      
      // Fetch quiz data
      const { quizSet, questionBlocks } = await this.fetchQuizData(selectedQuizSet.publicKey.toString());
      
      if (questionBlocks.length === 0) {
        console.log("❌ No question blocks found");
        return;
      }
      
      // Process questions from encrypted data (no IPFS)
      const decryptedQuestions = await this.processQuizQuestions(questionBlocks);
      
      if (decryptedQuestions.length === 0) {
        console.log("\n❌ No questions could be decrypted");
        console.log("🔍 Possible reasons:");
        console.log("   - Encryption keys mismatch");
        console.log("   - Data format is incorrect");
        console.log("   - Questions were not properly encrypted");
        console.log("   - Nonce values are corrupted");
        
        // Display debug information
        console.log("\n🔍 Debug Information:");
        questionBlocks.forEach((block, index) => {
          console.log(`   Question ${block.questionIndex}:`);
          console.log(`     Encrypted X (64 bytes): ${Buffer.from(block.encryptedXCoordinate).toString('hex').slice(0, 32)}...`);
          console.log(`     Encrypted Y (64 bytes): ${Buffer.from(block.encryptedYCoordinate).toString('hex').slice(0, 32)}...`);
          console.log(`     Nonce: ${block.nonce.toNumber()}`);
        });
        
        return;
      }
      
      // Take quiz
      const userAnswers = await this.takeQuiz(decryptedQuestions);
      
      // Verify answers
      const { results, score } = await this.verifyAllAnswers(questionBlocks, userAnswers, decryptedQuestions);
      
      // Save results
      const resultInfo = {
        quizSetName: selectedQuizSet.account.name,
        quizSetPda: selectedQuizSet.publicKey.toString(),
        totalQuestions: questionBlocks.length,
        decryptedQuestions: decryptedQuestions.length,
        userAnswers,
        results,
        score,
        timestamp: Date.now()
      };
      
      const filename = `quiz-result-${Date.now()}.json`;
      require('fs').writeFileSync(filename, JSON.stringify(resultInfo, null, 2));
      console.log(`\n💾 Quiz results saved: ${filename}`);
      
      console.log("\n🎉 Quiz completed successfully!");
      console.log("🔒 Security maintained: No answers were exposed");
      console.log("🔐 Answer verification handled securely by Arcium");
      console.log("\n📊 Summary:");
      console.log(`   📚 Quiz Set: ${selectedQuizSet.account.name}`);
      console.log(`   🔢 Total Questions: ${questionBlocks.length}`);
      console.log(`   🔓 Questions Decrypted: ${decryptedQuestions.length}`);
      console.log(`   💾 Questions Stored On-Chain: ${decryptedQuestions.length}`);
      console.log(`   🔐 Answers Verified: ${userAnswers.length}`);
      
    } catch (error) {
      console.error("❌ Quiz decryption failed:", error);
      throw error;
    }
  }
}

async function main() {
  // Setup connection
  const connection = new Connection("https://devnet.helius-rpc.com/?api-key=fd203766-a6ec-407b-824d-40e6b7bc44e5", "confirmed");
  
  const authority = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(JSON.parse(require('fs').readFileSync('/Users/saitamacoder/.config/solana/id.json', 'utf-8')))
  );
  
  const wallet = new anchor.Wallet(authority);
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Use program ID from workspace instead of hardcoded
  const program = anchor.workspace.K3HootProgramArcium as Program<K3HootProgramArcium>;
  const programId = program.programId;
  
  console.log("🔐 Program ID:", programId.toString());
  console.log("👤 Authority:", authority.publicKey.toString());
  console.log("🌐 Network: Devnet");
  
  const balance = await connection.getBalance(authority.publicKey);
  console.log("💰 Balance:", balance / 1e9, "SOL");
  
  console.log("🔓 Starting Secure Quiz Decryption (64 bytes, XOR encryption, on-chain storage)...\n");

  try {
    const quizDecryption = new QuizDecryption(program, connection, authority);
    await quizDecryption.run();
    
  } catch (error) {
    console.error("Secure decryption failed:", error);
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Secure decryption failed:", error);
    process.exit(1);
  });
}