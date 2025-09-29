import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot } from '@angular/router';

import { PageTitleStrategy } from './page-title.strategy';

describe('PageTitleStrategy', () => {
  let strategy: PageTitleStrategy;
  let mockTitle: jest.Mocked<Title>;

  beforeEach(() => {
    mockTitle = {
      setTitle: jest.fn()
    } as any;

    TestBed.configureTestingModule({
      providers: [PageTitleStrategy, { provide: Title, useValue: mockTitle }]
    });

    strategy = TestBed.inject(PageTitleStrategy);
  });

  describe('updateTitle', () => {
    it('should set title with app name when route has title', () => {
      const mockRouterState = {
        root: {
          data: { title: 'Test Page' },
          firstChild: null
        }
      } as unknown as RouterStateSnapshot;

      strategy.updateTitle(mockRouterState);

      expect(mockTitle.setTitle).toHaveBeenCalledWith('Test Page - ASP For NYC');
    });

    it('should set default title when route has no title', () => {
      const mockRouterState = {
        root: {
          data: {},
          firstChild: null
        }
      } as unknown as RouterStateSnapshot;

      strategy.updateTitle(mockRouterState);

      expect(mockTitle.setTitle).toHaveBeenCalledWith('ASP For NYC');
    });

    it('should traverse child routes to find title', () => {
      const mockRouterState = {
        root: {
          data: {},
          firstChild: {
            data: { title: 'Child Page' },
            firstChild: null
          }
        }
      } as unknown as RouterStateSnapshot;

      strategy.updateTitle(mockRouterState);

      expect(mockTitle.setTitle).toHaveBeenCalledWith('Child Page - ASP For NYC');
    });

    it('should use last found title in route hierarchy', () => {
      const mockRouterState = {
        root: {
          data: { title: 'Root Title' },
          firstChild: {
            data: { title: 'Child Title' },
            firstChild: {
              data: { title: 'Grandchild Title' },
              firstChild: null
            }
          }
        }
      } as unknown as RouterStateSnapshot;

      strategy.updateTitle(mockRouterState);

      expect(mockTitle.setTitle).toHaveBeenCalledWith('Grandchild Title - ASP For NYC');
    });
  });

  describe('buildTitle', () => {
    it('should return title from route data', () => {
      const mockRouterState = {
        root: {
          data: { title: 'Test Page' },
          firstChild: null
        }
      } as unknown as RouterStateSnapshot;

      const title = strategy.buildTitle(mockRouterState);

      expect(title).toBe('Test Page');
    });

    it('should return undefined when no title found', () => {
      const mockRouterState = {
        root: {
          data: {},
          firstChild: null
        }
      } as unknown as RouterStateSnapshot;

      const title = strategy.buildTitle(mockRouterState);

      expect(title).toBeUndefined();
    });

    it('should traverse nested routes', () => {
      const mockRouterState = {
        root: {
          data: {},
          firstChild: {
            data: {},
            firstChild: {
              data: { title: 'Nested Page' },
              firstChild: null
            }
          }
        }
      } as unknown as RouterStateSnapshot;

      const title = strategy.buildTitle(mockRouterState);

      expect(title).toBe('Nested Page');
    });

    it('should handle deeply nested routes without title', () => {
      const mockRouterState = {
        root: {
          data: {},
          firstChild: {
            data: {},
            firstChild: {
              data: {},
              firstChild: null
            }
          }
        }
      } as unknown as RouterStateSnapshot;

      const title = strategy.buildTitle(mockRouterState);

      expect(title).toBeUndefined();
    });
  });
});
