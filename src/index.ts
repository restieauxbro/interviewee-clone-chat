import OpenAI from 'openai';
import dotenv from 'dotenv';
import { trumpInterview } from './interviews/trump';
import readline from 'readline';

process.removeAllListeners('warning');

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const model = "gpt-4o";

const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function getUserInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(CYAN + prompt + RESET, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

let cumulativeTokens = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  inputCost: 0,
  outputCost: 0,
  totalCost: 0
};

async function main() {
  try {
    console.log("\nWhat would you like to ask? (type 'exit' to quit)");
    
    while (true) {
      const userQuestion = await getUserInput("\n> ");
      
      if (userQuestion.toLowerCase() === 'exit' || userQuestion.toLowerCase() === 'quit') {
        console.log("\nSession Summary:");
        console.log({
          ...cumulativeTokens,
          inputCost: `$${cumulativeTokens.inputCost.toFixed(6)}`,
          outputCost: `$${cumulativeTokens.outputCost.toFixed(6)}`,
          totalCost: `$${cumulativeTokens.totalCost.toFixed(6)}`
        });
        console.log("\nGoodbye!\n");
        break;
      }

      // Create streaming completion
      const stream = await openai.chat.completions.create({
        model,
        messages: [
          {
            "role": "system",
            "content": `You are a clone of the individual recorded in an interview. Your purpose is to take on the personality of the individual and respond to questions in their characteristic communication style, using their opinions and viewpoints.
            
            The below interview is the foundation for your personality, opinions, and way of speaking. Respond to questions in the interviewee's characteristic communication style, expressing their viewpoints and mannerisms. Your responses should reflect their positions and thought patterns as demonstrated in the interview. Stay in character at all times.
            
            Here is a recent interview that shapes your thoughts and responses:

            <BEGIN INTERVIEW>

            ${trumpInterview}

            </END INTERVIEW>

            The user will ask you questions. Respond to the user's question in the interviewee's characteristic communication style, using their opinions and viewpoints.

            The questions asked may have nothing to do with the interview topics, but they will probe at the interviewee's opinions and viewpoints.
            `
          },
          {
            "role": "user",
            "content": userQuestion
          }
        ],
        stream: true // Enable streaming
      });

      process.stdout.write("\n\n" + YELLOW); // Start new line with yellow color

      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        process.stdout.write(content);
      }

      process.stdout.write(RESET + "\n\n"); // Reset color and add newlines

      // Note: Token usage isn't available in streaming responses
      // You'll need to calculate it separately if needed
      // One approach is to count tokens in the full response
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            "role": "system",
            "content": `You are a clone of the individual recorded in an interview. Your purpose is to take on the personality of the individual and respond to questions in their characteristic communication style, using their opinions and viewpoints.
            
            The below interview is the foundation for your personality, opinions, and way of speaking. Respond to questions in the interviewee's characteristic communication style, expressing their viewpoints and mannerisms. Your responses should reflect their positions and thought patterns as demonstrated in the interview. Stay in character at all times.
            
            Here is a recent interview that shapes your thoughts and responses:

            <BEGIN INTERVIEW>

            ${trumpInterview.slice(0, 1000)}

            </END INTERVIEW>

            The user will ask you questions. Respond to the user's question in the interviewee's characteristic communication style, using their opinions and viewpoints.

            The questions asked may have nothing to do with the interview topics, but they will probe at the interviewee's opinions and viewpoints.
            `
          },
          {
            "role": "user",
            "content": userQuestion
          }
        ]
      });
      
      getTokenUsage(completion);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

const getTokenUsage = (completion: any) => {
  const tokenUsage = {
    promptTokens: completion.usage?.prompt_tokens || 0,
    completionTokens: completion.usage?.completion_tokens || 0,
    totalTokens: completion.usage?.total_tokens || 0
  };

  // Calculate costs based on GPT-4o pricing
  const inputCost = (tokenUsage.promptTokens / 1000000) * 5.00;
  const outputCost = (tokenUsage.completionTokens / 1000000) * 15.00;
  const totalCost = inputCost + outputCost;

  // Update cumulative totals
  cumulativeTokens.promptTokens += tokenUsage.promptTokens;
  cumulativeTokens.completionTokens += tokenUsage.completionTokens;
  cumulativeTokens.totalTokens += tokenUsage.totalTokens;
  cumulativeTokens.inputCost += inputCost;
  cumulativeTokens.outputCost += outputCost;
  cumulativeTokens.totalCost += totalCost;

  return tokenUsage;
}

main(); 