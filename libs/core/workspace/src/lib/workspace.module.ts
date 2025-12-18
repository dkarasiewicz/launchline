import { Module } from '@nestjs/common';
import { WorkspaceResolver } from './workspace.resolver';
import { WorkspaceFacade } from './workspace.facade';
import { WorkspaceService } from './workspace.service';

@Module({
  controllers: [],
  providers: [WorkspaceResolver, WorkspaceFacade, WorkspaceService],
  exports: [WorkspaceFacade],
})
export class WorkspaceModule {}
