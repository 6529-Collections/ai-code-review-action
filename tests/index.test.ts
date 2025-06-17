import * as core from '@actions/core';

// Mock @actions/core
jest.mock('@actions/core');
const mockCore = core as jest.Mocked<typeof core>;

describe('Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should output greeting message', async () => {
    mockCore.getInput.mockReturnValue('Hello World');
    
    // Import and run the action
    await import('../src/index');
    
    expect(mockCore.getInput).toHaveBeenCalledWith('greeting');
    expect(mockCore.setOutput).toHaveBeenCalledWith('message', 'Hello World from GitHub Actions!');
  });

  it('should handle errors', async () => {
    mockCore.getInput.mockImplementation(() => {
      throw new Error('Test error');
    });
    
    await import('../src/index');
    
    expect(mockCore.setFailed).toHaveBeenCalledWith('Test error');
  });
});