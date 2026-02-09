import {
  BaseSandbox,
  type ExecuteResponse,
  type FileDownloadResponse,
  type FileUploadResponse,
} from 'deepagents';
import { SandboxService } from './sandbox.service';
import { NotFoundException } from '@nestjs/common';

type LineaSandboxBackendOptions = {
  workspaceId: string;
  sandboxService: SandboxService;
  timeoutMs?: number;
};

export class LineaSandboxBackend extends BaseSandbox {
  readonly id: string;
  private readonly workspaceId: string;
  private readonly sandboxService: SandboxService;
  private readonly timeoutMs: number;

  constructor(options: LineaSandboxBackendOptions) {
    super();
    this.workspaceId = options.workspaceId;
    this.sandboxService = options.sandboxService;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.id = `linea-sandbox-${this.workspaceId}`;
  }

  async execute(command: string): Promise<ExecuteResponse> {
    return this.sandboxService.executeCommand({
      workspaceId: this.workspaceId,
      command,
      timeoutMs: this.timeoutMs,
    });
  }

  async uploadFiles(
    files: Array<[string, Uint8Array]>,
  ): Promise<FileUploadResponse[]> {
    const sandbox = await this.sandboxService.getWorkspaceSandbox(
      this.workspaceId,
    );

    if (!sandbox.uploadFiles) {
      throw new NotFoundException('Unable to upload file');
    }

    return sandbox.uploadFiles(files);
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const sandbox = await this.sandboxService.getWorkspaceSandbox(
      this.workspaceId,
    );

    if (!sandbox.downloadFiles) {
      throw new NotFoundException('Unable to download file');
    }

    return sandbox.downloadFiles(paths);
  }
}
