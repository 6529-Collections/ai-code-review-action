import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { run } from '../src/index';

// Mock @actions/core
jest.mock('@actions/core');
const mockCore = core as jest.Mocked<typeof core>;

// Mock @actions/exec
jest.mock('@actions/exec');
const mockExec = exec as jest.Mocked<typeof exec>;

describe('Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.exec.mockResolvedValue(0);
  });

  it('should output greeting message', async () => {
    mockCore.getInput.mockReturnValue('Hello World');
    
    await run();
    
    expect(mockCore.getInput).toHaveBeenCalledWith('greeting');
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'message', 
      expect.stringMatching(/^Hello World from GitHub Actions! \(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\)$/)
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