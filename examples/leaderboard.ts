import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { K3HootProgramArcium } from "../target/types/k_3_hoot_program_arcium";
import { PublicKey, Connection, Commitment } from "@solana/web3.js";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Leaderboard System Demo
 * 
 * Demonstrates:
 * 1. Fetching top users by topic
 * 2. Global leaderboard across all topics
 * 3. User's quiz history
 * 4. Topic statistics
 */

interface LeaderboardEntry {
  user: PublicKey;
  score: number;
  totalCompleted: number;
  totalRewards: number;
  lastActivity: Date;
  winRate: number;
}

interface TopicStats {
  name: string;
  totalQuizzes: number;
  totalParticipants: number;
  topPerformers: LeaderboardEntry[];
}

interface UserStats {
  user: PublicKey;
  totalScore: number;
  totalCompleted: number;
  totalRewards: number;
  topicBreakdown: Map<string, LeaderboardEntry>;
  recentHistory: any[];
}

class LeaderboardManager {
  private program: Program<K3HootProgramArcium>;
  private connection: Connection;

  constructor(program: Program<K3HootProgramArcium>, connection: Connection) {
    this.program = program;
    this.connection = connection;
  }

  // Get leaderboard for a specific topic
  async getTopicLeaderboard(topicName: string, limit: number = 100): Promise<LeaderboardEntry[]> {
    console.log(`🏆 Fetching leaderboard for topic: "${topicName}" (Top ${limit})`);
    
    try {
      // Get topic PDA
      const [topicPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("topic"), Buffer.from(topicName)],
        this.program.programId
      );

      // Fetch all user scores for this topic
      const userScores = await this.program.account.userScore.all([
        {
          memcmp: {
            offset: 8 + 32, // Skip discriminator and user pubkey
            bytes: topicPda.toBase58(),
          }
        }
      ]);

      console.log(`   Found ${userScores.length} participants in topic "${topicName}"`);

      // Convert to leaderboard entries and sort
      const entries: LeaderboardEntry[] = userScores
        .map(userScore => ({
          user: userScore.account.user,
          score: userScore.account.score,
          totalCompleted: userScore.account.totalCompleted,
          totalRewards: userScore.account.totalRewards.toNumber(),
          lastActivity: new Date(userScore.account.lastActivity.toNumber() * 1000),
          winRate: userScore.account.totalCompleted > 0 ? 
            (userScore.account.score / userScore.account.totalCompleted) * 100 : 0
        }))
        .sort((a, b) => {
          // Primary sort: by score (descending)
          if (b.score !== a.score) return b.score - a.score;
          // Secondary sort: by win rate (descending)
          if (b.winRate !== a.winRate) return b.winRate - a.winRate;
          // Tertiary sort: by total completed (descending)
          return b.totalCompleted - a.totalCompleted;
        })
        .slice(0, limit);

      console.log(`✅ Leaderboard for "${topicName}":`);
      entries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.user.toString().slice(0, 8)}... - ` +
                   `Score: ${entry.score}, Win Rate: ${entry.winRate.toFixed(1)}%, ` +
                   `Total: ${entry.totalCompleted}, Rewards: ${entry.totalRewards / 1e9} SOL`);
      });

      return entries;
      
    } catch (error) {
      console.error(`❌ Error fetching leaderboard for topic "${topicName}":`, error);
      throw error;
    }
  }

  // Get global leaderboard across all topics
  async getGlobalLeaderboard(limit: number = 100): Promise<UserStats[]> {
    console.log(`🌍 Fetching global leaderboard (Top ${limit})`);
    
    try {
      // Fetch all user scores
      const allUserScores = await this.program.account.userScore.all();
      console.log(`   Found ${allUserScores.length} user score records`);

      // Group by user
      const userStatsMap = new Map<string, UserStats>();

      for (const userScoreAccount of allUserScores) {
        const userKey = userScoreAccount.account.user.toString();
        const topicKey = userScoreAccount.account.topic.toString();

        if (!userStatsMap.has(userKey)) {
          userStatsMap.set(userKey, {
            user: userScoreAccount.account.user,
            totalScore: 0,
            totalCompleted: 0,
            totalRewards: 0,
            topicBreakdown: new Map(),
            recentHistory: []
          });
        }

        const userStats = userStatsMap.get(userKey)!;
        userStats.totalScore += userScoreAccount.account.score;
        userStats.totalCompleted += userScoreAccount.account.totalCompleted;
        userStats.totalRewards += userScoreAccount.account.totalRewards.toNumber();

        // Add topic breakdown
        userStats.topicBreakdown.set(topicKey, {
          user: userScoreAccount.account.user,
          score: userScoreAccount.account.score,
          totalCompleted: userScoreAccount.account.totalCompleted,
          totalRewards: userScoreAccount.account.totalRewards.toNumber(),
          lastActivity: new Date(userScoreAccount.account.lastActivity.toNumber() * 1000),
          winRate: userScoreAccount.account.totalCompleted > 0 ? 
            (userScoreAccount.account.score / userScoreAccount.account.totalCompleted) * 100 : 0
        });
      }

      // Sort global leaderboard
      const globalEntries = Array.from(userStatsMap.values())
        .sort((a, b) => {
          // Primary sort: by total score (descending)
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          // Secondary sort: by total rewards (descending)
          if (b.totalRewards !== a.totalRewards) return b.totalRewards - a.totalRewards;
          // Tertiary sort: by total completed (descending)
          return b.totalCompleted - a.totalCompleted;
        })
        .slice(0, limit);

      console.log(`✅ Global Leaderboard:`);
      globalEntries.forEach((entry, index) => {
        const globalWinRate = entry.totalCompleted > 0 ? 
          (entry.totalScore / entry.totalCompleted) * 100 : 0;
        console.log(`   ${index + 1}. ${entry.user.toString().slice(0, 8)}... - ` +
                   `Total Score: ${entry.totalScore}, Win Rate: ${globalWinRate.toFixed(1)}%, ` +
                   `Topics: ${entry.topicBreakdown.size}, Rewards: ${entry.totalRewards / 1e9} SOL`);
      });

      return globalEntries;
      
    } catch (error) {
      console.error(`❌ Error fetching global leaderboard:`, error);
      throw error;
    }
  }

  // Get user's quiz history
  async getUserHistory(userPubkey: PublicKey, limit: number = 50): Promise<any[]> {
    console.log(`📚 Fetching quiz history for user: ${userPubkey.toString()}`);
    
    try {
      // Fetch user's quiz history
      const history = await this.program.account.quizHistory.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: userPubkey.toBase58(),
          }
        }
      ]);

      console.log(`   Found ${history.length} quiz completion records`);

      // Sort by completion time (most recent first)
      const sortedHistory = history
        .sort((a, b) => b.account.completedAt.toNumber() - a.account.completedAt.toNumber())
        .slice(0, limit)
        .map(record => ({
          quizSet: record.account.quizSet,
          topic: record.account.topic,
          completedAt: new Date(record.account.completedAt.toNumber() * 1000),
          score: record.account.score,
          totalQuestions: record.account.totalQuestions,
          isWinner: record.account.isWinner,
          rewardClaimed: record.account.rewardClaimed.toNumber(),
          winRate: (record.account.score / record.account.totalQuestions) * 100
        }));

      console.log(`✅ Recent Quiz History:`);
      sortedHistory.forEach((record, index) => {
        const status = record.isWinner ? '🏆 Won' : '❌ Lost';
        console.log(`   ${index + 1}. ${record.completedAt.toLocaleDateString()} - ` +
                   `${status} - Score: ${record.score}/${record.totalQuestions} ` +
                   `(${record.winRate.toFixed(1)}%) - Reward: ${record.rewardClaimed / 1e9} SOL`);
      });

      return sortedHistory;
      
    } catch (error) {
      console.error(`❌ Error fetching user history:`, error);
      throw error;
    }
  }

  // Get topic statistics
  async getTopicStats(topicName: string): Promise<TopicStats> {
    console.log(`📊 Fetching statistics for topic: "${topicName}"`);
    
    try {
      // Get topic info
      const [topicPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("topic"), Buffer.from(topicName)],
        this.program.programId
      );

      const topic = await this.program.account.topic.fetch(topicPda);
      
      // Get leaderboard for this topic
      const topPerformers = await this.getTopicLeaderboard(topicName, 10);

      const stats: TopicStats = {
        name: topic.name,
        totalQuizzes: topic.totalQuizzes,
        totalParticipants: topic.totalParticipants,
        topPerformers
      };

      console.log(`✅ Topic Statistics for "${topicName}":`);
      console.log(`   Total Quizzes: ${stats.totalQuizzes}`);
      console.log(`   Total Participants: ${stats.totalParticipants}`);
      console.log(`   Top Performers: ${stats.topPerformers.length}`);

      return stats;
      
    } catch (error) {
      console.error(`❌ Error fetching topic stats:`, error);
      throw error;
    }
  }

  // Get all topics with their stats
  async getAllTopicsWithStats(): Promise<TopicStats[]> {
    console.log(`🔍 Fetching all topics with statistics...`);
    
    try {
      const allTopics = await this.program.account.topic.all();
      console.log(`   Found ${allTopics.length} topics`);

      const topicsWithStats: TopicStats[] = [];

      for (const topicAccount of allTopics) {
        const stats = await this.getTopicStats(topicAccount.account.name);
        topicsWithStats.push(stats);
      }

      // Sort topics by total participants (most popular first)
      topicsWithStats.sort((a, b) => b.totalParticipants - a.totalParticipants);

      console.log(`✅ Topics Overview:`);
      topicsWithStats.forEach((topic, index) => {
        console.log(`   ${index + 1}. ${topic.name} - ` +
                   `${topic.totalParticipants} participants, ${topic.totalQuizzes} quizzes`);
      });

      return topicsWithStats;
      
    } catch (error) {
      console.error(`❌ Error fetching all topics:`, error);
      throw error;
    }
  }

  // Demo workflow
  async runDemo(): Promise<void> {
    console.log(`\n🏆 Leaderboard System Demo`);
    console.log(`─`.repeat(50));
    
    try {
      // 1. Get all topics with stats
      console.log(`\n📊 Step 1: All Topics Overview`);
      console.log(`─`.repeat(30));
      
      const allTopics = await this.getAllTopicsWithStats();
      
      // 2. Get topic-specific leaderboards
      if (allTopics.length > 0) {
        console.log(`\n🏆 Step 2: Topic-Specific Leaderboards`);
        console.log(`─`.repeat(30));
        
        for (const topic of allTopics.slice(0, 3)) { // Show top 3 topics
          await this.getTopicLeaderboard(topic.name, 10);
          console.log(); // Add spacing
        }
      }
      
      // 3. Global leaderboard
      console.log(`\n🌍 Step 3: Global Leaderboard`);
      console.log(`─`.repeat(30));
      
      const globalLeaderboard = await this.getGlobalLeaderboard(20);
      
      // 4. Show example user history (if users exist)
      if (globalLeaderboard.length > 0) {
        console.log(`\n📚 Step 4: Example User History`);
        console.log(`─`.repeat(30));
        
        const topUser = globalLeaderboard[0];
        await this.getUserHistory(topUser.user, 10);
      }
      
      console.log(`\n🎉 Leaderboard Demo Completed!`);
      console.log(`📊 Summary:`);
      console.log(`   • Found ${allTopics.length} topics`);
      console.log(`   • Global leaderboard shows ${globalLeaderboard.length} users`);
      console.log(`   • Leaderboard sorts by: Score > Win Rate > Total Completed`);
      console.log(`   • Users can compete across multiple topics`);
      console.log(`   • Complete quiz history is tracked for each user`);
      
    } catch (error) {
      console.error("❌ Leaderboard demo failed:", error);
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
    const leaderboardManager = new LeaderboardManager(program, connection);
    
    // Run the demo
    await leaderboardManager.runDemo();
    
  } catch (error) {
    console.error("Leaderboard demo failed:", error);
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Leaderboard demo failed:", error);
    process.exit(1);
  });
}
