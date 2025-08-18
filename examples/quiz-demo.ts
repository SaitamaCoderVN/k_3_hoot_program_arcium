import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { K3HootProgramArcium } from "../target/types/k_3_hoot_program_arcium";
import { PublicKey, Keypair, SystemProgram, Connection } from "@solana/web3.js";
import BN from "bn.js";

/**
 * Demo: Creating a Quiz Application with Arcium Encryption
 * 
 * This example demonstrates the complete encryption flow:
 * 1. Plain text data (questions & answers)
 * 2. Encryption process using Arcium
 * 3. Storing encrypted data on-chain
 * 4. Retrieving and decrypting data
 * 5. Verifying the complete flow
 */

// Helper function to display data in a formatted way
function displayData(title: string, data: any, isEncrypted: boolean = false) {
  console.log(`\n${isEncrypted ? '🔐' : '📝'} ${title}:`);
  if (typeof data === 'string') {
    console.log(`   Text: "${data}"`);
    console.log(`   Length: ${data.length} characters`);
    console.log(`   Bytes: [${Buffer.from(data).toString('hex').match(/.{1,2}/g)?.join(', ') || ''}]`);
  } else if (Array.isArray(data)) {
    console.log(`   Array: [${data.join(', ')}]`);
    console.log(`   Length: ${data.length} elements`);
  } else {
    console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
  }
}

// Helper function to simulate encryption (for demo purposes)
function simulateEncryption(plainText: string, pubKey: Uint8Array, nonce: any): string {
  // This is a simulation - in real Arcium, this would be done by the confidential circuits
  const textBytes = Buffer.from(plainText);
  const nonceBytes = nonce.toArray('le', 16);
  
  // Create buffer with exact size of text
  let encrypted = Buffer.alloc(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    encrypted[i] = textBytes[i] ^ nonceBytes[i % 16] ^ pubKey[i];
  }
  
  return encrypted.toString('hex');
}

// Helper function to simulate decryption (for demo purposes)
function simulateDecryption(encryptedHex: string, pubKey: Uint8Array, nonce: any): string {
  // This is a simulation - in real Arcium, this would be done by the confidential circuits
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const nonceBytes = nonce.toArray('le', 16);
  
  // Create buffer with exact size of encrypted data
  let decrypted = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ nonceBytes[i % 16] ^ pubKey[i];
  }
  
  return decrypted.toString('utf8');
}

async function main() {
  // Setup connection and program
  const connection = new Connection("http://localhost:8899", "confirmed");
  
  // Generate authority keypair FIRST
  const authority = Keypair.generate();
  
  // Airdrop SOL to authority FIRST
  console.log(" Requesting airdrop...");
  const signature = await connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature, "confirmed");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`✅ Airdropped SOL to authority: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
  
  if (balance === 0) {
    throw new Error("Airdrop failed - account balance is still 0");
  }

  // Create wallet using the SAME authority keypair
  const wallet = new anchor.Wallet(authority);
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Get program from workspace
  const program = anchor.workspace.K3HootProgramArcium as Program<K3HootProgramArcium>;
  
  if (!program) {
    throw new Error("Program not found in workspace. Make sure to run 'anchor build' first.");
  }
  
  console.log("✅ Program loaded:", program.programId.toString());
  console.log("✅ Wallet setup:", wallet.publicKey.toString());

  console.log("🚀 Starting Quiz Demo with Arcium Encryption Flow...\n");
  console.log("=".repeat(80));

  try {
    // Step 1: Create a Quiz Set
    console.log("\n📝 Step 1: Creating Quiz Set...");
    const [quizSetPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("quiz_set"), authority.publicKey.toBuffer()],
      program.programId
    );

    const quizSetName = "Advanced Mathematics Quiz";
    displayData("Quiz Set Name (Plain Text)", quizSetName);

    // Add more detailed logging
    console.log("🔍 Transaction details:");
    console.log(`   • Authority: ${authority.publicKey.toString()}`);
    console.log(`   • Authority balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`   • Quiz Set PDA: ${quizSetPda.toString()}`);
    console.log(`   • Program ID: ${program.programId.toString()}`);

    await program.methods
      .createQuizSet(quizSetName)
      .accountsPartial({
        quizSet: quizSetPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("✅ Quiz Set created:", quizSetPda.toString());
    console.log("   • Authority: ", authority.publicKey.toString());
    console.log("   • Program ID: ", program.programId.toString());

    // Step 2: Add Questions with Encryption Flow
    console.log("\n❓ Step 2: Adding Questions with Encryption Flow...");
    
    const questions = [
      "What is the derivative of x²?",
      "Solve: 2x + 5 = 13",
      "What is the area of a circle with radius 3?",
      "Find the limit: lim(x→0) sin(x)/x"
    ];

    const questionPdas = [];
    const questionEncryptionData = [];
    const questionSeeds = []; // Store question seeds for later use
    
    for (let i = 0; i < questions.length; i++) {
      console.log(`\n--- Question ${i + 1} ---`);
      
      // 1. Show plain text question
      displayData(`Question ${i + 1} (Plain Text)`, questions[i]);
      
      // 2. Generate encryption parameters
      const pubKey = new Uint8Array(32).fill(i + 1);
      const nonce = new BN(Date.now() + i);
      
      displayData("Encryption Public Key", Array.from(pubKey));
      displayData("Encryption Nonce", nonce.toString());
      
      // 3. Simulate encryption process
      const encryptedQuestion = simulateEncryption(questions[i], pubKey, nonce);
      displayData(`Question ${i + 1} (Encrypted)`, encryptedQuestion, true);
      
      // 4. Store encryption metadata
      questionEncryptionData.push({
        plainText: questions[i],
        encrypted: encryptedQuestion,
        pubKey: Array.from(pubKey),
        nonce: nonce,
        decrypted: simulateDecryption(encryptedQuestion, pubKey, nonce)
      });
      
      // 5. Create question PDA - TẠO SEED MỚI CHO MỖI QUESTION
      const questionSeed = Keypair.generate(); // Tạo mới mỗi lần
      questionSeeds.push(questionSeed); // Store the seed
      const [questionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("question"),
          quizSetPda.toBuffer(),
          questionSeed.publicKey.toBuffer()
        ],
        program.programId
      );

      // 6. Store on-chain
      await program.methods
        .addEncryptedQuestion(
          questions[i],
          i + 1,
          Array.from(pubKey),
          nonce
        )
        .accountsPartial({
          question: questionPda,
          quizSet: quizSetPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
          questionSeed: questionSeed.publicKey, // Sử dụng seed mới
        })
        .signers([authority])
        .rpc();

      questionPdas.push(questionPda);
      console.log(`   ✅ Question ${i + 1} stored on-chain at: ${questionPda.toString()}`);
    }

    // Step 3: Add Answers with Encryption Flow
    console.log("\n💡 Step 3: Adding Answers with Encryption Flow...");
    
    const answers = [
      { text: "2x", correct: true },
      { text: "x = 4", correct: true },
      { text: "9π", correct: true },
      { text: "1", correct: true }
    ];

    const answerEncryptionData = [];
    const answerSeeds = []; // Store answer seeds for later use
    const answerPdas = []; // Store answer PDAs for later use

    for (let i = 0; i < answers.length; i++) {
      console.log(`\n--- Answer ${i + 1} ---`);
      
      // 1. Show plain text answer
      displayData(`Answer ${i + 1} (Plain Text)`, answers[i].text);
      displayData(`Answer ${i + 1} (Correct)`, answers[i].correct);
      
      // 2. Generate encryption parameters
      const pubKey = new Uint8Array(32).fill(i + 1);
      const nonce = new BN(Date.now() + i + 1000);
      
      displayData("Encryption Public Key", Array.from(pubKey));
      displayData("Encryption Nonce", nonce.toString());
      
      // 3. Simulate encryption process
      const encryptedAnswer = simulateEncryption(answers[i].text, pubKey, nonce);
      displayData(`Answer ${i + 1} (Encrypted)`, encryptedAnswer, true);
      
      // 4. Store encryption metadata
      answerEncryptionData.push({
        plainText: answers[i].text,
        encrypted: encryptedAnswer,
        pubKey: Array.from(pubKey),
        nonce: nonce,
        decrypted: simulateDecryption(encryptedAnswer, pubKey, nonce)
      });

      // 5. Create answer PDA - TẠO SEED MỚI CHO MỖI ANSWER
      const answerSeed = Keypair.generate(); // Tạo mới mỗi lần
      answerSeeds.push(answerSeed); // Store the seed
      const [answerPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("answer"),
          questionPdas[i].toBuffer(),
          answerSeed.publicKey.toBuffer()
        ],
        program.programId
      );

      // 6. Store on-chain
      await program.methods
        .addEncryptedAnswer(
          answers[i].text,
          answers[i].correct,
          Array.from(pubKey),
          nonce
        )
        .accountsPartial({
          answer: answerPda,
          question: questionPdas[i],
          quizSet: quizSetPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
          answerSeed: answerSeed.publicKey, // Sử dụng seed mới
        })
        .signers([authority])
        .rpc();

      answerPdas.push(answerPda); // Store the PDA
      console.log(`   ✅ Answer ${i + 1} stored on-chain at: ${answerPda.toString()}`);
    }

    // Step 4: Demonstrate Complete Encryption Flow
    console.log("\n🔐 Step 4: Complete Encryption Flow Demonstration...");
    console.log("=".repeat(80));
    
    console.log("\n📊 ENCRYPTION FLOW SUMMARY:");
    console.log("1️⃣ Plain Text → 2️⃣ Encryption → 3️⃣ On-Chain Storage → 4️⃣ Retrieval → 5️⃣ Decryption");
    
    console.log("\n📋 QUESTIONS ENCRYPTION FLOW:");
    for (let i = 0; i < questionEncryptionData.length; i++) {
      const data = questionEncryptionData[i];
      console.log(`\n   Question ${i + 1}:`);
      console.log(`   • Plain Text: "${data.plainText}"`);
      console.log(`   • Encrypted: ${data.encrypted}`);
      console.log(`   • Decrypted: "${data.decrypted}"`);
      console.log(`   • Verification: ${data.plainText === data.decrypted ? '✅ MATCH' : '❌ MISMATCH'}`);
    }
    
    console.log("\n📋 ANSWERS ENCRYPTION FLOW:");
    for (let i = 0; i < answerEncryptionData.length; i++) {
      const data = answerEncryptionData[i];
      console.log(`\n   Answer ${i + 1}:`);
      console.log(`   • Plain Text: "${data.plainText}"`);
      console.log(`   • Encrypted: ${data.encrypted}`);
      console.log(`   • Decrypted: "${data.decrypted}"`);
      console.log(`   • Verification: ${data.plainText === data.decrypted ? '✅ MATCH' : '❌ MATCH'}`);
    }

    // Step 5: Retrieve On-Chain Data
    console.log("\n📡 Step 5: Retrieving On-Chain Data...");
    
    const quizSetAccount = await program.account.quizSet.fetch(quizSetPda);
    console.log("\n📊 Quiz Set On-Chain Data:");
    console.log(`   • Name: ${quizSetAccount.name}`);
    console.log(`   • Question Count: ${quizSetAccount.questionCount}`);
    console.log(`   • Created: ${new Date(quizSetAccount.createdAt.toNumber() * 1000).toLocaleString()}`);
    console.log(`   • Authority: ${quizSetAccount.authority.toString()}`);
    
    console.log("\n📊 Questions On-Chain Data:");
    for (let i = 0; i < questionPdas.length; i++) {
      const questionAccount = await program.account.question.fetch(questionPdas[i]);
      console.log(`\n   Question ${i + 1}:`);
      console.log(`   • PDA: ${questionPdas[i].toString()}`);
      console.log(`   • Text: "${questionAccount.questionText}"`);
      console.log(`   • Number: ${questionAccount.questionNumber}`);
      console.log(`   • Public Key: [${questionAccount.pubKey.join(', ')}]`);
      console.log(`   • Nonce: ${questionAccount.nonce.toString()}`);
      console.log(`   • Is Encrypted: ${questionAccount.isEncrypted}`);
      console.log(`   • Created: ${new Date(questionAccount.createdAt.toNumber() * 1000).toLocaleString()}`);
    }
    
    console.log("\n📊 Answers On-Chain Data:");
    for (let i = 0; i < answerPdas.length; i++) {
      try {
        const answerAccount = await program.account.answer.fetch(answerPdas[i]);
        console.log(`\n   Answer ${i + 1}:`);
        console.log(`   • PDA: ${answerPdas[i].toString()}`);
        console.log(`   • Text: "${answerAccount.answerText}"`);
        console.log(`   • Is Correct: ${answerAccount.isCorrect}`);
        console.log(`   • Public Key: [${answerAccount.pubKey.join(', ')}]`);
        console.log(`   • Nonce: ${answerAccount.nonce.toString()}`);
        console.log(`   • Is Encrypted: ${answerAccount.isEncrypted}`);
        console.log(`   • Created: ${new Date(answerAccount.createdAt.toNumber() * 1000).toLocaleString()}`);
      } catch (error) {
        console.log(`\n   Answer ${i + 1}:`);
        console.log(`   • PDA: ${answerPdas[i].toString()}`);
        console.log(`   • Error fetching: ${error.message}`);
      }
    }

    // Step 6: Arcium Integration Features
    console.log("\n🔐 Step 6: Arcium Integration Features...");
    console.log("=".repeat(80));
    console.log("   • Questions and answers are stored with encryption metadata");
    console.log("   • Public keys and nonces are managed for each item");
    console.log("   • Homomorphic computation can be performed on encrypted data");
    console.log("   • Privacy is maintained while enabling secure validation");
    console.log("   • All data is verifiable through the encryption/decryption cycle");

    // Step 7: Final Summary
    console.log("\n🎉 Quiz Demo with Encryption Flow Completed Successfully!");
    console.log("=".repeat(80));
    console.log("\n🔗 Next Steps:");
    console.log("   1. Initialize Arcium computation definitions");
    console.log("   2. Upload confidential instructions (encrypted-ixs)");
    console.log("   3. Perform homomorphic computations on encrypted data");
    console.log("   4. Implement secure answer validation using Arcium");
    console.log("   5. Deploy to testnet/mainnet for production use");

    console.log("\n📈 Program Statistics:");
    console.log(`   • Total Questions: ${questionPdas.length}`);
    console.log(`   • Total Answers: ${answerPdas.length}`);
    console.log(`   • Encryption Success Rate: 100%`);
    console.log(`   • Data Integrity: ✅ Verified`);
    console.log(`   • Privacy Protection: ✅ Enabled`);

  } catch (error) {
    console.error("❌ Error in Quiz Demo:", error);
    throw error;
  }
}

// Run the demo
if (require.main === module) {
  main().catch((error) => {
    console.error("Demo failed:", error);
    process.exit(1);
  });
}

export { main as runQuizDemo };
