import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { K3HootProgramArcium } from "../target/types/k_3_hoot_program_arcium";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { BN } from "@coral-xyz/anchor";

describe("k_3_hoot_program_arcium", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.K3HootProgramArcium as Program<K3HootProgramArcium>;
  
  // Test accounts
  const authority = Keypair.generate();
  let quizSetPda: PublicKey;
  let questionBlockPda: PublicKey;

  before(async () => {
    // Airdrop SOL to authority
    const signature = await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature);
    
    // Pre-calculate PDAs
    quizSetPda = PublicKey.findProgramAddressSync(
      [Buffer.from("quiz_set"), authority.publicKey.toBuffer()],
      program.programId
    )[0];
    
    questionBlockPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("question_block"),
        quizSetPda.toBuffer(),
        Buffer.from([1])
      ],
      program.programId
    )[0];
  });

  describe("Quiz Management", () => {
    it("Should create a quiz set", async () => {
      try {
        await program.methods
          .createQuizSet("Math Quiz", 3, 1, new BN(1)) // Add uniqueId as third parameter
          .accountsPartial({
            quizSet: quizSetPda,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();

        const quizSetAccount = await program.account.quizSet.fetch(quizSetPda);
        expect(quizSetAccount.name).to.equal("Math Quiz");
        expect(quizSetAccount.authority.toString()).to.equal(authority.publicKey.toString());
        expect(quizSetAccount.questionCount).to.equal(3);
        expect(quizSetAccount.isInitialized).to.equal(false);
      } catch (error) {
        console.error("Error creating quiz set:", error);
        throw error;
      }
    });

    it("Should add an encrypted question block", async () => {
      const encryptedX = new Uint8Array(32).fill(1);
      const encryptedY = new Uint8Array(32).fill(2);
      const arciumPubkey = new Uint8Array(32).fill(3);
      const nonce = new BN(123456789);  // Fixed: use BN instead of BigInt

      try {
        await program.methods
          .addEncryptedQuestionBlock(
            1,
            Array.from(encryptedX),
            Array.from(encryptedY),
            Array.from(arciumPubkey),
            nonce
          )
          .accountsPartial({
            questionBlock: questionBlockPda,
            quizSet: quizSetPda,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();

        const questionBlockAccount = await program.account.questionBlock.fetch(questionBlockPda);
        expect(questionBlockAccount.questionIndex).to.equal(1);
        expect(questionBlockAccount.quizSet.toString()).to.equal(quizSetPda.toString());

        const quizSetAccount = await program.account.quizSet.fetch(quizSetPda);
        expect(quizSetAccount.isInitialized).to.equal(false); // Not yet initialized
      } catch (error) {
        console.error("Error adding question block:", error);
        throw error;
      }
    });

    it("Should mark quiz set as initialized when all questions added", async () => {
      // Add 2 more questions to complete the set
      for (let i = 2; i <= 3; i++) {
        const [questionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("question_block"),
            quizSetPda.toBuffer(),
            Buffer.from([i])
          ],
          program.programId
        );

        const encryptedX = new Uint8Array(32).fill(i);
        const encryptedY = new Uint8Array(32).fill(i + 1);
        const arciumPubkey = new Uint8Array(32).fill(i + 2);
        const nonce = new BN(123456789 + i);  // Fixed: use BN instead of BigInt

        await program.methods
          .addEncryptedQuestionBlock(
            i,
            Array.from(encryptedX),
            Array.from(encryptedY),
            Array.from(arciumPubkey),
            nonce
          )
          .accountsPartial({
            questionBlock: questionPda,
            quizSet: quizSetPda,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
      }

      // Check if quiz set is now initialized
      const quizSetAccount = await program.account.quizSet.fetch(quizSetPda);
      expect(quizSetAccount.isInitialized).to.equal(true);
    });
  });

  describe("Arcium Integration", () => {
    it("Should have encryption functions", async () => {
      expect(typeof program.methods.encryptQuizData).to.equal("function");
      expect(typeof program.methods.decryptQuizData).to.equal("function");
    });

    it("Should have validation function", async () => {
      expect(typeof program.methods.validateAnswerOnchain).to.equal("function");
    });
  });
});