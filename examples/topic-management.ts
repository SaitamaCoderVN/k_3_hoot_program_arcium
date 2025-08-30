import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { K3HootProgramArcium } from "../target/types/k_3_hoot_program_arcium";
import { PublicKey, Keypair, Connection, Commitment } from "@solana/web3.js";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Topic Management Demo
 * 
 * Demonstrates:
 * 1. Creating topics
 * 2. Transferring topic ownership
 * 3. Toggling topic status (active/inactive)
 * 4. Listing all topics
 */

class TopicManager {
  private program: Program<K3HootProgramArcium>;
  private connection: Connection;
  private owner: Keypair;

  constructor(program: Program<K3HootProgramArcium>, connection: Connection, owner: Keypair) {
    this.program = program;
    this.connection = connection;
    this.owner = owner;
  }

  // Create a new topic
  async createTopic(name: string): Promise<string> {
    console.log(`🚀 Creating topic: "${name}"`);
    
    // Derive topic PDA
    const [topicPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("topic"), Buffer.from(name)],
      this.program.programId
    );

    console.log(`   Topic PDA: ${topicPda.toString()}`);
    console.log(`   Seeds: ["topic", "${name}"]`);

    try {
      const tx = await this.program.methods
        .createTopic(name)
        .accountsPartial({
          topic: topicPda,
          owner: this.owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([this.owner])
        .rpc({ commitment: "confirmed" });

      console.log(`✅ Topic created successfully!`);
      console.log(`   Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      
      await this.connection.confirmTransaction(tx, "confirmed");
      console.log(`✅ Transaction confirmed!`);
      
      return topicPda.toString();
    } catch (error: any) {
      console.error(`❌ Failed to create topic:`, error);
      throw error;
    }
  }

  // Transfer topic ownership
  async transferTopicOwnership(topicName: string, newOwner: PublicKey): Promise<void> {
    console.log(`🔄 Transferring ownership of topic: "${topicName}"`);
    console.log(`   New owner: ${newOwner.toString()}`);
    
    const [topicPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("topic"), Buffer.from(topicName)],
      this.program.programId
    );

    try {
      const tx = await this.program.methods
        .transferTopicOwnership(newOwner)
        .accountsPartial({
          topic: topicPda,
          owner: this.owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([this.owner])
        .rpc({ commitment: "confirmed" });

      console.log(`✅ Ownership transferred successfully!`);
      console.log(`   Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      
      await this.connection.confirmTransaction(tx, "confirmed");
      console.log(`✅ Transaction confirmed!`);
      
    } catch (error: any) {
      console.error(`❌ Failed to transfer ownership:`, error);
      throw error;
    }
  }

  // Toggle topic status (active/inactive)
  async toggleTopicStatus(topicName: string, isActive: boolean): Promise<void> {
    console.log(`🔧 Setting topic "${topicName}" status to: ${isActive ? 'Active' : 'Inactive'}`);
    
    const [topicPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("topic"), Buffer.from(topicName)],
      this.program.programId
    );

    try {
      const tx = await this.program.methods
        .toggleTopicStatus(isActive)
        .accountsPartial({
          topic: topicPda,
          owner: this.owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([this.owner])
        .rpc({ commitment: "confirmed" });

      console.log(`✅ Topic status updated successfully!`);
      console.log(`   Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      
      await this.connection.confirmTransaction(tx, "confirmed");
      console.log(`✅ Transaction confirmed!`);
      
    } catch (error: any) {
      console.error(`❌ Failed to toggle topic status:`, error);
      throw error;
    }
  }

  // List all topics
  async listAllTopics(): Promise<any[]> {
    console.log(`🔍 Fetching all topics...`);
    
    try {
      const allTopics = await this.program.account.topic.all();
      
      console.log(`✅ Found ${allTopics.length} topic(s):`);
      
      allTopics.forEach((topic, index) => {
        const created = new Date(topic.account.createdAt.toNumber() * 1000);
        const status = topic.account.isActive ? '🟢 Active' : '🔴 Inactive';
        
        console.log(`\n   ${index + 1}. ${topic.account.name}`);
        console.log(`      Address: ${topic.publicKey.toString()}`);
        console.log(`      Owner: ${topic.account.owner.toString()}`);
        console.log(`      Status: ${status}`);
        console.log(`      Created: ${created.toLocaleString()}`);
        console.log(`      Total Quizzes: ${topic.account.totalQuizzes}`);
        console.log(`      Total Participants: ${topic.account.totalParticipants}`);
        console.log(`      Min Reward: ${topic.account.minRewardAmount.toNumber() / 1_000_000_000} SOL`);
        console.log(`      Min Questions: ${topic.account.minQuestionCount}`);
      });
      
      return allTopics;
    } catch (error) {
      console.error("❌ Error fetching topics:", error);
      throw error;
    }
  }

  // Get topic by name
  async getTopicByName(name: string): Promise<any> {
    console.log(`🔍 Fetching topic: "${name}"`);
    
    const [topicPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("topic"), Buffer.from(name)],
      this.program.programId
    );

    try {
      const topic = await this.program.account.topic.fetch(topicPda);
      
      const created = new Date(topic.createdAt.toNumber() * 1000);
      const status = topic.isActive ? '🟢 Active' : '🔴 Inactive';
      
      console.log(`✅ Topic Details:`);
      console.log(`   Name: ${topic.name}`);
      console.log(`   Address: ${topicPda.toString()}`);
      console.log(`   Owner: ${topic.owner.toString()}`);
      console.log(`   Status: ${status}`);
      console.log(`   Created: ${created.toLocaleString()}`);
      console.log(`   Total Quizzes: ${topic.totalQuizzes}`);
      console.log(`   Total Participants: ${topic.totalParticipants}`);
      console.log(`   Min Reward: ${topic.minRewardAmount.toNumber() / 1_000_000_000} SOL`);
      console.log(`   Min Questions: ${topic.minQuestionCount}`);
      
      return { account: topic, publicKey: topicPda };
    } catch (error) {
      console.error(`❌ Error fetching topic "${name}":`, error);
      throw error;
    }
  }

  // Demo workflow
  async runDemo(): Promise<void> {
    console.log(`\n📋 Topic Management Demo`);
    console.log(`─`.repeat(50));
    
    try {
      // 1. Create some sample topics
      console.log(`\n🚀 Step 1: Creating Sample Topics`);
      console.log(`─`.repeat(30));
      
      const mathTopicPda = await this.createTopic("Mathematics");
      const scienceTopicPda = await this.createTopic("Science");
      const historyTopicPda = await this.createTopic("History");
      
      // 2. List all topics
      console.log(`\n📋 Step 2: Listing All Topics`);
      console.log(`─`.repeat(30));
      
      await this.listAllTopics();
      
      // 3. Get specific topic
      console.log(`\n🔍 Step 3: Get Specific Topic`);
      console.log(`─`.repeat(30));
      
      await this.getTopicByName("Mathematics");
      
      // 4. Toggle topic status
      console.log(`\n🔧 Step 4: Toggle Topic Status`);
      console.log(`─`.repeat(30));
      
      await this.toggleTopicStatus("History", false); // Disable History topic
      await this.toggleTopicStatus("History", true);  // Re-enable History topic
      
      console.log(`\n🎉 Topic Management Demo Completed!`);
      console.log(`📊 Summary:`);
      console.log(`   • Created 3 topics: Mathematics, Science, History`);
      console.log(`   • Each topic has minimum 3 questions and 0.01 SOL reward`);
      console.log(`   • Only topic owners can create quiz sets under their topics`);
      console.log(`   • Topics can be disabled/enabled by owners`);
      console.log(`   • Topic ownership can be transferred`);
      
    } catch (error) {
      console.error("❌ Topic management demo failed:", error);
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
  
  const owner = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(JSON.parse(require('fs').readFileSync('/Users/saitamacoder/.config/solana/id.json', 'utf-8')))
  );
  
  const wallet = new anchor.Wallet(owner);
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Use program ID from workspace
  const program = anchor.workspace.K3HootProgramArcium as Program<K3HootProgramArcium>;
  
  console.log("🔐 Program ID:", program.programId.toString());
  console.log("👤 Owner:", owner.publicKey.toString());
  console.log("🌐 Network: Devnet");
  
  const balance = await connection.getBalance(owner.publicKey);
  console.log("💰 Balance:", balance / 1e9, "SOL");

  try {
    const topicManager = new TopicManager(program, connection, owner);
    
    // Run the demo
    await topicManager.runDemo();
    
  } catch (error) {
    console.error("Topic management failed:", error);
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Topic management failed:", error);
    process.exit(1);
  });
}
