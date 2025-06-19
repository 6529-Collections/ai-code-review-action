import * as core from '@actions/core';
import * as github from '@actions/github';
import * as exec from '@actions/exec';
import { run } from '../src/index';

// Mock @actions/core
jest.mock('@actions/core');
const mockCore = core as jest.Mocked<typeof core>;

// Mock @actions/github
jest.mock('@actions/github');
const mockGithub = github as jest.Mocked<typeof github>;

// Mock @actions/exec
jest.mock('@actions/exec');
const mockExec = exec as jest.Mocked<typeof exec>;

describe('Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.exec.mockResolvedValue(0);
    
    // Mock GitHub context
    Object.defineProperty(mockGithub, 'context', {
      value: {
        eventName: 'push',
        repo: { owner: 'test', repo: 'test' },
        payload: {},
      },
      writable: true,
    });
    
    // Mock inputs
    mockCore.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'github-token':
          return 'test-token';
        case 'anthropic-api-key':
          return 'test-api-key';
        default:
          return '';
      }
    });
  });

  it('should analyze themes when files are changed', async () => {
    // Mock PR context
    Object.defineProperty(mockGithub, 'context', {
      value: {
        eventName: 'pull_request',
        repo: { owner: 'test', repo: 'test' },
        payload: {
          pull_request: {
            number: 123,
            title: 'Test PR',
            body: 'Test description',
            base: { ref: 'main', sha: 'base-sha' },
            head: { ref: 'feature', sha: 'head-sha' },
          },
        },
      },
      writable: true,
    });

    // Mock GitHub API
    const mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({
            data: [
              {
                filename: 'src/test.ts',
                status: 'modified',
                additions: 10,
                deletions: 5,
                patch: '@@ test patch @@',
              },
            ],
          }),
        },
      },
    };
    mockGithub.getOctokit.mockReturnValue(mockOctokit as any);

    await run();

    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'themes',
      expect.stringMatching(/\[.*"name".*\]/)
    );
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'summary',
      expect.stringMatching(/Discovered \d+ themes:|Analysis of \d+ changed files/)
    );
  });

  it('should handle no changed files', async () => {
    // Mock PR context with no files
    Object.defineProperty(mockGithub, 'context', {
      value: {
        eventName: 'pull_request',
        repo: { owner: 'test', repo: 'test' },
        payload: {
          pull_request: {
            number: 123,
            title: 'Test PR',
            body: 'Test description',
            base: { ref: 'main', sha: 'base-sha' },
            head: { ref: 'feature', sha: 'head-sha' },
          },
        },
      },
      writable: true,
    });

    const mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({ data: [] }),
        },
      },
    };
    mockGithub.getOctokit.mockReturnValue(mockOctokit as any);

    await run();

    expect(mockCore.setOutput).toHaveBeenCalledWith('themes', '[]');
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'summary',
      'No files changed in this PR'
    );
  });

  it('should handle non-PR events', async () => {
    // Non-PR event (push)
    Object.defineProperty(mockGithub, 'context', {
      value: {
        eventName: 'push',
        repo: { owner: 'test', repo: 'test' },
        payload: {},
      },
      writable: true,
    });

    await run();

    expect(mockCore.setOutput).toHaveBeenCalledWith('themes', '[]');
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'summary',
      'No files changed in this PR'
    );
  });

  it('should handle errors', async () => {
    mockCore.getInput.mockImplementation(() => {
      throw new Error('Test error');
    });

    await run();

    expect(mockCore.setFailed).toHaveBeenCalledWith('Test error');
  });
});