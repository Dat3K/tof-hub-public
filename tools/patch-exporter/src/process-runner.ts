import { spawn, type SpawnOptions } from 'node:child_process';

export interface ProcessRunOptions extends SpawnOptions {
  timeoutMs?: number;
  /** Mirror child output live while retaining it for diagnostics. */
  streamOutput?: boolean;
}

export interface ProcessRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  executable: string;
  args: string[];
}

export interface ProcessRunner {
  run(executable: string, args: string[], options?: ProcessRunOptions): Promise<ProcessRunResult>;
}

/**
 * Production process runner using child_process.spawn.
 */
export class DefaultProcessRunner implements ProcessRunner {
  public async run(
    executable: string,
    args: string[],
    options: ProcessRunOptions = {}
  ): Promise<ProcessRunResult> {
    return new Promise((resolve, reject) => {
      const { timeoutMs, streamOutput = true, ...spawnOptions } = options;
      const child = spawn(executable, args, {
        windowsHide: true,
        ...spawnOptions,
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data: Buffer | string) => {
          const text = data.toString();
          stdout += text;
          if (streamOutput) process.stdout.write(text);
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data: Buffer | string) => {
          const text = data.toString();
          stderr += text;
          if (streamOutput) process.stderr.write(text);
        });
      }

      let timeoutHandle: NodeJS.Timeout | undefined;
      if (timeoutMs && timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          child.kill('SIGTERM');
          reject(
            new Error(
              `Process execution timed out after ${timeoutMs}ms: ${executable} ${args.join(' ')}`
            )
          );
        }, timeoutMs);
      }

      child.on('error', (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        reject(err);
      });

      child.on('close', (code) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        resolve({
          // A signal termination has no exit code; it is never a success.
          exitCode: code ?? 1,
          stdout,
          stderr,
          executable,
          args,
        });
      });
    });
  }
}

export interface MockProcessInvocation {
  executable: string;
  args: string[];
  options?: ProcessRunOptions;
}

export interface MockRunnerConfig {
  defaultExitCode?: number;
  defaultStdout?: string;
  defaultStderr?: string;
  handlers?: Array<{
    match: (executable: string, args: string[]) => boolean;
    result: Partial<ProcessRunResult> | ((executable: string, args: string[]) => Partial<ProcessRunResult>);
  }>;
}

/**
 * Mock process runner for unit tests. Records invocations without launching actual OS processes.
 */
export class MockProcessRunner implements ProcessRunner {
  public readonly invocations: MockProcessInvocation[] = [];
  private config: MockRunnerConfig;

  constructor(config: MockRunnerConfig = {}) {
    this.config = config;
  }

  public async run(
    executable: string,
    args: string[],
    options?: ProcessRunOptions
  ): Promise<ProcessRunResult> {
    this.invocations.push({ executable, args, options });

    if (this.config.handlers) {
      for (const handler of this.config.handlers) {
        if (handler.match(executable, args)) {
          const res = typeof handler.result === 'function' ? handler.result(executable, args) : handler.result;
          return {
            exitCode: res.exitCode ?? 0,
            stdout: res.stdout ?? '',
            stderr: res.stderr ?? '',
            executable,
            args,
          };
        }
      }
    }

    return {
      exitCode: this.config.defaultExitCode ?? 0,
      stdout: this.config.defaultStdout ?? '[MOCK] Process executed successfully\n',
      stderr: this.config.defaultStderr ?? '',
      executable,
      args,
    };
  }

  public reset(): void {
    this.invocations.length = 0;
  }
}

/**
 * Mode-aware process runner that guarantees extraction execution cannot be invoked
 * during existing-files processing workflows.
 */
export class ModeGuardedProcessRunner implements ProcessRunner {
  constructor(
    private readonly mode: 'existing-files' | 'export',
    private readonly delegate: ProcessRunner = new DefaultProcessRunner()
  ) {}

  public async run(
    executable: string,
    args: string[],
    options?: ProcessRunOptions
  ): Promise<ProcessRunResult> {
    if (this.mode === 'existing-files') {
      throw new Error(
        `Extraction execution is strictly forbidden in existing-files mode. Attempted to execute: ${executable} ${args.join(' ')}`
      );
    }
    return this.delegate.run(executable, args, options);
  }
}
