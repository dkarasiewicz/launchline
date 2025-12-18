import { Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, lt, or, SQL } from 'drizzle-orm';
import type { SQLWrapper } from 'drizzle-orm/sql/sql';

export interface CursorParams {
  cursor?: string;
  limit?: number;
  syncToken?: string;
}

export interface CursorFieldsConfig {
  createdAtField: SQLWrapper;
  idField: SQLWrapper;
  updatedAtField?: SQLWrapper;
}

export interface CursorResult {
  cursorFilter?: SQL<unknown>;
  syncTokenFilter?: SQL<unknown>;
  effectiveLimit: number;
  queryLimit: number;
  newSyncToken: string;
}

export interface PaginationResult<T> {
  paginatedItems: T[];
  hasMore: boolean;
  nextCursor: string;
}

@Injectable()
export class PaginationService {
  private logger = new Logger(PaginationService.name);

  createCursorFilters(
    params: CursorParams,
    config: CursorFieldsConfig,
    maxLimit = 100,
  ): CursorResult {
    const effectiveLimit = Math.min(params.limit || 20, maxLimit);
    const queryLimit = effectiveLimit + 1;
    const newSyncToken = Buffer.from(new Date().toISOString()).toString(
      'base64',
    );

    const result: CursorResult = {
      effectiveLimit,
      queryLimit,
      newSyncToken,
    };

    if (params.cursor) {
      try {
        const [timestamp, id] = Buffer.from(params.cursor, 'base64')
          .toString('utf-8')
          .split('_');
        const cursorDate = new Date(timestamp);

        result.cursorFilter = or(
          lt(config.createdAtField, cursorDate),
          and(eq(config.createdAtField, cursorDate), gt(config.idField, id)),
        ) as SQL<unknown>;
      } catch (e) {
        this.logger.error(`Invalid cursor: ${params.cursor}`, e);
      }
    }

    if (params.syncToken && config.updatedAtField) {
      try {
        const lastSyncTime = new Date(
          Buffer.from(params.syncToken, 'base64').toString('utf-8'),
        );

        result.syncTokenFilter = or(
          gt(config.createdAtField, lastSyncTime),
          gt(config.updatedAtField, lastSyncTime),
        ) as SQL<unknown>;
      } catch (e) {
        this.logger.error(`Invalid sync token: ${params.syncToken}`, e);
      }
    }

    return result;
  }

  createNextCursor(lastItemId?: string, lastItemCreatedAt?: Date): string {
    if (!lastItemId || !lastItemCreatedAt) {
      return '';
    }

    return Buffer.from(
      `${lastItemCreatedAt.toISOString()}_${lastItemId}`,
    ).toString('base64');
  }

  hasMoreItems(itemsCount: number, effectiveLimit: number): boolean {
    return itemsCount > effectiveLimit;
  }

  getPaginatedItems<T>(items: T[], effectiveLimit: number): T[] {
    const hasMore = this.hasMoreItems(items.length, effectiveLimit);

    return hasMore ? items.slice(0, effectiveLimit) : items;
  }

  processPaginationResult<T>(
    items: T[],
    effectiveLimit: number,
    idSelector: (item: T) => string | undefined,
    dateSelector: (item: T) => Date | undefined,
  ): PaginationResult<T> {
    const hasMore = this.hasMoreItems(items.length, effectiveLimit);
    const paginatedItems = this.getPaginatedItems(items, effectiveLimit);

    const lastItem =
      paginatedItems.length > 0
        ? paginatedItems[paginatedItems.length - 1]
        : null;

    const nextCursor = lastItem
      ? this.createNextCursor(idSelector(lastItem), dateSelector(lastItem))
      : '';

    return {
      paginatedItems,
      hasMore,
      nextCursor,
    };
  }
}
