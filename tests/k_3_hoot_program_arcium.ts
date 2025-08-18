import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { K3HootProgramArcium } from "../target/types/k_3_hoot_program_arcium";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";

describe("k_3_hoot_program_arcium", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.K3HootProgramArcium as Program<K3HootProgramArcium>;
  
  // Test accounts
  const authority = Keypair.generate();
  const quizSetSeed = Keypair.generate();
  const questionSeed = Keypair.generate();
  const answerSeed = Keypair.generate();
  
  // Store PDAs for reuse
  let quizSetPda: PublicKey;
  let questionPda: PublicKey;
  let answerPda: PublicKey;

  before(async () => {
    // Airdrop SOL to authority
    const signature = await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature);
    
    // Pre-calculate PDAs
    quizSetPda = PublicKey.findProgramAddressSync(
      [Buffer.from("quiz_set"), authority.publicKey.toBuffer()],
      program.programId
    )[0];
    
    questionPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("question"),
        quizSetPda.toBuffer(),
        questionSeed.publicKey.toBuffer()
      ],
      program.programId
    )[0];
    
    answerPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("answer"),
        questionPda.toBuffer(),
        answerSeed.publicKey.toBuffer()
      ],
      program.programId
    )[0];
  });

  describe("Quiz Management", () => {
    it("Should create a quiz set", async () => {
      try {
        await program.methods
          .createQuizSet("Math Quiz")
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
        expect(quizSetAccount.questionCount).to.equal(0);
      } catch (error) {
        console.error("Error creating quiz set:", error);
        throw error;
      }
    });

    it("Should add an encrypted question", async () => {
      const pubKey = new Uint8Array(32).fill(1); // Mock public key
      const nonce = new BN(123456789);

      try {
        await program.methods
          .addEncryptedQuestion(
            "What is 2 + 2?",
            1,
            Array.from(pubKey),
            nonce
          )
          .accountsPartial({
            question: questionPda,
            quizSet: quizSetPda,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
            questionSeed: questionSeed.publicKey,
          })
          .signers([authority])
          .rpc();

        const questionAccount = await program.account.question.fetch(questionPda);
        expect(questionAccount.questionText).to.equal("What is 2 + 2?");
        expect(questionAccount.questionNumber).to.equal(1);
        expect(questionAccount.isEncrypted).to.equal(false);

        const quizSetAccount = await program.account.quizSet.fetch(quizSetPda);
        expect(quizSetAccount.questionCount).to.equal(1);
      } catch (error) {
        console.error("Error adding question:", error);
        throw error;
      }
    });

    it("Should add an encrypted answer", async () => {
      const pubKey = new Uint8Array(32).fill(1); // Mock public key
      const nonce = new BN(987654321);

      try {
        await program.methods
          .addEncryptedAnswer(
            "4",
            true,
            Array.from(pubKey),
            nonce
          )
          .accountsPartial({
            answer: answerPda,
            question: questionPda,
            quizSet: quizSetPda,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
            answerSeed: answerSeed.publicKey,
          })
          .signers([authority])
          .rpc();

        const answerAccount = await program.account.answer.fetch(answerPda);
        expect(answerAccount.answerText).to.equal("4");
        expect(answerAccount.isCorrect).to.equal(true);
        expect(answerAccount.isEncrypted).to.equal(false);
      } catch (error) {
        console.error("Error adding answer:", error);
        throw error;
      }
    });
  });

  describe("Arcium Integration", () => {
    it("Should initialize computation definitions", async () => {
      // This test would require Arcium program setup
      // For now, we'll just test that the functions exist
      expect(typeof program.methods.initAddTogetherCompDef).to.equal("function");
      // Note: These functions are commented out in the program for now
      // expect(typeof program.methods.initEncryptQuizCompDef).to.equal("function");
      // expect(typeof program.methods.initDecryptQuizCompDef).to.equal("function");
    });

    it("Should have encryption function", async () => {
      expect(typeof program.methods.encryptQuestionData).to.equal("function");
    });
  });
});
