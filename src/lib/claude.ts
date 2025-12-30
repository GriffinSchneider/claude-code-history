import { spawn } from 'child_process';

/**
 * Launch Claude Code with --resume to continue a session
 */
export function resumeSession(sessionId: string) {
  const child = spawn('claude', ['--resume', sessionId], {
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error('Failed to launch claude:', err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
