import { PaginationService } from './pagination.service';
import { SQLWrapper } from 'drizzle-orm/sql/sql';

describe('PaginationService', () => {
  let service: PaginationService;

  beforeEach(async () => {
    service = new PaginationService();
  });

  describe('createCursorFilters', () => {
    const mockTable = {
      createdAt: { name: 'createdAt' },
      id: { name: 'id' },
      updatedAt: { name: 'updatedAt' },
    };

    it('should return basic pagination parameters with no cursor or syncToken', () => {
      const result = service.createCursorFilters(
        {},
        {
          createdAtField: mockTable.createdAt as unknown as SQLWrapper,
          idField: mockTable.id as unknown as SQLWrapper,
        },
      );

      expect(result.effectiveLimit).toBe(20);
      expect(result.queryLimit).toBe(21);
      expect(result.newSyncToken).toBeDefined();
      expect(result.cursorFilter).toBeUndefined();
      expect(result.syncTokenFilter).toBeUndefined();
    });

    it('should respect provided limit', () => {
      const result = service.createCursorFilters(
        { limit: 10 },
        {
          createdAtField: mockTable.createdAt as unknown as SQLWrapper,
          idField: mockTable.id as unknown as SQLWrapper,
        },
      );

      expect(result.effectiveLimit).toBe(10);
      expect(result.queryLimit).toBe(11);
    });

    it('should cap limit to maxLimit', () => {
      const result = service.createCursorFilters(
        { limit: 200 },
        {
          createdAtField: mockTable.createdAt as unknown as SQLWrapper,
          idField: mockTable.id as unknown as SQLWrapper,
        },
        50,
      );

      expect(result.effectiveLimit).toBe(50);
      expect(result.queryLimit).toBe(51);
    });

    it('should create cursor filter when cursor provided', () => {
      // Create a valid cursor with predictable date
      const testDate = new Date('2023-01-01T00:00:00Z');
      const testId = '123';
      const cursor = Buffer.from(
        `${testDate.toISOString()}_${testId}`,
      ).toString('base64');

      const result = service.createCursorFilters(
        { cursor },
        {
          createdAtField: mockTable.createdAt as unknown as SQLWrapper,
          idField: mockTable.id as unknown as SQLWrapper,
        },
      );

      expect(result.cursorFilter).toBeDefined();
    });

    it('should handle invalid cursor gracefully', () => {
      const spy = jest
        .spyOn(service['logger'], 'error')
        .mockReturnValue(undefined);

      const result = service.createCursorFilters(
        { cursor: {} as string },
        {
          createdAtField: mockTable.createdAt as unknown as SQLWrapper,
          idField: mockTable.id as unknown as SQLWrapper,
        },
      );

      expect(spy).toHaveBeenCalled();
      expect(result.cursorFilter).toBeUndefined();
    });

    it('should create syncToken filter when syncToken provided', () => {
      const syncToken = Buffer.from(new Date().toISOString()).toString(
        'base64',
      );

      const result = service.createCursorFilters(
        { syncToken },
        {
          createdAtField: mockTable.createdAt as unknown as SQLWrapper,
          idField: mockTable.id as unknown as SQLWrapper,
          updatedAtField: mockTable.updatedAt as unknown as SQLWrapper,
        },
      );

      expect(result.syncTokenFilter).toBeDefined();
    });
  });

  describe('createNextCursor', () => {
    it('should create valid cursor from id and date', () => {
      const id = 'test-id';
      const date = new Date('2023-01-01T00:00:00Z');
      const cursor = service.createNextCursor(id, date);

      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      expect(decoded).toBe(`${date.toISOString()}_${id}`);
    });

    it('should return empty string if id or date is missing', () => {
      expect(service.createNextCursor(undefined, new Date())).toBe('');
      expect(service.createNextCursor('id', undefined)).toBe('');
      expect(service.createNextCursor(undefined, undefined)).toBe('');
    });
  });

  describe('hasMoreItems', () => {
    it('should return true when items count exceeds limit', () => {
      expect(service.hasMoreItems(11, 10)).toBe(true);
    });

    it('should return false when items count equals or is less than limit', () => {
      expect(service.hasMoreItems(10, 10)).toBe(false);
      expect(service.hasMoreItems(5, 10)).toBe(false);
    });
  });

  describe('getPaginatedItems', () => {
    it('should slice array when hasMore is true', () => {
      const items = [1, 2, 3, 4, 5, 6];
      const result = service.getPaginatedItems(items, 5);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return original array when hasMore is false', () => {
      const items = [1, 2, 3, 4, 5];
      const result = service.getPaginatedItems(items, 5);
      expect(result).toEqual(items);
    });
  });

  describe('processPaginationResult', () => {
    it('should process results correctly', () => {
      const items = [
        { id: 'id1', createdAt: new Date('2023-01-01') },
        { id: 'id2', createdAt: new Date('2023-01-02') },
        { id: 'id3', createdAt: new Date('2023-01-03') },
      ];

      const result = service.processPaginationResult(
        items,
        2,
        (item) => item.id,
        (item) => item.createdAt,
      );

      expect(result.paginatedItems).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('should handle empty results', () => {
      const result = service.processPaginationResult(
        [],
        10,
        (item: { id?: string; createdAt?: Date }) => item.id,
        (item: { id?: string; createdAt?: Date }) => item.createdAt,
      );

      expect(result.paginatedItems).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBe('');
    });
  });
});
