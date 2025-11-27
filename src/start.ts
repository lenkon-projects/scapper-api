import 'dotenv/config';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

/**
 * Startup Script
 *
 * Launches both API server and Telegram bot in parallel.
 * Handles graceful shutdown of both processes.
 */

const API_SCRIPT = path.join(__dirname, 'api', 'server.js');
const BOT_SCRIPT = path.join(__dirname, 'bot', 'telegram-bot.js');

let apiProcess: ChildProcess | null = null;
let botProcess: ChildProcess | null = null;

/**
 * Start a child process
 */
function startProcess(name: string, scriptPath: string): ChildProcess {
  console.log(`[Startup] Starting ${name}...`);

  const proc = spawn('node', [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });

  proc.on('error', (error) => {
    console.error(`[Startup] ${name} error:`, error);
  });

  proc.on('exit', (code, signal) => {
    if (code !== null) {
      console.log(`[Startup] ${name} exited with code ${code}`);
    } else if (signal !== null) {
      console.log(`[Startup] ${name} killed with signal ${signal}`);
    }

    // If one process dies unexpectedly, shut down everything
    if (code !== 0 && code !== null) {
      console.error(`[Startup] ${name} crashed, shutting down all services...`);
      shutdown();
    }
  });

  return proc;
}

/**
 * Graceful shutdown
 */
function shutdown() {
  console.log('\n[Startup] Shutting down services...');

  const promises: Promise<void>[] = [];

  if (apiProcess && !apiProcess.killed) {
    promises.push(
      new Promise((resolve) => {
        console.log('[Startup] Stopping API server...');
        apiProcess!.on('exit', () => {
          console.log('[Startup] API server stopped');
          resolve();
        });
        apiProcess!.kill('SIGTERM');

        // Force kill after 10 seconds
        setTimeout(() => {
          if (apiProcess && !apiProcess.killed) {
            console.log('[Startup] Force killing API server...');
            apiProcess.kill('SIGKILL');
          }
        }, 10000);
      })
    );
  }

  if (botProcess && !botProcess.killed) {
    promises.push(
      new Promise((resolve) => {
        console.log('[Startup] Stopping Telegram bot...');
        botProcess!.on('exit', () => {
          console.log('[Startup] Telegram bot stopped');
          resolve();
        });
        botProcess!.kill('SIGTERM');

        // Force kill after 10 seconds
        setTimeout(() => {
          if (botProcess && !botProcess.killed) {
            console.log('[Startup] Force killing Telegram bot...');
            botProcess.kill('SIGKILL');
          }
        }, 10000);
      })
    );
  }

  // Wait for all processes to stop, then exit
  Promise.all(promises).then(() => {
    console.log('[Startup] All services stopped');
    process.exit(0);
  });
}

/**
 * Main startup sequence
 */
async function main() {
  console.log('='.repeat(60));
  console.log('[Startup] WordPress Parser - Starting Services');
  console.log('='.repeat(60));
  console.log('');

  // Start API server
  apiProcess = startProcess('API Server', API_SCRIPT);

  // Wait a bit before starting bot
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start Telegram bot
  botProcess = startProcess('Telegram Bot', BOT_SCRIPT);

  console.log('');
  console.log('[Startup] All services started successfully');
  console.log('[Startup] Press Ctrl+C to stop');
  console.log('');

  // Handle shutdown signals
  process.on('SIGINT', () => {
    console.log('\n[Startup] Received SIGINT signal');
    shutdown();
  });

  process.on('SIGTERM', () => {
    console.log('\n[Startup] Received SIGTERM signal');
    shutdown();
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[Startup] Uncaught exception:', error);
    shutdown();
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Startup] Unhandled rejection at:', promise, 'reason:', reason);
    shutdown();
  });
}

// Start everything
main().catch((error) => {
  console.error('[Startup] Fatal error:', error);
  process.exit(1);
});
