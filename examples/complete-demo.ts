import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { K3HootProgramArcium } from "../target/types/k_3_hoot_program_arcium";
import { PublicKey, Keypair, Connection, Commitment } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Complete System Demo
 * 
 * Demonstrates the entire quiz ecosystem:
 * 1. Topic Management
 * 2. Quiz Creation with Topic Integration
 * 3. Scoring System
 * 4. Leaderboard System
 */

interface QuestionData {
  question: string;
  choices: string[];
  correctAnswer: string;
}

class CompleteSystemDemo {
  private program: Program<K3HootProgramArcium>;
  private connection: Connection;
  private authority: Keypair;

  constructor(program: Program<K3HootProgramArcium>, connection: Connection, authority: Keypair) {
    this.program = program;
    this.connection = connection;
    this.authority = authority;
  }

  // Step 1: Create topics
  async createTopics(): Promise<string[]> {
    console.log(`\n🚀 Step 1: Creating Topics`);
    console.log(`─`.repeat(50));

    const topics = ["Mathematics", "Science", "History", "Programming"];
    const createdTopics: string[] = [];

    for (const topicName of topics) {
      try {
        console.log(`\n📝 Creating topic: "${topicName}"`);
        
        const [topicPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("topic"), Buffer.from(topicName)],
          this.program.programId
        );

        const tx = await this.program.methods
          .createTopic(topicName)
          .accountsPartial({
            topic: topicPda,
            owner: this.authority.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([this.authority])
          .rpc({ commitment: "confirmed" });

        await this.connection.confirmTransaction(tx, "confirmed");
        console.log(`   ✅ Topic "${topicName}" created successfully`);
        createdTopics.push(topicName);
        
      } catch (error: any) {
        if (error.message.includes("already in use")) {
          console.log(`   ℹ️ Topic "${topicName}" already exists`);
          createdTopics.push(topicName);
        } else {
          console.error(`   ❌ Failed to create topic "${topicName}":`, error);
        }
      }
    }

    console.log(`\n✅ Topics setup completed: ${createdTopics.length}/${topics.length} topics ready`);
    return createdTopics;
  }

  // Step 2: Create sample quiz sets
  async createQuizSets(topics: string[]): Promise<string[]> {
    console.log(`\n🚀 Step 2: Creating Sample Quiz Sets`);
    console.log(`─`.repeat(50));

    const quizSets: string[] = [];

    // Mathematics quizzes
    if (topics.includes("Mathematics")) {
      const mathQuizzes = [
        {
          name: "Basic Algebra",
          questions: [
            {
              question: "What is 2x + 5 = 13?",
              choices: ["x = 3", "x = 4", "x = 5", "x = 6"],
              correctAnswer: "x = 4"
            },
            {
              question: "What is the derivative of x²?",
              choices: ["x", "2x", "x²", "2x²"],
              correctAnswer: "2x"
            },
            {
              question: "What is √16?",
              choices: ["2", "4", "8", "16"],
              correctAnswer: "4"
            }
          ]
        },
        {
          name: "Geometry Basics",
          questions: [
            {
              question: "Area of circle with radius 3?",
              choices: ["3π", "6π", "9π", "12π"],
              correctAnswer: "9π"
            },
            {
              question: "Sum of angles in triangle?",
              choices: ["90°", "180°", "270°", "360°"],
              correctAnswer: "180°"
            },
            {
              question: "Pythagorean theorem: a² + b² = ?",
              choices: ["c", "c²", "2c", "c³"],
              correctAnswer: "c²"
            }
          ]
        }
      ];

      for (const quiz of mathQuizzes) {
        const quizSetPda = await this.createQuizSet("Mathematics", quiz.name, quiz.questions);
        if (quizSetPda) quizSets.push(quizSetPda);
      }
    }

    // Science quizzes
    if (topics.includes("Science")) {
      const scienceQuizzes = [
        {
          name: "Basic Chemistry",
          questions: [
            {
              question: "Chemical symbol for gold?",
              choices: ["Go", "Gd", "Au", "Ag"],
              correctAnswer: "Au"
            },
            {
              question: "Number of protons in carbon?",
              choices: ["4", "6", "8", "12"],
              correctAnswer: "6"
            },
            {
              question: "pH of pure water?",
              choices: ["0", "7", "14", "1"],
              correctAnswer: "7"
            }
          ]
        }
      ];

      for (const quiz of scienceQuizzes) {
        const quizSetPda = await this.createQuizSet("Science", quiz.name, quiz.questions);
        if (quizSetPda) quizSets.push(quizSetPda);
      }
    }

    console.log(`\n✅ Quiz sets creation completed: ${quizSets.length} quiz sets created`);
    return quizSets;
  }

  // Helper: Create a single quiz set
  async createQuizSet(topicName: string, quizName: string, questions: QuestionData[]): Promise<string | null> {
    try {
      console.log(`\n📝 Creating quiz: "${quizName}" in topic "${topicName}"`);

      // Generate unique ID
      const uniqueId = Math.floor(Math.random() * 256);
      const timestamp = Date.now();
      const uniqueName = `${quizName}_${timestamp}`;

      // Get PDAs
      const [quizSetPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("quiz_set"), this.authority.publicKey.toBuffer(), Buffer.from([uniqueId])],
        this.program.programId
      );

      const [topicPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("topic"), Buffer.from(topicName)],
        this.program.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), quizSetPda.toBuffer()],
        this.program.programId
      );

      // Create quiz set
      const rewardAmount = 0.05 * 1_000_000_000; // 0.05 SOL in lamports
      const tx = await this.program.methods
        .createQuizSet(uniqueName, questions.length, uniqueId, new BN(rewardAmount))
        .accountsPartial({
          quizSet: quizSetPda,
          topic: topicPda,
          vault: vaultPda,
          authority: this.authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([this.authority])
        .rpc({ commitment: "confirmed" });

      await this.connection.confirmTransaction(tx, "confirmed");

      // Add questions
      for (let i = 0; i < questions.length; i++) {
        await this.addQuestion(quizSetPda.toString(), i + 1, questions[i]);
      }

      console.log(`   ✅ Quiz "${quizName}" created with ${questions.length} questions`);
      return quizSetPda.toString();

    } catch (error: any) {
      console.error(`   ❌ Failed to create quiz "${quizName}":`, error);
      return null;
    }
  }

  // Helper: Add encrypted question
  async addQuestion(quizSetPda: string, questionIndex: number, questionData: QuestionData): Promise<void> {
    const [questionBlockPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("question_block"),
        new PublicKey(quizSetPda).toBuffer(),
        Buffer.from([questionIndex])
      ],
      this.program.programId
    );

    // Simple XOR encryption for demo
    const nonce = Date.now() + questionIndex;
    const combinedText = `${questionData.question}|${questionData.choices.join('|')}`;
    
    // Encrypt question data (X-coordinate)
    const encryptedX = Buffer.alloc(64, 0);
    const textBytes = Buffer.from(combinedText, 'utf8');
    const copyLength = Math.min(textBytes.length, 64);
    textBytes.copy(encryptedX, 0, 0, copyLength);
    
    for (let i = 0; i < 64; i++) {
      encryptedX[i] = encryptedX[i] ^ (nonce & 0xFF);
    }

    // Encrypt correct answer (Y-coordinate)
    const encryptedY = Buffer.alloc(64, 0);
    const answerBytes = Buffer.from(questionData.correctAnswer, 'utf8');
    const answerLength = Math.min(answerBytes.length, 64);
    answerBytes.copy(encryptedY, 0, 0, answerLength);
    
    for (let i = 0; i < 64; i++) {
      encryptedY[i] = encryptedY[i] ^ (nonce & 0xFF);
    }

    const arciumPubkey = Buffer.alloc(32, 0); // Dummy for demo

    const tx = await this.program.methods
      .addEncryptedQuestionBlock(
        questionIndex,
        Array.from(encryptedX),
        Array.from(encryptedY),
        Array.from(arciumPubkey),
        new BN(nonce)
      )
      .accountsPartial({
        questionBlock: questionBlockPda,
        quizSet: new PublicKey(quizSetPda),
        authority: this.authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([this.authority])
      .rpc({ commitment: "confirmed" });

    await this.connection.confirmTransaction(tx, "confirmed");
  }

  // Step 3: Simulate quiz completions
  async simulateQuizCompletions(quizSets: string[]): Promise<void> {
    console.log(`\n🚀 Step 3: Simulating Quiz Completions`);
    console.log(`─`.repeat(50));

    // Simulate different users completing quizzes
    const simulatedUsers = [
      { name: "Alice", winRate: 0.8 },
      { name: "Bob", winRate: 0.6 },
      { name: "Charlie", winRate: 0.9 },
      { name: "Diana", winRate: 0.7 },
    ];

    for (let userIndex = 0; userIndex < simulatedUsers.length; userIndex++) {
      const user = simulatedUsers[userIndex];
      console.log(`\n👤 Simulating completions for ${user.name} (Win Rate: ${user.winRate * 100}%)`);

      // Use authority as the user for demo (in real app, each would have their own wallet)
      for (let quizIndex = 0; quizIndex < Math.min(quizSets.length, 3); quizIndex++) {
        const quizSetPda = quizSets[quizIndex];
        
        try {
          const quizSet = await this.program.account.quizSet.fetch(new PublicKey(quizSetPda));
          const topic = await this.program.account.topic.fetch(quizSet.topic);
          
          // Simulate quiz result
          const totalQuestions = quizSet.questionCount;
          const isWinner = Math.random() < user.winRate;
          const score = isWinner ? totalQuestions : Math.floor(Math.random() * totalQuestions);
          const rewardAmount = isWinner ? quizSet.rewardAmount.toNumber() : 0;

          console.log(`   📝 Quiz: ${quizSet.name.split('_')[0]} - Score: ${score}/${totalQuestions} - ${isWinner ? 'Won' : 'Lost'}`);

          // Record completion
          await this.recordQuizCompletion(
            quizSetPda,
            quizSet.topic,
            isWinner,
            score,
            totalQuestions,
            rewardAmount
          );

        } catch (error) {
          console.error(`   ❌ Failed to simulate completion for quiz ${quizIndex}:`, error);
        }
      }
    }

    console.log(`\n✅ Quiz completion simulation completed`);
  }

  // Helper: Record quiz completion
  async recordQuizCompletion(
    quizSetPda: string,
    topicPda: PublicKey,
    isWinner: boolean,
    score: number,
    totalQuestions: number,
    rewardAmount: number
  ): Promise<void> {
    try {
      // Derive PDAs
      const [userScorePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_score"), this.authority.publicKey.toBuffer(), topicPda.toBuffer()],
        this.program.programId
      );

      const timestamp = Math.floor(Date.now() / 1000);
      const [quizHistoryPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("quiz_history"),
          this.authority.publicKey.toBuffer(),
          new PublicKey(quizSetPda).toBuffer(),
          new BN(timestamp).toArrayLike(Buffer, "le", 8)
        ],
        this.program.programId
      );

      const tx = await this.program.methods
        .recordQuizCompletion(new BN(timestamp), isWinner, score, totalQuestions, new BN(rewardAmount))
        .accountsPartial({
          userScore: userScorePda,
          quizHistory: quizHistoryPda,
          quizSet: new PublicKey(quizSetPda),
          topic: topicPda,
          user: this.authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([this.authority])
        .rpc({ commitment: "confirmed" });

      await this.connection.confirmTransaction(tx, "confirmed");

    } catch (error: any) {
      if (!error.message.includes("already in use")) {
        throw error;
      }
      // Quiz history already recorded, skip
    }
  }

  // Step 4: Display leaderboards
  async displayLeaderboards(): Promise<void> {
    console.log(`\n🚀 Step 4: Displaying Leaderboards`);
    console.log(`─`.repeat(50));

    try {
      // Get all topics
      const topics = await this.program.account.topic.all();
      
      for (const topicAccount of topics) {
        const topicName = topicAccount.account.name;
        console.log(`\n🏆 Leaderboard for "${topicName}":`);
        console.log(`─`.repeat(30));

        // Get user scores for this topic
        const userScores = await this.program.account.userScore.all([
          {
            memcmp: {
              offset: 8 + 32, // Skip discriminator and user pubkey
              bytes: topicAccount.publicKey.toBase58(),
            }
          }
        ]);

        if (userScores.length === 0) {
          console.log(`   No participants yet`);
          continue;
        }

        // Sort by score
        const leaderboard = userScores
          .sort((a, b) => b.account.score - a.account.score)
          .slice(0, 10);

        leaderboard.forEach((entry, index) => {
          const winRate = entry.account.totalCompleted > 0 ? 
            (entry.account.score / entry.account.totalCompleted) * 100 : 0;
          
          console.log(`   ${index + 1}. ${entry.account.user.toString().slice(0, 8)}... - ` +
                     `Score: ${entry.account.score}, Win Rate: ${winRate.toFixed(1)}%, ` +
                     `Completed: ${entry.account.totalCompleted}, ` +
                     `Rewards: ${entry.account.totalRewards.toNumber() / 1e9} SOL`);
        });
      }

      // Global leaderboard
      console.log(`\n🌍 Global Leaderboard:`);
      console.log(`─`.repeat(30));

      const allUserScores = await this.program.account.userScore.all();
      const userStatsMap = new Map();

      // Aggregate scores by user
      for (const userScore of allUserScores) {
        const userKey = userScore.account.user.toString();
        if (!userStatsMap.has(userKey)) {
          userStatsMap.set(userKey, {
            user: userScore.account.user,
            totalScore: 0,
            totalCompleted: 0,
            totalRewards: 0
          });
        }
        
        const stats = userStatsMap.get(userKey);
        stats.totalScore += userScore.account.score;
        stats.totalCompleted += userScore.account.totalCompleted;
        stats.totalRewards += userScore.account.totalRewards;
      }

      const globalLeaderboard = Array.from(userStatsMap.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10);

      if (globalLeaderboard.length === 0) {
        console.log(`   No global participants yet`);
      } else {
        globalLeaderboard.forEach((entry, index) => {
          const globalWinRate = entry.totalCompleted > 0 ? 
            (entry.totalScore / entry.totalCompleted) * 100 : 0;
          
          console.log(`   ${index + 1}. ${entry.user.toString().slice(0, 8)}... - ` +
                     `Total Score: ${entry.totalScore}, Win Rate: ${globalWinRate.toFixed(1)}%, ` +
                     `Completed: ${entry.totalCompleted}, Rewards: ${entry.totalRewards / 1e9} SOL`);
        });
      }

    } catch (error) {
      console.error("❌ Error displaying leaderboards:", error);
    }
  }

  // Main demo workflow
  async runCompleteDemo(): Promise<void> {
    console.log(`\n🎯 Complete Quiz Ecosystem Demo`);
    console.log(`═`.repeat(60));
    console.log(`This demo showcases the full quiz ecosystem:`);
    console.log(`• Topic-based quiz organization`);
    console.log(`• Anti-gaming measures (topic ownership)`);
    console.log(`• Comprehensive scoring system`);
    console.log(`• Multi-topic leaderboards`);
    console.log(`• Complete audit trail`);
    console.log(`═`.repeat(60));

    try {
      // Step 1: Create topics
      const topics = await this.createTopics();

      // Step 2: Create quiz sets
      const quizSets = await this.createQuizSets(topics);

      // Step 3: Simulate quiz completions
      if (quizSets.length > 0) {
        await this.simulateQuizCompletions(quizSets);
      }

      // Step 4: Display leaderboards
      await this.displayLeaderboards();

      console.log(`\n🎉 Complete Demo Finished Successfully!`);
      console.log(`─`.repeat(50));
      console.log(`📊 System Overview:`);
      console.log(`   • Topics: ${topics.length} created`);
      console.log(`   • Quiz Sets: ${quizSets.length} created`);
      console.log(`   • Anti-gaming: Topic ownership prevents self-farming`);
      console.log(`   • Minimum requirements: 3 questions, 0.01 SOL reward`);
      console.log(`   • Scoring: Win-based points with complete history`);
      console.log(`   • Leaderboards: Topic-specific and global rankings`);
      console.log(`\n💡 Next Steps:`);
      console.log(`   • Use examples/topic-management.ts to manage topics`);
      console.log(`   • Use examples/quiz-encryption.ts to create quizzes`);
      console.log(`   • Use examples/quiz-decryption.ts to take quizzes`);
      console.log(`   • Use examples/leaderboard.ts to view rankings`);

    } catch (error) {
      console.error("❌ Complete demo failed:", error);
      throw error;
    }
  }
}

async function main() {
  // Get configuration from environment
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const network = process.env.SOLANA_NETWORK || "devnet";
  const commitment = process.env.COMMITMENT || "confirmed";
  
  // Setup connection using environment variables
  const connection = new Connection(rpcUrl, commitment as Commitment);
  
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

  // Use program ID from workspace
  const program = anchor.workspace.K3HootProgramArcium as Program<K3HootProgramArcium>;
  
  console.log("🔐 Program ID:", program.programId.toString());
  console.log("👤 Authority:", authority.publicKey.toString());
  console.log("🌐 Network: Devnet");
  
  const balance = await connection.getBalance(authority.publicKey);
  console.log("💰 Balance:", balance / 1e9, "SOL");

  try {
    const demo = new CompleteSystemDemo(program, connection, authority);
    
    // Run the complete demo
    await demo.runCompleteDemo();
    
  } catch (error) {
    console.error("Complete demo failed:", error);
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Complete demo failed:", error);
    process.exit(1);
  });
}
